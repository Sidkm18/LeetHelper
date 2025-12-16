import axios from 'axios';
import * as vscode from 'vscode';

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

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('LeetCode Output');
    }

    public static getInstance(): LeetCodeApi {
        if (!LeetCodeApi.instance) {
            LeetCodeApi.instance = new LeetCodeApi();
        }
        return LeetCodeApi.instance;
    }

    public log(message: string): void {
        const timestamp = new Date().toLocaleTimeString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }

    private getHeaders(): Record<string, string> {
        const config = vscode.workspace.getConfiguration('leethelp');
        const cookie = config.get<string>('sessionCookie', '');
        const csrfToken = this.getCsrfToken(cookie);

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
            'Referer': 'https://leetcode.com',
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
        const match = cookie.match(/csrftoken=([^;]+)/i);
        return match ? match[1] : '';
    }

    public async getUser(): Promise<UserProfile | null> {
        const query = `
            query globalData {
                userStatus {
                    username
                    avatar
                    realName
                }
            }
        `;

        try {
            const response = await axios.post(
                this.graphqlUrl,
                { query },
                { headers: this.getHeaders() }
            );

            if (response.data.errors) {
                this.log('Auth Check Failed: ' + JSON.stringify(response.data.errors));
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
                { headers: this.getHeaders() }
            );

            if (response.data.errors) {
                this.log('GraphQL Errors: ' + JSON.stringify(response.data.errors));
                console.error('GraphQL Errors:', response.data.errors);
                // Don't throw for partial errors, return what we have? No, usually errors means fail.
                throw new Error('Failed to fetch problems: ' + JSON.stringify(response.data.errors));
            }

            return response.data.data.problemsetQuestionList.data;
        } catch (error: any) {
            this.log(`Error fetching problems: ${error.message}`);
            if (error.response) {
                this.log(`Status: ${error.response.status}`);
                this.log(`Data: ${JSON.stringify(error.response.data)}`);
            }
            console.error('Error fetching problems:', error);
            throw error;
        }
    }

    public async getProblemDetail(titleSlug: string): Promise<QuestionDetail> {
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
                { headers: this.getHeaders() }
            );

            if (response.data.errors) {
                this.log('GraphQL Errors: ' + JSON.stringify(response.data.errors));
                throw new Error('Failed to fetch problem details');
            }

            return response.data.data.question;
        } catch (error: any) {
            this.log(`Error fetching problem details: ${error.message}`);
            if (error.response) {
                this.log(`Status: ${error.response.status}`);
            }
            console.error('Error fetching problem details:', error);
            throw error;
        }
    }

    public async runCode(slug: string, questionId: string, lang: string, code: string, dataInput: string): Promise<string> {
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
                { headers: this.getHeaders() }
            );

            return response.data.interpret_id;
            return response.data.interpret_id;
        } catch (error: any) {
            this.log(`Error running code: ${error.message}`);
            if (error.response) {
                this.log(`Status: ${error.response.status}`);
                this.log(`Data: ${JSON.stringify(error.response.data)}`);
            }
            console.error('Error running code:', error);
            throw error;
        }
    }

    public async checkStatus(interpretId: string): Promise<any> {
        const url = `https://leetcode.com/submissions/detail/${interpretId}/check/`;

        // Polling logic should be handled by the caller, this just checks once
        try {
            const response = await axios.get(url, { headers: this.getHeaders() });
            return response.data;
        } catch (error: any) {
            this.log(`Error checking status: ${error.message}`);
            console.error('Error checking status:', error);
            throw error;
        }
    }

    public async submit(slug: string, questionId: string, lang: string, code: string): Promise<string> {
        const url = `https://leetcode.com/problems/${slug}/submit/`;

        try {
            const response = await axios.post(
                url,
                {
                    question_id: questionId,
                    lang: lang,
                    typed_code: code
                },
                { headers: this.getHeaders() }
            );
            return response.data.submission_id;
            return response.data.submission_id;
        } catch (error: any) {
            this.log(`Error submitting code: ${error.message}`);
            if (error.response) {
                this.log(`Status: ${error.response.status}`);
                this.log(`Data: ${JSON.stringify(error.response.data)}`);
            }
            console.error('Error submitting code:', error);
            throw error;
        }
    }
}
