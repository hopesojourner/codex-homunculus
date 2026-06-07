# Automation Options

Codex Homunculus can make memory use more consistent, but it must not pretend Codex has plugin-level hooks that are not present.

## Instruction Automatic

Use `install-codex-instructions` to add or update the marked AGENTS.md block in the local Homunculus folder by default. This keeps Homunculus writes out of OneDrive and caller repos while still documenting the bootstrap workflow.

Safe global default on this machine:

```powershell
& "$env:USERPROFILE\.codex\bin\codex-homunculus.cmd" install-codex-instructions --global --yes
```

The generated block uses the installed Homunculus command when available and tells Codex to run local Homunculus bootstrap commands directly when tool permissions allow, without asking the user first.

Any target outside the local Homunculus folder, or any global write, requires explicit confirmation:

```powershell
node plugins\codex-homunculus\scripts\homunculus.mjs install-codex-instructions --target C:\path\to\AGENTS.md --yes
node plugins\codex-homunculus\scripts\homunculus.mjs install-codex-instructions --global --yes
```

Use `--print` before global writes when the user wants to inspect the exact text.

## Skill Trigger Automatic

The `codex-homunculus` skill should trigger when users ask about memory, instincts, prior behavior, learning, import/export, or making Homunculus automatic. This improves recall when the user mentions those concepts, but it is not universal for every Codex task.

## Scheduled Automatic

Codex automations can run scheduled jobs or thread wakeups. They are useful for periodic maintenance, but they do not hook into every message or every tool call. Do not create a recurring automation unless the user supplies or approves the schedule, target workspace, and task prompt.

## External Wrapper Automatic

A wrapper script can launch Codex, run Homunculus before and after sessions, and enforce local conventions outside the plugin. This can be useful for a local workflow, but it sits outside Codex's plugin system and cannot observe internal conversation state unless Codex exposes a compatible interface.

On Windows, install the bundled wrappers from `scripts/` into a stable directory such as `%USERPROFILE%\.codex\bin`:

- `codex-homunculus.cmd`: runs the Homunculus CLI from the installed plugin copy.
- `codex-with-homunculus.cmd`: runs `start` and `apply`, launches `codex`, then validates Homunculus state after Codex exits.
- `vscode-homunculus-hook.ps1`: runs Homunculus from VS Code agent hooks for `SessionStart`, `UserPromptSubmit`, and `Stop`.

Use `codex-with-homunculus.cmd --dry-run` to verify the wrapper without launching an interactive Codex session.

For VS Code, install user-level files under `~/.copilot/instructions`, `~/.copilot/hooks`, `~/.claude/CLAUDE.md`, and `~/.claude/rules`. Enable `chat.useAgentsMdFile`, `chat.useClaudeMdFile`, `chat.includeApplyingInstructions`, and `chat.hookFilesLocations` in VS Code user settings.

## Production Helper App

Use `codex-homunculus-helper` for live local helper workflows:

```powershell
codex-homunculus-helper start --context "repo task"
codex-homunculus-helper health
codex-homunculus-helper maintenance
```

On Windows, `scripts\install-production.ps1` copies the helper launchers to
`%USERPROFILE%\.codex\bin` and registers the weekly `Codex Homunculus
Maintenance` scheduled task by default. Use `-InstallGlobalInstructions` only
when global Codex instruction writes are intended, and use `-NoMaintenanceTask`
only when scheduled maintenance should be skipped.

## Installed Copy Sync

Before relying on the global wrapper after source changes, run:

```powershell
node plugins\codex-homunculus\scripts\homunculus.mjs sync-installed --dry-run
node plugins\codex-homunculus\scripts\homunculus.mjs sync-installed --yes
node plugins\codex-homunculus\scripts\homunculus.mjs doctor --global
```

`sync-installed --yes` writes outside the source checkout into the local marketplace and plugin cache, so use it only when that machine-level update is intended. Use `repair-installed --dry-run` to combine sync planning with state validation before making writes.

## Recommended Boundary

Prefer this order:

1. Keep Homunculus state and default AGENTS.md writes anchored to the local Homunculus folder.
2. Install or refresh `C:\Users\Gchen\.codex\AGENTS.md` with the installed `codex-homunculus.cmd` command so any Codex chat can run it.
3. Keep the skill trigger broad enough for memory and automation requests.
4. Use scheduled automations only for explicit periodic jobs.
5. Use wrappers only after the user accepts the local operational risks.
