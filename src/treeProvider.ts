import * as vscode from 'vscode';
import { LeetCodeApi, Question } from './leetcodeApi';

// Extend Question or create a new type to handle the "Sign In" item
interface TreeItemElement extends Partial<Question> {
    isSignIn?: boolean;
    label?: string;
}

export class LeetCodeTreeProvider implements vscode.TreeDataProvider<TreeItemElement> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeItemElement | undefined | null | void> = new vscode.EventEmitter<TreeItemElement | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeItemElement | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor() { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TreeItemElement): vscode.TreeItem {
        if (element.isSignIn) {
            const treeItem = new vscode.TreeItem(element.label || 'Sign In', vscode.TreeItemCollapsibleState.None);
            treeItem.command = {
                command: 'leethelp.signIn',
                title: 'Sign In'
            };
            treeItem.iconPath = new vscode.ThemeIcon('sign-in');
            treeItem.tooltip = 'Click to sign in with your LeetCode cookie';
            return treeItem;
        }

        const q = element as Question;
        const treeItem = new vscode.TreeItem(q.title, vscode.TreeItemCollapsibleState.None);
        treeItem.command = {
            command: 'leethelp.openProblem',
            title: 'Open Problem',
            arguments: [q]
        };
        treeItem.description = q.difficulty;
        treeItem.tooltip = `${q.title}\nDifficulty: ${q.difficulty}\nStatus: ${q.status || 'Todo'}`;

        // Icon based on status or difficulty
        if (q.status === 'ac') {
            treeItem.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
        } else {
            treeItem.iconPath = new vscode.ThemeIcon('circle-outline');
        }

        return treeItem;
    }

    async getChildren(element?: TreeItemElement): Promise<TreeItemElement[]> {
        if (element) {
            return []; // No children for questions
        }

        const api = LeetCodeApi.getInstance();
        if (!api.isLoggedIn()) {
            return [{ isSignIn: true, label: 'Sign In to LeetCode' }];
        }

        try {
            const api = LeetCodeApi.getInstance();
            const problems = await api.getProblems(100, 0); // basic fetch - increased to 100
            return problems;
        } catch (error: any) {
            const api = LeetCodeApi.getInstance();
            api.log(`TreeProvider Error: ${error.message}`);

            // Check for potential auth error in message or status if explicitly thrown
            if (error.message.includes('401') || error.message.includes('403') || error.message.includes('Auth')) {
                return [{ isSignIn: true, label: 'Session Expired - Click to Sign In' }];
            }

            vscode.window.showErrorMessage('Failed to load problems. Check the "LeetCode Output" channel for details.');
            return [];
        }
    }
}
