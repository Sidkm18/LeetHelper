import axios from 'axios';
import * as vscode from 'vscode';

// Security: Configure axios defaults for all requests
const axiosConfig = {
    timeout: 30000, // 30 second timeout
    maxContentLength: 10 * 1024 * 1024, // 10MB max response
    maxBodyLength: 10 * 1024 * 1024 // 10MB max request
};

export interface Question {
    questionId: string;
    title: string;
    titleSlug: string;
    difficulty: string;
    isPaidOnly: boolean;
    status?: string | null;
}

export interface QuestionDetail {
    questionId: string;
    title: string;
    titleSlug: string;
    content: string;
    difficulty: string;
    codeSnippets: Array<{
        lang: string;
        langSlug: string;
        code: string;
    }>;
    exampleTestcases: string;
}

export interface UserProfile {
    username: string;
    realName: string;
    avatar: string;
}

export interface DailyQuestion {
    date: string;
    link: string;
    question: Question;
}

export interface SubmissionHistory {
    id: number;
    title: string;
    titleSlug: string;
    lang: string;
    status: 'AC' | 'WA' | 'TLE' | 'MLE' | 'RE';
    timestamp: string;
}

export class LeetCodeApi {
    private static instance: LeetCodeApi;
    private readonly graphqlUrl = 'https://leetcode.com/graphql';
    private outputChannel: vscode.OutputChannel;
    private secretStorage: vscode.SecretStorage | undefined;
    private _cookie: string = '';
    private readonly SECRET_KEY = 'leethelp.sessionCookie';
    private readonly LAST_VERIFIED_KEY = 'leethelp.lastVerifiedAt';
    private _lastVerifiedAt: number = 0;

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('LeetCode Output');
    }

    public static getInstance(): LeetCodeApi {
        if (!LeetCodeApi.instance) {
            LeetCodeApi.instance = new LeetCodeApi();
        }
        return LeetCodeApi.instance;
    }

    public async initialize(secretStorage: vscode.SecretStorage): Promise<void> {
        this.secretStorage = secretStorage;
        this._cookie = await this.secretStorage.get(this.SECRET_KEY) || '';
        const lastVerified = await this.secretStorage.get(this.LAST_VERIFIED_KEY);
        this._lastVerifiedAt = lastVerified ? parseInt(lastVerified, 10) : 0;

        // Listen for changes (e.g. from other windows or concurrent updates)
        this.secretStorage.onDidChange(e => {
            if (e.key === this.SECRET_KEY) {
                this.refreshCookieFromStorage();
            }
        });
    }

    private async refreshCookieFromStorage() {
        if (this.secretStorage) {
            this._cookie = await this.secretStorage.get(this.SECRET_KEY) || '';
        }
    }

    public async setCookie(cookie: string): Promise<void> {
        if (this.secretStorage) {
            await this.secretStorage.store(this.SECRET_KEY, cookie);
            this._cookie = cookie; // Update cache immediately
        }
    }

    public async deleteCookie(): Promise<void> {
        if (this.secretStorage) {
            await this.secretStorage.delete(this.SECRET_KEY);
            this._cookie = '';
        }
    }

    public getCookie(): string {
        return this._cookie;
    }

    public isLoggedIn(): boolean {
        return !!this._cookie && this._cookie.trim() !== '';
    }

    public log(message: string): void {
        const timestamp = new Date().toLocaleTimeString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }

    private getHeaders(referer: string = 'https://leetcode.com'): Record<string, string> {
        // Use cached cookie
        const cookie = this._cookie;
        const csrfToken = this.getCsrfToken(cookie);

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
            'Referer': referer,
            'Origin': 'https://leetcode.com'
        };

        if (cookie && cookie.trim() !== '') {
            headers['Cookie'] = cookie;
            if (csrfToken) {
                headers['x-csrftoken'] = csrfToken;
                this.log(`[DEBUG] CSRF token extracted: ${csrfToken.substring(0, 8)}...`);
            } else {
                this.log('[WARN] No CSRF token found in cookie - requests may fail');
            }
        } else {
            this.log('[WARN] No session cookie set');
        }

        return headers;
    }

    private getCsrfToken(cookie: string): string {
        // Extract CSRF token from cookie (can contain alphanumeric, underscores, hyphens)
        const match = cookie.match(/csrftoken=([a-zA-Z0-9_-]+)/i);
        return match ? match[1] : '';
    }

    private validateSlug(slug: string): void {
        if (!/^[a-z0-9-]+$/.test(slug)) {
            throw new Error('Invalid slug format');
        }
    }

    private validateId(id: string): void {
        // interpretId/submissionId from LeetCode can be numeric or contain various chars
        // Only block obvious injection attempts (slashes, spaces, special chars)
        if (!id || /[\s\/\\<>"']/.test(id)) {
            throw new Error('Invalid ID format');
        }
    }

    private validateCategory(category: string): void {
        // Category can be empty or alphanumeric with hyphens
        if (category && !/^[a-z0-9-]*$/.test(category)) {
            throw new Error('Invalid category format');
        }
    }

    private redactUrl(message: string): string {
        // Redact URLs from error messages
        return message.replace(/https?:\/\/[^\s]+/g, '[URL REDACTED]');
    }

    private getErrorMessage(error: any): string {
        // Parse error and return human-readable message
        if (error.response) {
            const status = error.response.status;
            const data = error.response.data;
            
            // Authentication errors
            if (status === 401) {
                return 'Authentication failed: Session expired or invalid. Please sign in again.';
            }
            if (status === 403) {
                if (data && typeof data === 'string' && data.includes('CSRF')) {
                    return 'CSRF token error: Please sign out and sign in again.';
                }
                return 'Access forbidden: Session may be expired or invalid.';
            }
            
            // Bad request - usually malformed code or encoding issues
            if (status === 400) {
                if (data && data.error) {
                    return `Bad request: ${data.error}`;
                }
                return 'Bad request: Code may contain invalid characters or encoding issues. Try re-typing the code.';
            }
            
            // Rate limiting
            if (status === 429) {
                return 'Rate limit exceeded: Please wait a moment before trying again.';
            }
            
            // Server errors
            if (status >= 500) {
                return 'LeetCode server error: Please try again later.';
            }
            
            // Generic error with data
            if (data && data.error) {
                return `Error: ${data.error}`;
            }
            
            return `HTTP ${status}: ${error.message}`;
        }
        
        // Network errors
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            return 'Request timeout: Please check your internet connection.';
        }
        if (error.code === 'ENOTFOUND' || error.message.includes('Network Error')) {
            return 'Network error: Cannot reach LeetCode. Please check your internet connection.';
        }
        
        // Generic error
        return error.message || 'Unknown error occurred';
    }

    public async getUser(): Promise<UserProfile | null> {
        const query = `
            query globalData {
                userStatus {
                    username
                    avatar
                    realName
                    realName
                }
            }
        `;

        try {
            const response = await axios.post(
                this.graphqlUrl,
                { query },
                { headers: this.getHeaders(), ...axiosConfig }
            );

            if (response.data.errors) {
                // Redact sensitive info
                this.log('Auth Check Failed');
                return null;
            }

            const user = response.data.data.userStatus;
            if (user && user.username) {
                return user;
            }
            return null;
        } catch (error: any) {
            this.log(`Auth Check Error: ${error.message}`);
            return null;
        }
    }

    public async getAllProblems(): Promise<Question[]> {
        // Fetch a large number to ensure we get all problems (LeetCode has ~3200 as of late 2024)
        return this.getProblems(10000, 0);
    }

    public async getProblems(limit: number = 50, skip: number = 0, category: string = ''): Promise<Question[]> {
        this.validateCategory(category);
        const query = `
            query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
                problemsetQuestionList: questionList(
                    categorySlug: $categorySlug
                    limit: $limit
                    skip: $skip
                    filters: $filters
                ) {
                    data {
                        questionId
                        title
                        titleSlug
                        difficulty
                        isPaidOnly
                        status
                    }
                }
            }
        `;

        const variables = {
            categorySlug: category,
            limit: limit,
            skip: skip,
            filters: {}
        };

        try {
            const response = await axios.post(
                this.graphqlUrl,
                { query, variables },
                { headers: this.getHeaders(), ...axiosConfig }
            );

            if (response.data.errors) {
                // Redact sensitive info from error message
                this.log('GraphQL error in getProblems');
                throw new Error('Failed to fetch problems');
            }

            return response.data.data.problemsetQuestionList.data;
        } catch (error: any) {
            this.log(`Error fetching problems: ${error.message}`);
            if (error.response) {
                this.log(`Status: ${error.response.status}`);
            }
            throw error;
        }
    }

    public async getProblemDetail(titleSlug: string): Promise<QuestionDetail> {
        this.validateSlug(titleSlug);
        const query = `
            query questionData($titleSlug: String!) {
                question(titleSlug: $titleSlug) {
                    questionId
                    title
                    titleSlug
                    content
                    difficulty
                    codeSnippets {
                        lang
                        langSlug
                        code
                    }
                    exampleTestcases
                }
            }
        `;

        const variables = {
            titleSlug: titleSlug
        };

        try {
            const response = await axios.post(
                this.graphqlUrl,
                { query, variables },
                { headers: this.getHeaders(), ...axiosConfig }
            );

            if (response.data.errors) {
                this.log('GraphQL Errors in getProblemDetail');
                throw new Error('Failed to fetch problem details');
            }

            return response.data.data.question;
        } catch (error: any) {
            this.log(`Error fetching problem details: ${error.message}`);
            if (error.response) {
                this.log(`Status: ${error.response.status}`);
            }
            throw error;
        }
    }

    public async runCode(slug: string, questionId: string, lang: string, code: string, dataInput: string): Promise<string> {
        this.validateSlug(slug);
        const url = `https://leetcode.com/problems/${slug}/interpret_solution/`;

        try {
            const response = await axios.post(
                url,
                {
                    question_id: questionId,
                    data_input: dataInput,
                    lang: lang,
                    judge_type: 'large',
                    typed_code: code
                },
                { headers: this.getHeaders(`https://leetcode.com/problems/${slug}/`), ...axiosConfig }
            );

            return response.data.interpret_id;
        } catch (error: any) {
            this.log(`Error running code: ${this.redactUrl(error.message)}`);
            if (error.response) {
                this.log(`Status: ${error.response.status}`);
                if (error.response.data) {
                    this.log(`Response: ${JSON.stringify(error.response.data)}`);
                }
            }
            // Re-throw with enhanced error info
            const enhancedError: any = new Error(this.getErrorMessage(error));
            enhancedError.status = error.response?.status;
            enhancedError.originalError = error;
            throw enhancedError;
        }
    }

    public async checkStatus(interpretId: string): Promise<any> {
        this.validateId(interpretId);
        const url = `https://leetcode.com/submissions/detail/${interpretId}/check/`;

        // Polling logic should be handled by the caller, this just checks once
        try {
            const response = await axios.get(url, { headers: this.getHeaders(), ...axiosConfig });
            return response.data;
        } catch (error: any) {
            this.log(`Error checking status: ${this.redactUrl(error.message)}`);
            throw error;
        }
    }

    public async submit(slug: string, questionId: string, lang: string, code: string): Promise<string> {
        this.validateSlug(slug);
        const url = `https://leetcode.com/problems/${slug}/submit/`;

        try {
            const response = await axios.post(
                url,
                {
                    question_id: questionId,
                    lang: lang,
                    typed_code: code
                },
                { headers: this.getHeaders(`https://leetcode.com/problems/${slug}/`), ...axiosConfig }
            );
            return response.data.submission_id;
        } catch (error: any) {
            this.log(`Error submitting code: ${this.redactUrl(error.message)}`);
            if (error.response) {
                this.log(`Status: ${error.response.status}`);
                if (error.response.data) {
                    this.log(`Response: ${JSON.stringify(error.response.data)}`);
                }
            }
            // Re-throw with enhanced error info
            const enhancedError: any = new Error(this.getErrorMessage(error));
            enhancedError.status = error.response?.status;
            enhancedError.originalError = error;
            throw enhancedError;
        }
    }

    // ==================== Auth Health Check ====================

    public async verifyAuth(): Promise<{ valid: boolean; username?: string; error?: string }> {
        if (!this.isLoggedIn()) {
            return { valid: false, error: 'No session cookie stored' };
        }

        try {
            const user = await this.getUser();
            if (user && user.username) {
                await this.updateLastVerified();
                return { valid: true, username: user.username };
            }
            return { valid: false, error: 'Session expired or invalid' };
        } catch (error: any) {
            return { valid: false, error: error.message || 'Auth verification failed' };
        }
    }

    private async updateLastVerified(): Promise<void> {
        this._lastVerifiedAt = Date.now();
        if (this.secretStorage) {
            await this.secretStorage.store(this.LAST_VERIFIED_KEY, this._lastVerifiedAt.toString());
        }
    }

    public getLastVerifiedAt(): number {
        return this._lastVerifiedAt;
    }

    public getSessionAge(): { days: number; hours: number } | null {
        if (!this._lastVerifiedAt) return null;
        const elapsed = Date.now() - this._lastVerifiedAt;
        const days = Math.floor(elapsed / (1000 * 60 * 60 * 24));
        const hours = Math.floor((elapsed % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        return { days, hours };
    }

    public isSessionPossiblyExpired(): boolean {
        const age = this.getSessionAge();
        if (!age) return true; // Never verified
        return age.days >= 7; // Warn after 7 days
    }

    // ==================== Daily Question ====================

    public async getDailyQuestion(): Promise<DailyQuestion> {
        const query = `
            query questionOfToday {
                activeDailyCodingChallengeQuestion {
                    date
                    link
                    question {
                        questionId
                        title
                        titleSlug
                        difficulty
                        isPaidOnly
                        status
                    }
                }
            }
        `;

        try {
            const response = await axios.post(
                this.graphqlUrl,
                { query },
                { headers: this.getHeaders(), ...axiosConfig }
            );

            if (response.data.errors) {
                this.log('GraphQL error in getDailyQuestion');
                throw new Error('Failed to fetch daily question');
            }

            return response.data.data.activeDailyCodingChallengeQuestion;
        } catch (error: any) {
            this.log(`Error fetching daily question: ${error.message}`);
            throw error;
        }
    }
}
