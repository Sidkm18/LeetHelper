# LeetHelp

Solve LeetCode problems directly in VS Code. No browser switching.

## Quick Start

### 1. Login

LeetHelp uses your browser's session cookie to authenticate.

1. Open [leetcode.com](https://leetcode.com) and sign in
2. Open DevTools → Network tab → click any request
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
git clone https://github.com/sidkm18/LeetHelper.git
cd LeetHelper
npm install
npm run compile
# Press F5 in VS Code to run
```

---

Built by [Sidharth](https://github.com/sidkm18)
