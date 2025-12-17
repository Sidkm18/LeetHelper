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

1. Open [leetcode.com](https://leetcode.com) and sign in
2. Open DevTools → Network tab → click any request(like GraphQL)
3. Copy the full `Cookie` header value
4. In VS Code: `Cmd+Shift+P` → **LeetHelp: Sign In** → paste

> Your cookie is stored securely in your OS keychain (never in plain text).

### 2. Solve

- **Daily Question**: Click 📅 in the LeetCode sidebar (or `LeetHelp: Open Daily Question`)
- **Search**: Click 🔍 or `LeetHelp: Search Problem`
- **Test**: Click **Run Test** CodeLens above your code
- **Submit**: Click **Submit** CodeLens

### 3. Auto-Features

- **Git auto-commit**: Accepted solutions are automatically committed as `LC: 238. Product of Array Except Self [Java]`
- **Local history**: All submissions saved to `leethelp-history.json`
- **Auth health check**: Warns you when session expires

## Commands

| Command | Description |
|---------|-------------|
| `LeetHelp: Sign In` | Authenticate with cookie |
| `LeetHelp: Sign Out` | Clear session |
| `LeetHelp: Auth Status` | Check login status |
| `LeetHelp: Open Daily Question` | Today's problem |
| `LeetHelp: Search Problem` | Find any problem |
| `LeetHelp: Run Test` | Test with examples |
| `LeetHelp: Submit` | Submit to LeetCode |

## Build from Source

```bash
# Clone the repository
git clone https://github.com/sidkm18/LeetHelper.git
cd LeetHelper

# Install dependencies
npm install

# Compile
npm run compile
# Press F5 in VS Code to run
```

---

Created with ❤️ by [Sidharth](https://github.com/sidkm18)
