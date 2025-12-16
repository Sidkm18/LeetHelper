import * as vscode from 'vscode';

/**
 * Provides CodeLens for LeetCode files (Run Test | Submit)
 */
export class LeetCodeCodeLensProvider implements vscode.CodeLensProvider {

    public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
        const lenses: vscode.CodeLens[] = [];
        const text = document.getText();

        // Regex to find "class Solution" (common in Python, Java, C++, JS/TS)
        // or just match the first line if it's a script.
        // For robustness, let's look for the class definition which LeetCode uses for most languages.
        // Python: class Solution:
        // C++: class Solution {
        // Java: class Solution {
        // JS/TS: var Solution = ... or class Solution

        // Simple regex for "class Solution" or "object Solution" (Scala)
        const classRegex = /class\s+Solution/g;
        let match;

        // Find all matches (though usually just one)
        while ((match = classRegex.exec(text)) !== null) {
            const line = document.lineAt(document.positionAt(match.index).line);
            const range = new vscode.Range(line.lineNumber, 0, line.lineNumber, 0);

            // Command: Run Test
            const runCmd: vscode.Command = {
                title: '$(play) Run Test',
                command: 'leethelp.runTest',
                tooltip: 'Run example test cases'
            };
            lenses.push(new vscode.CodeLens(range, runCmd));

            // Command: Submit
            const submitCmd: vscode.Command = {
                title: '$(cloud-upload) Submit',
                command: 'leethelp.submit',
                tooltip: 'Submit validation to LeetCode'
            };
            lenses.push(new vscode.CodeLens(range, submitCmd));
        }

        return lenses;
    }
}
