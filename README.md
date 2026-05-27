# Codex Homunculus

Codex Homunculus is a Codex-native adaptation of Homunculus-style local memory.
It provides a project-local plugin, a triggerable Codex skill, and a deterministic
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

State defaults to `.codex/homunculus` under the current git root.

## Codex Automation Boundary

The safest automatic path is instruction-based: this repo includes an `AGENTS.md`
bootstrap block telling Codex to run Homunculus `start` and `apply` at the
beginning of repo tasks, then use `learn` at the end only when there is a
durable lesson worth saving.

Refresh that block with:

```powershell
node plugins\codex-homunculus\scripts\homunculus.mjs install-codex-instructions
```

Use `--print` to inspect the block without writing. Use `--global --yes` or an
out-of-repo `--target <path> --yes` only after explicitly accepting the global
or external write.

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
