# Codex Homunculus

Codex Homunculus is a Codex-native adaptation of Homunculus-style local memory.
It provides a repository-anchored plugin, a triggerable Codex skill, and a deterministic
Node.js CLI for learned instincts, validation, import/export, and evolution
summaries.

This port is explicit CLI and skill driven. It does not depend on Claude Code
hooks or slash commands.

## Layout

```text
.agents/plugins/marketplace.json
plugins/codex-homunculus/
  .codex-plugin/plugin.json
  package.json
  scripts/homunculus.mjs
  scripts/smoke-test.mjs
  skills/codex-homunculus/SKILL.md
```

## Verify

```powershell
cd plugins\codex-homunculus
npm run check
npm test
npm pack --dry-run --json
node scripts\homunculus.mjs doctor --global
node scripts\homunculus.mjs validate --strict
node scripts\homunculus-helper.mjs health
```

## CLI

```powershell
node scripts\homunculus.mjs start
node scripts\homunculus.mjs apply --context "repo debugging task"
node scripts\homunculus.mjs learn --domain repo-debugging --trigger "user correction" --action "save a narrow instinct"
node scripts\homunculus.mjs install-codex-instructions
node scripts\homunculus.mjs validate
node scripts\homunculus.mjs validate --strict
node scripts\homunculus.mjs doctor --global
node scripts\homunculus.mjs audit-memory
node scripts\homunculus.mjs quarantine --id <instinct-id>
node scripts\homunculus.mjs forget --id <instinct-id>
node scripts\homunculus.mjs sync-installed --dry-run
node scripts\homunculus.mjs sync-installed --yes
node scripts\homunculus.mjs repair-installed --dry-run
node scripts\homunculus-helper.mjs start --context "repo debugging task"
node scripts\homunculus-helper.mjs health
node scripts\homunculus-helper.mjs maintenance
```

State defaults to the local Homunculus folder at `CODEX_HOME\homunculus`
or `%USERPROFILE%\.codex\homunculus`, not OneDrive and not the caller's
current git root. Set `CODEX_HOMUNCULUS_HOME` to pin that local folder
explicitly, or use `CODEX_HOMUNCULUS_DIR` / `--root` for an explicit state
directory. `CODEX_HOMUNCULUS_REPO` is still accepted as a backward-compatible
alias for `CODEX_HOMUNCULUS_HOME`.

State-changing commands serialize through a local `.lock` folder and write JSON
with atomic replacement so multiple Codex chats can run `start`, `apply`, or
`learn` against the same Homunculus folder without corrupting `identity.json`.

Use `audit-memory` to inspect duplicate, incomplete, or sensitive-looking
instincts. Use `quarantine` to remove a questionable instinct from active
retrieval while preserving it for review, and `forget` to archive an instinct
out of active use.

The production helper app wraps common live operations:

- `start`: start, apply relevant instincts, and validate state.
- `health`: run global doctor, validation, and memory audit.
- `maintenance`: validate, audit, and evolve repeated instincts.
- `install --yes`: sync installed copies and refresh global Codex instructions.

On Windows, `scripts\install-production.ps1` now registers the weekly
`Codex Homunculus Maintenance` scheduled task by default. Use
`-NoMaintenanceTask` to opt out.

When invoked from another repository, Homunculus still records that caller as
the active project. `identity.json`, observations, and learned instinct
metadata retain source repository details, while the files remain under the
local Homunculus folder.

The local Homunculus folder is safe to initialize as a normal Git working tree.
The CLI maintains a `.gitignore` block for runtime state, and `validate` fails
if `identity.json`, `observations.jsonl`, `instincts/`, `evolved/`, or
`exports/`, `quarantine/`, `archive/`, or `.lock/` are tracked. Install `scripts/pre-commit-privacy-guard` as
`.git/hooks/pre-commit` in that local working tree for an extra commit-time
block.

Before relying on an installed copy after source changes, run `sync-installed
--dry-run` and inspect the planned copy set. Use `sync-installed --yes` only
when updating the local marketplace and plugin cache is intended, then verify
with `doctor --global`.

## Codex Automation Boundary

The safest automatic path is instruction-based: this repo includes an `AGENTS.md`
bootstrap block telling Codex to run Homunculus `start` and `apply` at the
beginning of repo tasks, then use `learn` at the end only when there is a
durable lesson worth saving.

Refresh the global block with the installed command:

```powershell
& "$env:USERPROFILE\.codex\bin\codex-homunculus.cmd" install-codex-instructions --global --yes
```

By default, `install-codex-instructions` also targets the local Homunculus
folder's `AGENTS.md`. The generated block tells Codex to run the local
Homunculus bootstrap commands directly when tool permissions allow, without
asking the user first. Use `--print` to inspect the block without writing. Use
`--global --yes` or an out-of-folder `--target <path> --yes` only after
explicitly accepting the global or external write.

Codex skills can trigger when the user mentions memory, instincts, learning,
prior behavior, or Homunculus automation. Scheduled Codex automations can run
periodic jobs, but they do not hook into every message or tool call. External
wrappers can enforce before/after commands outside Codex, but they cannot see
internal conversation state unless Codex exposes that state.

Windows wrapper scripts are included in `plugins\codex-homunculus\scripts`:

```powershell
codex-homunculus.cmd --help
codex-with-homunculus.cmd --dry-run
codex-with-homunculus.cmd
```

VS Code integration uses the same global command plus user-level instructions
and hooks:

```powershell
%USERPROFILE%\.copilot\instructions\codex-homunculus.instructions.md
%USERPROFILE%\.copilot\hooks\homunculus.json
%USERPROFILE%\.claude\CLAUDE.md
%USERPROFILE%\.claude\rules\codex-homunculus.md
%USERPROFILE%\.codex\bin\vscode-homunculus-hook.ps1
```

## Verified Windows Machine State

This repository is currently verified against the Windows Codex setup on
`C:\Users\Gchen`:

- Real Codex home: `C:\Users\Gchen\.codex`
- Source plugin: `plugins\codex-homunculus`
- Local marketplace copy:
  `C:\Users\Gchen\.codex\local-marketplaces\codex-homunculus\plugins\codex-homunculus`
- Plugin cache copy:
  `C:\Users\Gchen\.codex\plugins\cache\codex-homunculus\codex-homunculus\0.5.0`
- Wrapper scripts:
  `C:\Users\Gchen\.codex\bin\codex-homunculus.cmd`,
  `C:\Users\Gchen\.codex\bin\codex-homunculus-helper.cmd`,
  `C:\Users\Gchen\.codex\bin\codex-with-homunculus.cmd`, and
  `C:\Users\Gchen\.codex\bin\vscode-homunculus-hook.ps1`
- Global Codex instructions: `C:\Users\Gchen\.codex\AGENTS.md`
- Homunculus state and local instructions: `C:\Users\Gchen\.codex\homunculus`
- Weekly maintenance task: `Codex Homunculus Maintenance`
- Global support skill:
  `C:\Users\Gchen\.agents\skills\skills-global-install-verification`

On this machine, `bash.exe` resolves to Windows Subsystem for Linux and WSL has
no installed distribution. Do not use bare `bash` to manually test the
`pre-commit-privacy-guard` script here. Git for Windows can still run the hook
normally, and a manual check can use:

```powershell
& "C:\Program Files\Git\bin\sh.exe" plugins\codex-homunculus\scripts\pre-commit-privacy-guard
```

Codex MCP servers `git` and `playwright` are intentionally disabled in the
local config. Leave heavy MCP helpers disabled unless there is a specific task
that requires enabling them.
