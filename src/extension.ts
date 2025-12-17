import * as vscode from 'vscode';
import { LeetCodeTreeProvider } from './treeProvider';
import { LeetCodeApi, Question, QuestionDetail, SubmissionHistory } from './leetcodeApi';
import { LeetCodeWebview } from './webviewPanel';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { LeetCodeCodeLensProvider } from './codelensProvider';

// ==================== Local History ====================
const HISTORY_FILE = 'leethelp-history.json';

function getHistoryPath(): string | null {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return null;
    return path.join(workspaceFolders[0].uri.fsPath, HISTORY_FILE);
}

function loadHistory(): SubmissionHistory[] {
    const historyPath = getHistoryPath();
    if (!historyPath || !fs.existsSync(historyPath)) return [];
    try {
        return JSON.parse(fs.readFileSync(historyPath, 'utf8'));
    } catch {
        return [];
    }
}

function saveHistory(history: SubmissionHistory[]): void {
    const historyPath = getHistoryPath();
    if (!historyPath) return;
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
}

function addToHistory(entry: SubmissionHistory): void {
    const history = loadHistory();
    history.unshift(entry); // Add to beginning
    // Keep last 500 entries
    if (history.length > 500) history.pop();
    saveHistory(history);
}

// ==================== Git Auto-Commit ====================
async function autoCommitOnAccepted(
    document: vscode.TextDocument,
    problem: QuestionDetail,
    lang: string
): Promise<void> {
    const filePath = document.uri.fsPath;
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    
    if (!workspaceFolder) return;
    
    const cwd = workspaceFolder.uri.fsPath;
    
    // Save the file first
    await document.save();
    
    // Check if we're in a git repo
    try {
        execSync('git rev-parse --git-dir', { cwd, stdio: 'ignore' });
    } catch {
        return; // Not a git repo, skip silently
    }
    
    // Format language for display
    const langDisplay = lang.charAt(0).toUpperCase() + lang.slice(1).replace('3', '');
    const commitMsg = `LC: ${problem.questionId}. ${problem.title} [${langDisplay}]`;
    
    try {
        execSync(`git add "${filePath}"`, { cwd, stdio: 'ignore' });
        execSync(`git commit -m "${commitMsg}"`, { cwd, stdio: 'ignore' });
        vscode.window.showInformationMessage(`✅ Committed: ${commitMsg}`);
    } catch (err: any) {
        // Commit might fail if nothing changed - that's OK
        const api = LeetCodeApi.getInstance();
        if (err.message && !err.message.includes('nothing to commit')) {
            api.log(`Git commit failed: ${err.message}`);
        }
    }
}

