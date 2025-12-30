# Changelog

## [1.1.0] - 2024-12-30

### Added

- **18 Language Support**: Python, C++, C, C#, Java, JavaScript, TypeScript, Go, Ruby, Rust, PHP, Swift, Kotlin, Scala, Dart, Elixir, Erlang, Racket
- **Smart Custom Test Cases**: Failed tests auto-save and merge with example tests in a single API request (no rate limiting)
- **Format Code Button**: LeetCode-style formatting (tabs → 4 spaces, whitespace cleanup)
- **Start Coding Button**: Quick language selector in problem description
- **Failing Test Details**: Shows which test case failed with input/output comparison
- **Clear Tests Prompt**: Option to clear custom tests when all pass

### Changed

- `LeetHelp: Custom Test Cases` → `LeetHelp: Manage Saved Tests`
- Professional UI: Removed emojis, cleaner output formatting
- Test output now shows breakdown: `Tests: 3 total (Examples + 1 custom)`

### Fixed

- Custom test cases now stored in memory (session-based, clears on restart)
- File extension mapping for all 18 languages

## [1.0.2] - Initial Release

- Basic LeetCode integration
- Run Test and Submit functionality
- Cookie-based authentication
- Git auto-commit on accepted solutions
