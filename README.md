# LeetHelp

**LeetHelp** is a VS Code extension that allows you to solve LeetCode problems directly within your editor. Browse problems, run tests, and submit solutions without leaving VS Code.

## Features

- **Problem Browser**: View and search all LeetCode problems.
- **CodeLens Integration**: "Run Test" and "Submit" buttons directly in your code files.
- **Test & Submit**: Run custom test cases and submit your solutions to LeetCode.
- **Multi-language Support**: Supports Python, C++, Java, JavaScript, TypeScript, Go, and more.

## Installation

1. Install the extension from the VS Code Marketplace (coming soon) or build from source.
2. Open the "LeetCode" view in the Activity Bar.

## Authentication (Login)

LeetCode does not provide a public API for authentication, so **LeetHelp** uses your browser's session cookie to authenticate.

### How to Login

1. Open [LeetCode](https://leetcode.com) in your browser (Chrome) and sign in.
2. Open Developer Tools (Right-click -> Inspect, or F12).
3. Go to the **Network** tab.
4. Click on any request to `leetcode.com` (e.g., `graphql` or `all`).
5. In the **Request Headers** section, find the `Cookie` header.
6. Copy the entire value of the `Cookie` header.
   - *Note: It should look like `csrftoken=...; LEETCODE_SESSION=...; ...`*
7. In VS Code, open the Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`).
8. Run the command: **LeetHelp: Sign In**.
9. Paste the copied cookie string into the input box and press Enter.

> **Security Note**: Your cookie is stored securely using VS Code's native **SecretStorage** API, which encrypts data using your operating system's keychain (e.g., macOS Keychain, Windows Credential Manager). It is **not** stored in plain text in your settings files.

## Security

We take your security seriously:
- **Encrypted Storage**: Your LeetCode cookie is **encrypted** using your operating system's built-in password manager (macOS Keychain, Windows Credential Manager, or Linux Secret Service). It is **never** saved in plain text.
- **Secure Connections**: All communication with LeetCode uses **HTTPS** encryption.
- **XSS Protection**: Problem descriptions are sanitized to prevent malicious code injection.
- **Input Validation**: All data is validated before being used to prevent injection attacks.

## Usage

1. **Search**: Click the search icon in the LeetHelp view or run **LeetHelp: Search Problem**.
2. **Open**: Select a problem to open its description and create a code file.
3. **Code**: Write your solution in the generated file.
4. **Test**: Click **Run Test** or run **LeetHelp: Run Test** to verify your solution with example cases.
5. **Submit**: Click **Submit** or run **LeetHelp: Submit** to submit to LeetCode.

## Building from Source

```bash
# Clone the repository
git clone https://github.com/sidkm18/LeetHelper.git
cd LeetHelper

# Install dependencies
npm install

# Compile
npm run compile

# Package (optional)
npx vsce package
```

## Dependencies

### Runtime
- **axios**: HTTP client for LeetCode API requests
- **isomorphic-dompurify**: HTML sanitization for security

### Development
- **typescript**: TypeScript compiler
- **@types/vscode**: VS Code API type definitions

---

Created with ❤️ by [Sidharth](https://github.com/sidkm18)
