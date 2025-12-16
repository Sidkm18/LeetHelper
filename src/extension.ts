import * as vscode from 'vscode';
import { LeetCodeTreeProvider } from './treeProvider';
import { LeetCodeApi, Question } from './leetcodeApi';
import { LeetCodeWebview } from './webviewPanel';
import * as path from 'path';
import * as fs from 'fs';
import { LeetCodeCodeLensProvider } from './codelensProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('LeetHelp is now active!');

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
            } catch (error) {
                vscode.window.showErrorMessage(`Search failed: ${error}`);
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
            // Update configuration immediately to test it
            await vscode.workspace.getConfiguration('leethelp').update('sessionCookie', session, true);

            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Verifying Session...',
                cancellable: false
            }, async () => {
                const api = LeetCodeApi.getInstance();
                const user = await api.getUser();

                if (user) {
                    vscode.window.showInformationMessage(`Successfully signed in as ${user.username}!`);
                    treeProvider.refresh();
                } else {
                    vscode.window.showErrorMessage('Login failed. Please check your cookie and try again.');
                    // Optionally clear the invalid cookie, but better to let them retry or keep it if it was a minor typo they can fix manually in settings
                }
            });
        }
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
                        const fileName = `${question.titleSlug}${ext}`;
                        const filePath = path.join(rootPath, fileName);

                        if (!fs.existsSync(filePath)) {
                            fs.writeFileSync(filePath, snippet.code);
                        }

                        const doc = await vscode.workspace.openTextDocument(filePath);
                        await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
                    }
                }
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Error opening problem: ${error}`);
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

            vscode.window.withProgress({
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
                        outputChannel.appendLine(`Raw Result: ${JSON.stringify(result, null, 2)}`);
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

        } catch (error) {
            vscode.window.showErrorMessage(`Error running code: ${error}`);
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

            vscode.window.withProgress({
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
                        }

                        // Check if runtime_percentile exists and is a number
                        if (typeof result.runtime_percentile === 'number') {
                            outputChannel.appendLine(`Beats:   ${result.runtime_percentile.toFixed(2)}% of users`);
                        }

                        outputChannel.appendLine('========================================');
                    } catch (err: any) {
                        outputChannel.appendLine(`Error formatting output: ${err.message}`);
                        outputChannel.appendLine(`Raw Result: ${JSON.stringify(result, null, 2)}`);
                    }

                } else {
                    vscode.window.showErrorMessage(`Submission Failed: ${result.error_msg || result.state || 'Timeout'}`);
                }
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Error submitting code: ${error}`);
        }
    }));
}

function parseFileInfo(fileName: string): { slug: string, lang: string } {
    const baseName = path.basename(fileName);
    const ext = path.extname(fileName);
    const slug = baseName.replace(ext, '');

    // Reverse map extension to lang slug
    let lang = 'python3';
    if (ext === '.cpp') lang = 'cpp';
    if (ext === '.java') lang = 'java';
    if (ext === '.js') lang = 'javascript';
    if (ext === '.ts') lang = 'typescript';
    if (ext === '.go') lang = 'golang';

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
