"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeetCodeWebview = void 0;
const vscode = require("vscode");
class LeetCodeWebview {
    constructor(panel, extensionUri) {
        this._disposables = [];
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }
    static createOrShow(extensionUri, question) {
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
        const panel = vscode.window.createWebviewPanel('leetcodeDescription', `LeetCode: ${question.title}`, column || vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'resources')]
        });
        LeetCodeWebview.currentPanel = new LeetCodeWebview(panel, extensionUri);
        LeetCodeWebview.currentPanel.update(question);
    }
    update(question) {
        this._panel.title = `LeetCode: ${question.title}`;
        this._panel.webview.html = this._getHtmlForWebview(question);
    }
    dispose() {
        LeetCodeWebview.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
    _getHtmlForWebview(question) {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${question.title}</title>
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
            </style>
        </head>
        <body>
            <h1>${question.questionId}. ${question.title}</h1>
            <div class="meta">
                <span class="difficulty ${question.difficulty.toLowerCase()}">${question.difficulty}</span>
            </div>
            <hr/>
            <div class="content">${question.content}</div>
        </body>
        </html>`;
    }
}
exports.LeetCodeWebview = LeetCodeWebview;
//# sourceMappingURL=webviewPanel.js.map