# LeetHelp

LeetHelp is a VS Code extension that brings the power of LeetCode directly to your editor. Easily browse problems, run tests, and submit solutions—all within VS Code.

## Features

- **Explore Problems:** View and search LeetCode's entire problem set.
- **CodeLens Integration:** Add "Run Test" and "Submit" buttons directly in your code.
- **Seamless Testing and Submission:** Test custom cases and submit solutions effortlessly.
- **Support for Multiple Languages:** Works with Python, C++, Java, JavaScript, TypeScript, Go, and more.
- **Code Normalization:** Automatically formats code for LeetCode compatibility, including tabs, newlines, trailing spaces, and blank line adjustments.
- **Cookie Diagnostics:** Identify and fix Cloudflare/CSRF issues with detailed diagnostics.

## Getting Started

### Installation

- Install the extension from the VS Code Marketplace (coming soon)
- Or, build it from source (instructions below).

### Authentication (Login)

LeetCode doesn’t offer a public authentication API. LeetHelp uses your browser’s session cookie to log in:

#### Steps:

1. Sign in to [LeetCode](https://leetcode.com).
2. Open DevTools → Network tab, and select any request (e.g., GraphQL).
3. Copy the entire `Cookie` header value.
4. Open Command Palette in VS Code: `Cmd+Shift+P` → **LeetHelp: Sign In** → Paste the cookie.

> Your session cookie is securely encrypted in your OS keychain.

#### Valid Cookie Components:

Ensure your cookie includes:

- `cf_clearance`: Cloudflare validation token.
- `LEETCODE_SESSION`: Identifies your session.
- `csrftoken`: Necessary for CSRF protection.

> To avoid errors, re-copy cookies when `cf_clearance` expires.

## Solving Problems

1. **Daily Problem:** Choose 📅 in the sidebar (or run `LeetHelp: Open Daily Question`).
2. **Search:** Locate problems with 🔍 (`LeetHelp: Search Problem`).
3. **Run Tests:** Use the **Run Test** button above your code.
4. **Submit:** Send solutions with the **Submit** button.

## Integrations

- **Auto Commit:** Automatically commit accepted solutions with messages like ‘LC: <problem-name>’.
- **Local History:** Every submission is logged in `leethelp-history.json`.
- **Session Warnings:** Alerts for expired sessions.

## Commands Reference

| Command                    | Description                                        |
|----------------------------|----------------------------------------------------|
| `LeetHelp: Sign In`        | Authenticate using your LeetCode session cookie.   |
| `LeetHelp: Sign Out`       | Log out and clear session data.                   |
| `LeetHelp: Auth Status`    | Check your current login status.                  |
| `LeetHelp: Verify Cookie`  | Diagnose cookie issues.                           |
| `LeetHelp: Open Daily Question`| Access today’s featured problem.               |
| `LeetHelp: Search Problem` | Search for LeetCode problems.                     |
| `LeetHelp: Run Test`       | Run example test cases in your code.              |
| `LeetHelp: Submit`         | Submit your solution to LeetCode.                 |

## Build and Package

### Prerequisites

- Node.js (LTS recommended)
- VS Code
- Optionally, install `vsce` for packaging.

### Development Environment

```bash
# Clone the repository
git clone https://github.com/Sidkm18/LeetHelper.git
cd LeetHelper

# Install dependencies
npm install

# Compile the extension
npm run compile  # Use `npm run watch` for continuous builds
```

### Debugging in VS Code

1. Press F5 to start debugging with an Extension Development Host.

### Distribute (Build VSIX Package)

```bash
# Package using `npx`
npx @vscode/vsce package

# Or install and run `vsce` globally
npm install -g @vscode/vsce
vsce package
```

This generates `leet-help-<version>.vsix` in the project root.

### Install or Update the Extension in VS Code

```bash
code --install-extension leet-help-<version>.vsix --force
```

---

📌 Created with ❤️ by [Sidharth](https://github.com/Sidkm18)