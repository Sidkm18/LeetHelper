import * as vscode from 'vscode';
import { LeetCodeApi, Question } from './leetcodeApi';

export class LeetCodeTreeProvider implements vscode.TreeDataProvider<Question> {
    private _onDidChangeTreeData: vscode.EventEmitter<Question | undefined | null | void> = new vscode.EventEmitter<Question | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<Question | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor() { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: Question): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(element.title, vscode.TreeItemCollapsibleState.None);
        treeItem.command = {
            command: 'leethelp.openProblem',
            title: 'Open Problem',
            arguments: [element]
        };
        treeItem.description = element.difficulty;
        treeItem.tooltip = `${element.title}\nDifficulty: ${element.difficulty}\nStatus: ${element.status || 'Todo'}`;

        // Icon based on status or difficulty
        if (element.status === 'ac') {
            treeItem.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
        } else {
            treeItem.iconPath = new vscode.ThemeIcon('circle-outline');
        }

        return treeItem;
    }

    async getChildren(element?: Question): Promise<Question[]> {
        if (element) {
            return []; // No children for questions
        }

        try {
            const api = LeetCodeApi.getInstance();
            const problems = await api.getProblems(100, 0); // basic fetch - increased to 100
            return problems;
        } catch (error: any) {
            const api = LeetCodeApi.getInstance();
            api.log(`TreeProvider Error: ${error.message}`);
            vscode.window.showErrorMessage('Failed to load problems. Check the "LeetCode Output" channel for details.');
            return [];
        }
    }
}
