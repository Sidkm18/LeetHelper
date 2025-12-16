# How to Package and Install

This guide explains how to package the LeetCode IDE extension into a `.vsix` file and install it in VS Code suitable for non-development environments.

## Prerequisites

-   Install [Node.js](https://nodejs.org/) (which includes `npm`).
-   Install `vsce` (Visual Studio Code Extensions tool) globally:
    ```bash
    npm install -g @vscode/vsce
    ```

## 1. Package the Extension

1.  Open a terminal in the project root folder.
2.  Run the packaging command:
    ```bash
    vsce package
    ```
3.  This will create a file named `leetcode-ide-0.0.1.vsix` (version may vary).

## 2. Install in VS Code

1.  Open VS Code.
2.  Go to the **Extensions** view (`Cmd+Shift+X` or `Ctrl+Shift+X`).
3.  Click the "..." (Views and More Actions) menu at the top right of the Extensions pane.
4.  Select **Install from VSIX...**.
5.  Browse and select the `leetcode-ide-0.0.1.vsix` file you just created.
6.  Reload VS Code.

## 3. Usage without Dev Mode

Once installed, you don't need to run "Start Debugging" anymore. The "LeetCode" icon will appear in your Activity Bar automatically every time you open VS Code.
