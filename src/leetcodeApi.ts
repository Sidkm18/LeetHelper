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

export class LeetCodeApi {
    private static instance: LeetCodeApi;
    private readonly graphqlUrl = 'https://leetcode.com/graphql';
    private outputChannel: vscode.OutputChannel;
    private secretStorage: vscode.SecretStorage | undefined;
    private _cookie: string = '';
    private readonly SECRET_KEY = 'leethelp.sessionCookie';

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
            }
        }

        return headers;
    }

    private getCsrfToken(cookie: string): string {
        // Security: Only allow alphanumeric characters in CSRF token
        const match = cookie.match(/csrftoken=([a-zA-Z0-9]+)/i);
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
            }
            throw error;
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
            }
            throw error;
        }
    }
}
