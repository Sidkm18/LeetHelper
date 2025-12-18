# LeetHelp

**LeetHelp** is a VS Code extension that allows you to solve LeetCode problems directly within your editor. Browse problems, run tests, and submit solutions without leaving VS Code.

## Features

- **Problem Browser**: View and search all LeetCode problems.
- **CodeLens Integration**: "Run Test" and "Submit" buttons directly in your code files.
- **Test & Submit**: Run custom test cases and submit your solutions to LeetCode.
- **Multi-language Support**: Supports Python, C++, Java, JavaScript, TypeScript, Go, and more.
- **Auto code normalization**: Before Run/Submit, code is normalized to match LeetCode's "Format" behavior (tabs → 4 spaces, normalize newlines, trim trailing spaces, collapse extra blank lines, ensure single trailing newline).
- **Cookie diagnostics**: Clear Cloudflare/CSRF error messages and a cookie verification command to validate your session.

## Installation

1. Install the extension from the VS Code Marketplace (coming soon) or build from source.
2. Open the "LeetCode" view in the Activity Bar.

## Authentication (Login)

LeetCode does not provide a public API for authentication, so **LeetHelp** uses your browser's session cookie to authenticate.

### How to Login

1. Open [leetcode.com](https://leetcode.com) and sign in
2. Open DevTools → Network tab → click any request (like GraphQL)
3. Copy the full `Cookie` header value (not individual cookies)
4. In VS Code: `Cmd+Shift+P` → **LeetHelp: Sign In** → paste

> Your cookie is stored securely in your OS keychain (never in plain text).

### Cookie requirements

For reliable access, your Cookie must include all of the following:

- `cf_clearance`: Cloudflare clearance token (expires periodically)
- `LEETCODE_SESSION`: your authenticated session
- `csrftoken`: used for CSRF validation

Tips:
- Always copy the full `Cookie` header value from DevTools after the page fully loads (wait past any "Just a moment…" Cloudflare screen).
- If you get 403 errors while searching/running/submitting, re-copy a fresh cookie — `cf_clearance` likely expired.

### 2. Solve

- **Daily Question**: Click 📅 in the LeetCode sidebar (or `LeetHelp: Open Daily Question`)
- **Search**: Click 🔍 or `LeetHelp: Search Problem` (403 during search? Refresh your cookie: `cf_clearance` likely expired.)
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
| `LeetHelp: Verify Cookie` | Validate stored cookie and show diagnostics |
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
