"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeetCodeTreeProvider = void 0;
const vscode = require("vscode");
const leetcodeApi_1 = require("./leetcodeApi");
class LeetCodeTreeProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
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
        }
        else {
            treeItem.iconPath = new vscode.ThemeIcon('circle-outline');
        }
        return treeItem;
    }
    async getChildren(element) {
        if (element) {
            return []; // No children for questions
        }
        try {
            const api = leetcodeApi_1.LeetCodeApi.getInstance();
            const problems = await api.getProblems(100, 0); // basic fetch - increased to 100
            return problems;
        }
        catch (error) {
            const api = leetcodeApi_1.LeetCodeApi.getInstance();
            api.log(`TreeProvider Error: ${error.message}`);
            vscode.window.showErrorMessage('Failed to load problems. Check the "LeetCode Output" channel for details.');
            return [];
        }
    }
}
exports.LeetCodeTreeProvider = LeetCodeTreeProvider;
//# sourceMappingURL=treeProvider.js.map