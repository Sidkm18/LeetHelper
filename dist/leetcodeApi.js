"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeetCodeApi = void 0;
const axios_1 = require("axios");
const vscode = require("vscode");
class LeetCodeApi {
    constructor() {
        this.graphqlUrl = 'https://leetcode.com/graphql';
        this.outputChannel = vscode.window.createOutputChannel('LeetCode Output');
    }
    static getInstance() {
        if (!LeetCodeApi.instance) {
            LeetCodeApi.instance = new LeetCodeApi();
        }
        return LeetCodeApi.instance;
    }
    log(message) {
        const timestamp = new Date().toLocaleTimeString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }
    getHeaders() {
        const config = vscode.workspace.getConfiguration('leethelp');
        const cookie = config.get('sessionCookie', '');
        const csrfToken = this.getCsrfToken(cookie);
        const headers = {
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
    getCsrfToken(cookie) {
        const match = cookie.match(/csrftoken=([^;]+)/i);
        return match ? match[1] : '';
    }
    async getUser() {
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
            const response = await axios_1.default.post(this.graphqlUrl, { query }, { headers: this.getHeaders() });
            if (response.data.errors) {
                this.log('Auth Check Failed: ' + JSON.stringify(response.data.errors));
                return null;
            }
            const user = response.data.data.userStatus;
            if (user && user.username) {
                return user;
            }
            return null;
        }
        catch (error) {
            this.log(`Auth Check Error: ${error.message}`);
            return null;
        }
    }
    async getAllProblems() {
        // Fetch a large number to ensure we get all problems (LeetCode has ~3200 as of late 2024)
        return this.getProblems(10000, 0);
    }
    async getProblems(limit = 50, skip = 0, category = '') {
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
            const response = await axios_1.default.post(this.graphqlUrl, { query, variables }, { headers: this.getHeaders() });
            if (response.data.errors) {
                this.log('GraphQL Errors: ' + JSON.stringify(response.data.errors));
                console.error('GraphQL Errors:', response.data.errors);
                // Don't throw for partial errors, return what we have? No, usually errors means fail.
                throw new Error('Failed to fetch problems: ' + JSON.stringify(response.data.errors));
            }
            return response.data.data.problemsetQuestionList.data;
        }
        catch (error) {
            this.log(`Error fetching problems: ${error.message}`);
            if (error.response) {
                this.log(`Status: ${error.response.status}`);
                this.log(`Data: ${JSON.stringify(error.response.data)}`);
            }
            console.error('Error fetching problems:', error);
            throw error;
        }
    }
    async getProblemDetail(titleSlug) {
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
            const response = await axios_1.default.post(this.graphqlUrl, { query, variables }, { headers: this.getHeaders() });
            if (response.data.errors) {
                this.log('GraphQL Errors: ' + JSON.stringify(response.data.errors));
                throw new Error('Failed to fetch problem details');
            }
            return response.data.data.question;
        }
        catch (error) {
            this.log(`Error fetching problem details: ${error.message}`);
            if (error.response) {
                this.log(`Status: ${error.response.status}`);
            }
            console.error('Error fetching problem details:', error);
            throw error;
        }
    }
    async runCode(slug, questionId, lang, code, dataInput) {
        const url = `https://leetcode.com/problems/${slug}/interpret_solution/`;
        try {
            const response = await axios_1.default.post(url, {
                question_id: questionId,
                data_input: dataInput,
                lang: lang,
                judge_type: 'large',
                typed_code: code
            }, { headers: this.getHeaders() });
            return response.data.interpret_id;
            return response.data.interpret_id;
        }
        catch (error) {
            this.log(`Error running code: ${error.message}`);
            if (error.response) {
                this.log(`Status: ${error.response.status}`);
                this.log(`Data: ${JSON.stringify(error.response.data)}`);
            }
            console.error('Error running code:', error);
            throw error;
        }
    }
    async checkStatus(interpretId) {
        const url = `https://leetcode.com/submissions/detail/${interpretId}/check/`;
        // Polling logic should be handled by the caller, this just checks once
        try {
            const response = await axios_1.default.get(url, { headers: this.getHeaders() });
            return response.data;
        }
        catch (error) {
            this.log(`Error checking status: ${error.message}`);
            console.error('Error checking status:', error);
            throw error;
        }
    }
    async submit(slug, questionId, lang, code) {
        const url = `https://leetcode.com/problems/${slug}/submit/`;
        try {
            const response = await axios_1.default.post(url, {
                question_id: questionId,
                lang: lang,
                typed_code: code
            }, { headers: this.getHeaders() });
            return response.data.submission_id;
            return response.data.submission_id;
        }
        catch (error) {
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
exports.LeetCodeApi = LeetCodeApi;
//# sourceMappingURL=leetcodeApi.js.map