export async function activate(context: vscode.ExtensionContext) {
    // Initialize API with SecretStorage
    const api = LeetCodeApi.getInstance();
    await api.initialize(context.secrets);

    // Migration: Check for legacy config cookie
    const config = vscode.workspace.getConfiguration('leethelp');
    const legacyCookie = config.get<string>('sessionCookie');
    if (legacyCookie && legacyCookie.trim() !== '') {
        await api.setCookie(legacyCookie);
        await config.update('sessionCookie', undefined, true); // Remove from settings
        vscode.window.showInformationMessage('LeetCode session migrated to secure storage.');
    }

    // ==================== Auth Health Check on Startup ====================
    if (api.isLoggedIn()) {
        // Check if session might be expired
        if (api.isSessionPossiblyExpired()) {
            vscode.window.showWarningMessage(
                '⚠️ LeetHelp: Session may be expired. Re-auth recommended.',
                'Sign In', 'Check Status'
            ).then(selection => {
                if (selection === 'Sign In') {
                    vscode.commands.executeCommand('leethelp.signIn');
                } else if (selection === 'Check Status') {
                    vscode.commands.executeCommand('leethelp.authStatus');
                }
            });
        } else {
            // Verify auth silently
            api.verifyAuth().then(result => {
                if (!result.valid) {
                    vscode.window.showErrorMessage(
                        `LeetHelp: Session invalid - ${result.error}`,
                        'Sign In'
                    ).then(selection => {
                        if (selection === 'Sign In') {
                            vscode.commands.executeCommand('leethelp.signIn');
                        }
                    });
                    api.deleteCookie(); // Auto-clear invalid cookie
                }
            });
        }
    }

    // Tree View Provider
    const treeProvider = new LeetCodeTreeProvider();
    vscode.window.registerTreeDataProvider('leetcode-problems', treeProvider);

    // Refresh Command
    context.subscriptions.push(vscode.commands.registerCommand('leethelp.refresh', () => treeProvider.refresh()));

    // Search Command
    context.subscriptions.push(vscode.commands.registerCommand('leethelp.searchProblem', async () => {
        const api = LeetCodeApi.getInstance();

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Fetching all problems...',
            cancellable: true
        }, async (progress, token) => {
            try {
                const problems = await api.getAllProblems();

                // Map to QuickPickItems
                const items: vscode.QuickPickItem[] = problems.map(p => ({
                    label: p.title,
                    description: `ID: ${p.questionId} | ${p.difficulty}`,
                    detail: `Status: ${p.status || 'Todo'}`,
                    // Store the actual question object slightly hidden or look it up later?
                    // We can just find it by titleSlug if needed, but let's see.
                    // Actually, we can attach custom data to QuickPickItem in some cases or just use a closure map.
                    // Easiest is to lookup or use parallel arrays.
                    // Let's attach it as a property by casting? Or just filter.
                    formattedProblem: p
                } as vscode.QuickPickItem & { formattedProblem: Question }));

                const selected = await vscode.window.showQuickPick(items, {
                    placeHolder: 'Search for a LeetCode problem (e.g. "Two Sum", "DP")',
                    matchOnDescription: true,
                    matchOnDetail: true
                });

                if (selected) {
                    vscode.commands.executeCommand('leethelp.openProblem', (selected as any).formattedProblem);
                }
            } catch (error: any) {
                const api = LeetCodeApi.getInstance();
                api.log(`Search error: ${error.message || error}`);
                vscode.window.showErrorMessage('Search failed. Check Output panel for details.');
            }
        });
    }));

    // CodeLens Provider
    const codeLensProvider = new LeetCodeCodeLensProvider();
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(
            [{ scheme: 'file', language: 'python' }, { scheme: 'file', language: 'cpp' }, { scheme: 'file', language: 'java' }, { scheme: 'file', language: 'javascript' }, { scheme: 'file', language: 'typescript' }, { scheme: 'file', language: 'go' }],
            codeLensProvider
        )
    );

    // Sign In Command
    context.subscriptions.push(vscode.commands.registerCommand('leethelp.signIn', async () => {
        const session = await vscode.window.showInputBox({
            placeHolder: 'Paste your full Cookie header value here',
            prompt: 'Browser -> Inspect -> Network -> Request Headers -> Cookie',
            ignoreFocusOut: true,
            password: true
        });

        if (session) {
            if (!session.includes('csrftoken=') || !session.includes('LEETCODE_SESSION=')) {
                vscode.window.showErrorMessage('Invalid Cookie: Missing "csrftoken" or "LEETCODE_SESSION". Please copy the full Cookie header value.');
                return;
            }

            // Update configuration immediately to test it
            await api.setCookie(session);

            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Verifying Session...',
                cancellable: false
            }, async () => {
                const user = await api.getUser();

                if (user) {
                    vscode.window.showInformationMessage(`Successfully signed in as ${user.username}!`);
                    treeProvider.refresh();
                } else {
                    vscode.window.showErrorMessage('Login failed. Please check your cookie and try again.');
                    await api.deleteCookie(); // Clear invalid cookie
                }
            });
        }
    }));

    // Sign Out Command
    context.subscriptions.push(vscode.commands.registerCommand('leethelp.signOut', async () => {
        await api.deleteCookie();
        vscode.window.showInformationMessage('Successfully signed out.');
        treeProvider.refresh();
    }));

    // ==================== Auth Status Command ====================
    context.subscriptions.push(vscode.commands.registerCommand('leethelp.authStatus', async () => {
        if (!api.isLoggedIn()) {
            vscode.window.showWarningMessage('LeetHelp: Not signed in.', 'Sign In').then(selection => {
                if (selection === 'Sign In') {
                    vscode.commands.executeCommand('leethelp.signIn');
                }
            });
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Checking auth status...',
            cancellable: false
        }, async () => {
            const result = await api.verifyAuth();
            const sessionAge = api.getSessionAge();
            
            if (result.valid) {
                let ageStr = 'Never verified';
                if (sessionAge) {
                    if (sessionAge.days > 0) {
                        ageStr = `${sessionAge.days}d ${sessionAge.hours}h ago`;
                    } else {
                        ageStr = `${sessionAge.hours}h ago`;
                    }
                }
                
                vscode.window.showInformationMessage(
                    `✅ LeetHelp Auth Status\n` +
                    `User: ${result.username}\n` +
                    `Last verified: ${ageStr}\n` +
                    `Status: Valid`
                );
            } else {
                vscode.window.showErrorMessage(
                    `❌ LeetHelp: Auth invalid - ${result.error}`,
                    'Sign In'
                ).then(selection => {
                    if (selection === 'Sign In') {
                        vscode.commands.executeCommand('leethelp.signIn');
                    }
                });
            }
        });
    }));

    // ==================== Daily Question Command ====================
    context.subscriptions.push(vscode.commands.registerCommand('leethelp.dailyQuestion', async () => {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Fetching daily question...',
            cancellable: false
        }, async () => {
            try {
                const daily = await api.getDailyQuestion();
                const question: Question = daily.question;
                
                // Open it like any other problem
                vscode.commands.executeCommand('leethelp.openProblem', question);
            } catch (error: any) {
                api.log(`Error fetching daily question: ${error.message}`);
                vscode.window.showErrorMessage('Failed to fetch daily question. Check Output panel.');
            }
        });
    }));

    // Open Problem Command
    context.subscriptions.push(vscode.commands.registerCommand('leethelp.openProblem', async (question: Question) => {
        try {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Fetching ${question.title}...`,
                cancellable: false
            }, async (progress) => {
                const api = LeetCodeApi.getInstance();
                const detailedQuestion = await api.getProblemDetail(question.titleSlug);

                // 1. Open Description Webview
                LeetCodeWebview.createOrShow(context.extensionUri, detailedQuestion);

                // 2. Create Code Snippet
                // Default to Python3 or C++ or get from settings. For now user picker.
                const languages = detailedQuestion.codeSnippets.map(s => s.lang);
                const selectedLang = await vscode.window.showQuickPick(languages, {
                    placeHolder: 'Select Language to Code'
                });

                if (selectedLang) {
                    const snippet = detailedQuestion.codeSnippets.find(s => s.lang === selectedLang);
                    if (snippet) {
                        // Create file
                        const workspaceFolders = vscode.workspace.workspaceFolders;
                        const rootPath = workspaceFolders ? workspaceFolders[0].uri.fsPath : '/tmp';
                        const ext = getExtension(snippet.langSlug);
                        if (!/^[a-z0-9-]+$/.test(question.titleSlug)) {
                            vscode.window.showErrorMessage('Invalid problem slug: Potential path traversal detected.');
                            return;
                        }
                        const fileName = `${question.titleSlug}${ext}`;
                        const filePath = path.join(rootPath, fileName);
                        
                        // Security: Double-check resolved path stays within workspace
                        const resolvedPath = path.resolve(filePath);
                        const resolvedRoot = path.resolve(rootPath);
                        if (!resolvedPath.startsWith(resolvedRoot + path.sep) && resolvedPath !== resolvedRoot) {
                            vscode.window.showErrorMessage('Security error: Path traversal detected.');
                            return;
                        }

                        try {
                            fs.writeFileSync(filePath, snippet.code, { flag: 'wx' });
                        } catch (err: any) {
                            if (err.code !== 'EEXIST') throw err;
                            // File exists, continue to open it
                        }

                        const doc = await vscode.workspace.openTextDocument(filePath);
                        await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
                    }
                }
            });
        } catch (error: any) {
            const api = LeetCodeApi.getInstance();
            api.log(`Error opening problem: ${error.message || error}`);
            vscode.window.showErrorMessage('Error opening problem. Check Output panel for details.');
        }
    }));

    // Run Test Command
    context.subscriptions.push(vscode.commands.registerCommand('leethelp.runTest', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('Open a LeetCode problem file to run.');
            return;
        }

        // Prevent running on Output Channel
        if (editor.document.uri.scheme === 'output') {
            vscode.window.showWarningMessage('Please switch back to your code file before running tests.');
            return;
        }

        try {
            const { slug, lang } = parseFileInfo(editor.document.fileName);
            if (!slug) {
                vscode.window.showErrorMessage('Could not determine problem from filename. Please open a file created by this extension.');
                return;
            }

            vscode.window.showInformationMessage(`Running tests for ${slug}...`);
            const api = LeetCodeApi.getInstance();
            // Fetch detail to get questionId and exampleTestcases
            const detail = await api.getProblemDetail(slug);

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Running Code...',
                cancellable: false
            }, async (progress) => {
                const code = editor.document.getText();
                const dataInput = detail.exampleTestcases;

                const interpretId = await api.runCode(slug, detail.questionId, lang, code, dataInput);

                // Poll for result
                let result: any = { state: 'STARTED' };
                let attempts = 0;
                while ((result.state === 'STARTED' || result.state === 'PENDING') && attempts < 20) {
                    await new Promise(r => setTimeout(r, 1000));
                    result = await api.checkStatus(interpretId);
                    attempts++;
                }

                if (result.state === 'SUCCESS') {
                    // Show Output
                    const outputChannel = vscode.window.createOutputChannel('LeetCode Output');
                    outputChannel.show(true); // Preserve focus

                    try {
                        const statusIcon = result.correct_answer ? '✅' : '❌';
                        const statusText = result.correct_answer ? 'TEST PASSED' : 'TEST FAILED';

                        outputChannel.appendLine('========================================');
                        outputChannel.appendLine(`      ${statusIcon}  ${statusText.padEnd(20)}`);
                        outputChannel.appendLine('========================================');
                        outputChannel.appendLine('');

                        if (dataInput) {
                            outputChannel.appendLine('[Input]');
                            outputChannel.appendLine(typeof dataInput === 'object' ? JSON.stringify(dataInput, null, 2) : dataInput.toString());
                            outputChannel.appendLine('');
                        }

                        if (result.code_answer !== undefined) {
                            outputChannel.appendLine('[Your Output]');
                            outputChannel.appendLine(Array.isArray(result.code_answer) ? JSON.stringify(result.code_answer) : result.code_answer.toString());
                            outputChannel.appendLine('');
                        }

                        if (result.expected_code_answer !== undefined) {
                            outputChannel.appendLine('[Expected Output]');
                            outputChannel.appendLine(Array.isArray(result.expected_code_answer) ? JSON.stringify(result.expected_code_answer) : result.expected_code_answer.toString());
                            outputChannel.appendLine('');
                        }

                        outputChannel.appendLine('========================================');
                    } catch (err: any) {
                        outputChannel.appendLine(`Error formatting output: ${err.message}`);
                        // Security: Only log safe, known fields instead of raw result
                        const safeFields = { state: result.state, status_msg: result.status_msg };
                        outputChannel.appendLine(`Result state: ${JSON.stringify(safeFields)}`);
                    }

                    if (result.correct_answer) {
                        vscode.window.showInformationMessage('Test Passed!');
                    } else {
                        vscode.window.showWarningMessage('Test Finished (Check Output Panel)');
                    }
                } else {
                    vscode.window.showErrorMessage(`Run Failed: ${result.error_msg || result.state || 'Timeout'}`);
                }
            });

        } catch (error: any) {
            if (error.message && (error.message.includes('401') || error.message.includes('403') || error.message.includes('Auth'))) {
                const selection = await vscode.window.showErrorMessage('Session Expired: Please sign in again.', 'Sign In');
                if (selection === 'Sign In') {
                    vscode.commands.executeCommand('leethelp.signIn');
                }
            } else {
                api.log(`Error running code: ${error.message || error}`);
                vscode.window.showErrorMessage('Error running code. Check Output panel for details.');
            }
        }
    }));

    // Submit Command
    context.subscriptions.push(vscode.commands.registerCommand('leethelp.submit', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('Open a LeetCode problem file to submit.');
            return;
        }

        // Prevent running on Output Channel
        if (editor.document.uri.scheme === 'output') {
            vscode.window.showWarningMessage('Please switch back to your code file before submitting.');
            return;
        }

        try {
            const { slug, lang } = parseFileInfo(editor.document.fileName);
            if (!slug) {
                vscode.window.showErrorMessage('Could not determine problem from filename.');
                return;
            }

            vscode.window.showInformationMessage(`Submitting ${slug}...`);
            const api = LeetCodeApi.getInstance();
            const detail = await api.getProblemDetail(slug);

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Submitting Code...',
                cancellable: false
            }, async (progress) => {
                const code = editor.document.getText();
                const submissionId = await api.submit(slug, detail.questionId, lang, code);

                let result: any = { state: 'STARTED' };
                let attempts = 0;
                while ((result.state === 'STARTED' || result.state === 'PENDING') && attempts < 20) {
                    await new Promise(r => setTimeout(r, 1000));
                    result = await api.checkStatus(submissionId);
                    attempts++;
                }

                if (result.state === 'SUCCESS') {
                    vscode.window.showInformationMessage(`Submission Status: ${result.status_msg}`);

                    const outputChannel = vscode.window.createOutputChannel('LeetCode Output');
                    outputChannel.show(true); // Preserve focus
                    try {
                        outputChannel.appendLine('========================================');
                        outputChannel.appendLine('          SUBMISSION RESULT             ');
                        outputChannel.appendLine('========================================');
                        outputChannel.appendLine(`Status: ${result.status_msg}`);
                        outputChannel.appendLine(`Passed: ${result.total_correct}/${result.total_testcases} test cases`);

                        if (result.status_msg === 'Accepted') {
                            if (result.status_runtime) {
                                outputChannel.appendLine(`Runtime: ${result.status_runtime}`);
                            }
                            if (result.status_memory) {
                                outputChannel.appendLine(`Memory:  ${result.status_memory}`);
                            }
                            
                            // ==================== Git Auto-Commit on AC ====================
                            await autoCommitOnAccepted(editor.document, detail, lang);
                            
                            // ==================== Local History ====================
                            addToHistory({
                                id: parseInt(detail.questionId, 10),
                                title: detail.title,
                                titleSlug: detail.titleSlug,
                                lang: lang,
                                status: 'AC',
                                timestamp: new Date().toISOString()
                            });
                        }

                        // Check if runtime_percentile exists and is a number
                        if (typeof result.runtime_percentile === 'number') {
                            outputChannel.appendLine(`Beats:   ${result.runtime_percentile.toFixed(2)}% of users`);
                        }

                        outputChannel.appendLine('========================================');
                    } catch (err: any) {
                        outputChannel.appendLine(`Error formatting output: ${err.message}`);
                        // Security: Only log safe, known fields instead of raw result
                        const safeFields = { state: result.state, status_msg: result.status_msg };
                        outputChannel.appendLine(`Result state: ${JSON.stringify(safeFields)}`);
                    }

                } else {
                    vscode.window.showErrorMessage(`Submission Failed: ${result.error_msg || result.state || 'Timeout'}`);
                }
            });
        } catch (error: any) {
            if (error.message && (error.message.includes('401') || error.message.includes('403') || error.message.includes('Auth'))) {
                const selection = await vscode.window.showErrorMessage('Session Expired: Please sign in again.', 'Sign In');
                if (selection === 'Sign In') {
                    vscode.commands.executeCommand('leethelp.signIn');
                }
            } else {
                api.log(`Error submitting code: ${error.message || error}`);
                vscode.window.showErrorMessage('Error submitting code. Check Output panel for details.');
            }
        }
    }));
}

function parseFileInfo(fileName: string): { slug: string, lang: string } {
    const baseName = path.basename(fileName);
    const ext = path.extname(fileName);
    const slug = baseName.replace(ext, '');

    // Reverse map extension to lang slug
    let lang = '';
    if (ext === '.cpp') lang = 'cpp';
    else if (ext === '.java') lang = 'java';
    else if (ext === '.js') lang = 'javascript';
    else if (ext === '.ts') lang = 'typescript';
    else if (ext === '.go') lang = 'golang';
    else if (ext === '.py') lang = 'python3';

    // Fallback or error?
    // If unknown, default to python3 as before BUT audit said "unknown extensions silently default to python3" is a Medium issue.
    // So we should probably handle it or default to something safe? 
    // Actually the audit said " trusts filename completely; unknown extensions silently default to python3."
    // If we return 'python3' for .txt, it might try to run python.
    // I will checking if lang is empty.
    if (!lang) {
        // We can throw or return a default that explicitly fails?
        // Let's default to python3 but ONLY if it looks like a python file? No, that's what we just checked.
        // I will return 'unknown' and handle it or just let API fail?
        // 'python3' is the leetcode slug.
        // Let's just return 'python3' for now but only if extension is .py.
        // Wait, I already added checks. If it falls through, lang is ''.
        // I will return 'python3' as a safe default for now to avoid breaking existing workflow if user creates manual files, 
        // BUT strict strictness would mean throwing error.
        // Let's return '' and check in caller.
        throw new Error('Unsupported file extension');
    }

    return { slug, lang };
}

function getExtension(langSlug: string): string {
    const map: Record<string, string> = {
        'cpp': '.cpp',
        'java': '.java',
        'python3': '.py',
        'python': '.py',
        'c': '.c',
        'csharp': '.cs',
        'javascript': '.js',
        'typescript': '.ts',
        'golang': '.go',
        'ruby': '.rb',
        'swift': '.swift',
        'kotlin': '.kt',
        'scala': '.scala',
        'rust': '.rs',
        'php': '.php'
    };
    return map[langSlug] || '.txt';
}

export function deactivate() { }
