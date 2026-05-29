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
```

## CLI

```powershell
node scripts\homunculus.mjs start
node scripts\homunculus.mjs apply --context "repo debugging task"
node scripts\homunculus.mjs learn --domain repo-debugging --trigger "user correction" --action "save a narrow instinct"
node scripts\homunculus.mjs install-codex-instructions
node scripts\homunculus.mjs validate
```

State defaults to the local Homunculus folder at `CODEX_HOME\homunculus`
or `%USERPROFILE%\.codex\homunculus`, not OneDrive and not the caller's
current git root. Set `CODEX_HOMUNCULUS_HOME` to pin that local folder
explicitly, or use `CODEX_HOMUNCULUS_DIR` / `--root` for an explicit state
directory. `CODEX_HOMUNCULUS_REPO` is still accepted as a backward-compatible
alias for `CODEX_HOMUNCULUS_HOME`.

When invoked from another repository, Homunculus still records that caller as
the active project. `identity.json`, observations, and learned instinct
metadata retain source repository details, while the files remain under the
local Homunculus folder.

The local Homunculus folder is safe to initialize as a normal Git working tree.
The CLI maintains a `.gitignore` block for runtime state, and `validate` fails
if `identity.json`, `observations.jsonl`, `instincts/`, `evolved/`, or
`exports/` are tracked. Install `scripts/pre-commit-privacy-guard` as
`.git/hooks/pre-commit` in that local working tree for an extra commit-time
block.

## Codex Automation Boundary

The safest automatic path is instruction-based: this repo includes an `AGENTS.md`
bootstrap block telling Codex to run Homunculus `start` and `apply` at the
beginning of repo tasks, then use `learn` at the end only when there is a
durable lesson worth saving.

Refresh that block with:

```powershell
node plugins\codex-homunculus\scripts\homunculus.mjs install-codex-instructions
```

By default, `install-codex-instructions` also targets the local Homunculus
folder's `AGENTS.md`. Use `--print` to inspect the block without writing. Use
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
