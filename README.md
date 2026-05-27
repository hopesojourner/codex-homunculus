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
node scripts\homunculus.mjs validate
```

State defaults to `.codex/homunculus` under the current git root.
