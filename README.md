# Codex Homunculus

Codex Homunculus is a Codex-native adaptation of Homunculus-style local memory.
It provides a repository-anchored plugin, a triggerable Codex skill, and a
deterministic Node.js CLI for learned instincts, validation, import/export, and
evolution summaries.

This port is explicit CLI and skill driven. It does not depend on Claude Code
hooks or slash commands.

## Layout

```text
.github/workflows/ci.yml
.agents/plugins/marketplace.json
CHANGELOG.md
plugins/codex-homunculus/
  .codex-plugin/plugin.json
  package.json
  scripts/homunculus.mjs
  scripts/codex-homunculus.ps1
  scripts/codex-with-homunculus.ps1
  scripts/smoke-test.mjs
  skills/codex-homunculus/SKILL.md
```

## Verify

PowerShell on Windows:

```powershell
Set-Location plugins\codex-homunculus
npm run ci
```

POSIX shell:

```sh
cd plugins/codex-homunculus
npm run ci
```

`npm run ci` runs syntax checks, the smoke test, state validation, and
`npm pack --dry-run`. The GitHub Actions workflow runs that check on Ubuntu and
Windows with Node.js 20.

## CLI

PowerShell on Windows:

```powershell
Set-Location plugins\codex-homunculus
.\scripts\codex-homunculus.ps1 start
.\scripts\codex-homunculus.ps1 apply --context "repo debugging task"
.\scripts\codex-homunculus.ps1 learn --domain repo-debugging --trigger "user correction" --action "save a narrow instinct"
.\scripts\codex-homunculus.ps1 install-codex-instructions
.\scripts\codex-homunculus.ps1 validate
```

POSIX shell:

```sh
cd plugins/codex-homunculus
./scripts/homunculus.mjs start
./scripts/homunculus.mjs apply --context "repo debugging task"
./scripts/homunculus.mjs learn --domain repo-debugging --trigger "user correction" --action "save a narrow instinct"
./scripts/homunculus.mjs install-codex-instructions
./scripts/homunculus.mjs validate
```

State defaults to the local Homunculus folder at `CODEX_HOME\homunculus` or
`%USERPROFILE%\.codex\homunculus` on Windows, and `CODEX_HOME/homunculus` or
`~/.codex/homunculus` on POSIX. State stays out of the caller's current Git
root unless `CODEX_HOMUNCULUS_DIR` / `--root` explicitly points there.
`CODEX_HOMUNCULUS_HOME` pins the local Homunculus folder, and
`CODEX_HOMUNCULUS_REPO` remains a backward-compatible alias for that setting.

When invoked from another repository, Homunculus still records that caller as
the active project. `identity.json`, observations, and learned instinct
metadata retain source repository details while files remain under the local
Homunculus folder.

The local Homunculus folder is safe to initialize as a normal Git working tree.
The CLI maintains a `.gitignore` block for runtime state, and `validate` fails
if `identity.json`, `observations.jsonl`, `instincts/`, `evolved/`, or
`exports/` are tracked. On POSIX, install `scripts/pre-commit-privacy-guard` as
`.git/hooks/pre-commit` in that local working tree for an extra commit-time
block.

## Codex Automation Boundary

The safest automatic path is instruction-based: this repo includes an `AGENTS.md`
bootstrap block telling Codex to run Homunculus `start` and `apply` at the
beginning of repo tasks, then use `learn` at the end only when there is a
durable lesson worth saving.

Refresh that block from PowerShell:

```powershell
.\plugins\codex-homunculus\scripts\codex-homunculus.ps1 install-codex-instructions
```

Or from POSIX shell:

```sh
./plugins/codex-homunculus/scripts/homunculus.mjs install-codex-instructions
```

By default, `install-codex-instructions` targets the local Homunculus folder's
`AGENTS.md` and embeds the installed CLI script path so the block does not rely
on the caller's repository layout. Use `--print` to inspect the block without
writing. Use `--script-command codex-homunculus` to embed a PATH-based wrapper,
or `--global --yes` / `--target <path> --yes` only after explicitly accepting
the global or external write.

Codex skills can trigger when the user mentions memory, instincts, learning,
prior behavior, or Homunculus automation. Scheduled Codex automations can run
periodic jobs, but they do not hook into every message or tool call. External
wrappers can enforce before/after commands outside Codex, but they cannot see
internal conversation state unless Codex exposes that state.

## Windows and PowerShell

PowerShell wrappers are included in `plugins\codex-homunculus\scripts`:

```powershell
.\plugins\codex-homunculus\scripts\codex-homunculus.ps1 --help
.\plugins\codex-homunculus\scripts\codex-with-homunculus.ps1 --dry-run
.\plugins\codex-homunculus\scripts\codex-with-homunculus.ps1
```

The `.ps1` wrappers default `CODEX_HOME` to `%USERPROFILE%\.codex`, default
`CODEX_HOMUNCULUS_HOME` to `%USERPROFILE%\.codex\homunculus`, restore those
temporary defaults before exit, and support `CODEX_HOMUNCULUS_PLUGIN_ROOT` when
installed somewhere else. `.cmd` wrappers are also included for Command Prompt
compatibility.

VS Code integration uses the same global command plus user-level instructions
and hooks:

```powershell
%USERPROFILE%\.copilot\instructions\codex-homunculus.instructions.md
%USERPROFILE%\.copilot\hooks\homunculus.json
%USERPROFILE%\.claude\CLAUDE.md
%USERPROFILE%\.claude\rules\codex-homunculus.md
%USERPROFILE%\.codex\bin\vscode-homunculus-hook.ps1
```
