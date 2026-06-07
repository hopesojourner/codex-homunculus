# Changelog

All notable changes to Codex Homunculus are documented here.

The format follows the spirit of Keep a Changelog, and this project uses the
plugin/package version from `plugins/codex-homunculus/package.json`.

## [0.5.0] - 2026-05-29

### Added

- GitHub Actions CI for Ubuntu and Windows with Node.js 20.
- Windows PowerShell wrappers for direct CLI use and wrapped Codex sessions.
- `npm run ci` to run syntax checks, smoke tests, state validation, and package dry-run.
- Package metadata for repository, homepage, bugs, author, and keywords.
- Smoke-test coverage for missing CLI option values, malformed imports, exact-domain instinct matching, and irrelevant instinct filtering.

### Changed

- Generated `AGENTS.md` bootstrap instructions now default to the installed CLI script path instead of a repo-relative command.
- README and skill docs now show both PowerShell-first Windows commands and POSIX shell equivalents.
- POSIX entry scripts and the pre-commit privacy guard are executable.
- Plugin metadata now points to `hopesojourner/codex-homunculus`.
- PowerShell and Command Prompt wrappers now share plugin-root fallback behavior and wrapped-session failure handling.

### Fixed

- `apply` no longer returns unrelated high-confidence instincts with no domain or token overlap.
- Missing values for options such as `--root`, `--output`, and `--context` now fail cleanly instead of being treated as `true`.
- Malformed import bundles now fail with clear errors instead of creating invalid instincts or throwing raw stack traces.
- The `.cmd` wrapper now checks the adjacent plugin root before falling back to marketplace-style paths.
- The PowerShell CLI wrapper now restores temporary environment defaults before exiting.
