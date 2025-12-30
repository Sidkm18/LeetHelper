import * as vscode from 'vscode';
import { QuestionDetail } from './leetcodeApi';
import DOMPurify from 'isomorphic-dompurify';

// Allowlist for difficulty values to prevent CSS class injection
const ALLOWED_DIFFICULTIES = ['easy', 'medium', 'hard'];
function getSafeDifficulty(difficulty: string): string {
    const lower = difficulty.toLowerCase();
    return ALLOWED_DIFFICULTIES.includes(lower) ? lower : 'unknown';
}

export class LeetCodeWebview {
    public static currentPanel: LeetCodeWebview | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _question: QuestionDetail | undefined;

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Listen for messages from webview
        this._panel.webview.onDidReceiveMessage(message => {
            if (message.command === 'startCoding') {
                vscode.commands.executeCommand('leethelp.openProblem', this._question);
            }
        }, null, this._disposables);
    }

    public static createOrShow(extensionUri: vscode.Uri, question: QuestionDetail) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it.
        if (LeetCodeWebview.currentPanel) {
            LeetCodeWebview.currentPanel._panel.reveal(column);
            LeetCodeWebview.currentPanel.update(question);
            return;
        }

        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(
            'leetcodeDescription',
            `LeetCode: ${question.title}`,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'resources')]
            }
        );

        LeetCodeWebview.currentPanel = new LeetCodeWebview(panel, extensionUri);
        LeetCodeWebview.currentPanel.update(question);
    }

    public update(question: QuestionDetail) {
        this._question = question;
        this._panel.title = `LeetCode: ${question.title}`;
        this._panel.webview.html = this._getHtmlForWebview(question);
    }

    public dispose() {
        LeetCodeWebview.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _getHtmlForWebview(question: QuestionDetail) {
        const questionJson = JSON.stringify({
            titleSlug: question.titleSlug,
            questionId: question.questionId,
            title: question.title
        });

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https://leetcode.com https://assets.leetcode.com; script-src 'unsafe-inline';">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${DOMPurify.sanitize(question.title, { ALLOWED_TAGS: [] })}</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    padding: 20px;
                    line-height: 1.6;
                }
                h1 {
                    font-size: 1.5em;
                    margin-bottom: 0.5em;
                    color: var(--vscode-editor-foreground);
                }
                .meta {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 20px;
                    font-size: 0.9em;
                }
                .difficulty {
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-weight: 600;
                    text-transform: capitalize;
                }
                .difficulty.easy { color: #00b8a3; background: rgba(0, 184, 163, 0.1); }
                .difficulty.medium { color: #ffc01e; background: rgba(255, 192, 30, 0.1); }
                .difficulty.hard { color: #ff375f; background: rgba(255, 55, 95, 0.1); }
                
                hr {
                    border: none;
                    border-top: 1px solid var(--vscode-widget-border);
                    margin: 20px 0;
                }
                
                /* Content Styling */
                code {
                    font-family: var(--vscode-editor-font-family);
                    background-color: var(--vscode-textCodeBlock-background);
                    padding: 2px 4px;
                    border-radius: 3px;
                }
                pre {
                    background-color: var(--vscode-textCodeBlock-background);
                    padding: 12px;
                    border-radius: 6px;
                    overflow-x: auto;
                    border: 1px solid var(--vscode-widget-border);
                }
                pre code {
                    background-color: transparent;
                    padding: 0;
                }
                
                ul, ol { padding-left: 20px; }
                li { margin-bottom: 4px; }
                
                .button-container {
                    margin-top: 40px;
                    padding-top: 30px;
                    border-top: 1px solid var(--vscode-widget-border);
                    display: flex;
                    justify-content: center;
                }
                
                .start-button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 24px;
                    border-radius: 2px;
                    cursor: pointer;
                    font-size: 0.95em;
                    font-weight: 500;
                    letter-spacing: 0.5px;
                    transition: all 0.15s ease;
                    font-family: var(--vscode-font-family);
                }
                
                .start-button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                    transform: translateY(-1px);
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                }
                
                .start-button:active {
                    transform: translateY(0);
                }
            </style>
        </head>
        <body>
            <h1>${DOMPurify.sanitize(question.questionId, { ALLOWED_TAGS: [] })}. ${DOMPurify.sanitize(question.title, { ALLOWED_TAGS: [] })}</h1>
            <div class="meta">
                <span class="difficulty ${getSafeDifficulty(question.difficulty)}">${DOMPurify.sanitize(question.difficulty, { ALLOWED_TAGS: [] })}</span>
            </div>
            <hr/>
            <div class="content">${DOMPurify.sanitize(question.content, {
            ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 'code', 'pre', 'ul', 'ol', 'li', 'sup', 'sub', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'h1', 'h2', 'h3', 'h4', 'span', 'div', 'font'],
            ALLOWED_ATTR: ['src', 'alt', 'class', 'style', 'colspan', 'rowspan'],
            ALLOW_DATA_ATTR: false
        })}</div>
            <div class="button-container">
                <button class="start-button" onclick="startCoding()">Start Coding</button>
            </div>
            <script>
                const vscode = acquireVsCodeApi();
                const questionData = ${questionJson};
                
                function startCoding() {
                    vscode.postMessage({ command: 'startCoding' });
                }
            </script>
        </body>
        </html>`;
    }
}
