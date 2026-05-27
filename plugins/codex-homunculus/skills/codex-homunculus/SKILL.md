---
name: codex-homunculus
description: Local-first Homunculus-style memory for Codex. Use when the user asks Codex to remember or apply learned workflow preferences, initialize project memory, inspect or evolve instincts, import/export Codex Homunculus state, install AGENTS.md Codex bootstrap instructions, make Homunculus more automatic, or build on prior session behavior without Claude Code hooks.
---

# Codex Homunculus

Use this skill to manage project-local learned instincts for Codex. For exact file schemas, read `references/state-format.md` only when editing state files, debugging imports, or building tooling around the state format.
For automation tradeoffs, repo/global instruction bootstrapping, scheduled jobs, or wrappers, read `references/automation-options.md`.

## Core model

- Store state in `.codex/homunculus` by default, inside the current git root when one exists.
- Keep learned behavior as Markdown instincts under `instincts/personal` or `instincts/inherited`.
- Keep observations as JSONL under `observations.jsonl`.
- Use the bundled CLI at `../../scripts/homunculus.mjs` for deterministic state operations.
- Refuse to store secrets, tokens, private keys, customer data, or credentials as instincts. The CLI blocks common secret patterns unless `--allow-sensitive` is explicitly used after user approval.

This is a Codex-native adaptation. Codex plugins do not currently provide the same Claude Code hook/slash-command runtime, so use explicit skill invocation and CLI calls instead of claiming automatic background observation.

## Workflow

1. At the start of a repo task, run:

```powershell
node <plugin-root>\scripts\homunculus.mjs start
```

2. Before style-sensitive, workflow-sensitive, or repeated decisions, apply relevant instincts:

```powershell
node <plugin-root>\scripts\homunculus.mjs apply --context "<brief task context>"
```

3. When the user corrects Codex or states a durable preference, save a narrow instinct:

```powershell
node <plugin-root>\scripts\homunculus.mjs add-instinct --domain repo-debugging --trigger "user asks for repo debugging" --action "inspect files and run verification before claiming success" --confidence 0.85 --evidence "User explicitly requested evidence-first repo debugging."
```

4. When you need to record both evidence and an instinct in one step, use `learn`:

```powershell
node <plugin-root>\scripts\homunculus.mjs learn --domain repo-debugging --trigger "user corrects a shortcut" --action "save the durable preference after checking for secrets" --confidence 0.8 --evidence "User corrected the workflow."
```

5. When related instincts accumulate, evolve them into a reusable summary:

```powershell
node <plugin-root>\scripts\homunculus.mjs evolve --min-count 3
```

6. Validate state before sharing, installing globally, or relying on inherited instincts:

```powershell
node <plugin-root>\scripts\homunculus.mjs validate
```

7. To install or refresh repo-local Codex bootstrap instructions, run from the repo root:

```powershell
node <plugin-root>\scripts\homunculus.mjs install-codex-instructions
```

Use `--print` to inspect the block without writing. Use `--global --yes` or an out-of-repo `--target <path> --yes` only after explicit user approval.

8. For portability between repos or machines, use:

```powershell
node <plugin-root>\scripts\homunculus.mjs export --output homunculus-export.json
node <plugin-root>\scripts\homunculus.mjs import --input homunculus-export.json
```

## Command guide

- `init`: create state directories without recording a session.
- `start`: create state, increment the session counter, and print current context.
- `status`: summarize identity, state location, observations, instincts, and evolved files.
- `observe`: append a manual observation to `observations.jsonl`.
- `add-instinct`: write a Markdown instinct with frontmatter metadata.
- `learn`: append an observation and create an instinct in a single guarded operation.
- `list-instincts`: list all personal and inherited instincts.
- `apply`: rank instincts against a task context and print actionable matches.
- `evolve`: create deterministic domain summaries from repeated instincts.
- `export`: write a JSON bundle containing identity and instincts.
- `import`: import a JSON bundle into inherited instincts by default without overwriting existing files.
- `install-codex-instructions`: add or update a marked AGENTS.md bootstrap block for start/apply/learn workflow steps.
- `doctor`: verify that the local state layout is readable and writable.
- `validate`: check state files, JSONL records, instinct metadata, duplicate IDs, confidence values, and sensitive-data warnings.

## Safety rules

- Keep instincts atomic: one trigger and one action per file.
- Treat observations as evidence, not truth. Convert them into instincts only after a repeated or explicit pattern exists.
- Prefer project-local state. Use `--root <path>` only when the user asks for a non-default location.
- Before persisting potentially sensitive facts, ask the user.
- Use `--allow-sensitive` only after explicit user approval, and prefer redaction instead.
- If automatic hook behavior is requested, use `install-codex-instructions` for repo-level bootstrap instructions and explain that every-message hooks require a future Codex hook surface or an external wrapper.
