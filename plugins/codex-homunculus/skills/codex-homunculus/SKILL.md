---
name: codex-homunculus
description: Local-first Homunculus-style memory for Codex. Use when the user asks Codex to remember or apply learned workflow preferences, initialize project memory, inspect or evolve instincts, import/export Codex Homunculus state, install AGENTS.md Codex bootstrap instructions, make Homunculus more automatic, or build on prior session behavior without Claude Code hooks.
---

# Codex Homunculus

Use this skill to manage local Homunculus-folder learned instincts for Codex. For exact file schemas, read `references/state-format.md` only when editing state files, debugging imports, or building tooling around the state format.
For automation tradeoffs, repo/global instruction bootstrapping, scheduled jobs, or wrappers, read `references/automation-options.md`.

## Core model

- Store state in `CODEX_HOME\homunculus` or `%USERPROFILE%\.codex\homunculus` by default, not under OneDrive and not under the caller's current repo.
- Use `CODEX_HOMUNCULUS_HOME` to pin the local Homunculus folder, or `CODEX_HOMUNCULUS_DIR` / `--root` only for explicit state-directory overrides. `CODEX_HOMUNCULUS_REPO` remains a backward-compatible alias.
- Preserve the caller repo as source metadata in `identity.json`, observations, and learned instinct frontmatter.
- State writes are serialized with a local `.lock` folder and JSON files are replaced atomically so multiple Codex chats can share the same Homunculus folder.
- Keep runtime state private: `.gitignore`, `validate`, and the optional `scripts/pre-commit-privacy-guard` hook must prevent `identity.json`, `observations.jsonl`, `instincts/`, `evolved/`, `exports/`, `quarantine/`, `archive/`, and `.lock/` from being committed.
- Keep learned behavior as Markdown instincts under `instincts/personal` or `instincts/inherited`.
- Keep inactive learned behavior under `quarantine/` for review or `archive/` after `forget`; neither folder participates in active retrieval.
- Keep observations as JSONL under `observations.jsonl`.
- Use the bundled CLI at `../../scripts/homunculus.mjs` for deterministic state operations.
- On Windows, prefer the bundled PowerShell wrappers `scripts/codex-homunculus.ps1` and `scripts/codex-with-homunculus.ps1` when running manually.
- Refuse to store secrets, tokens, private keys, customer data, or credentials as instincts. The CLI blocks common secret patterns unless `--allow-sensitive` is explicitly used after user approval.

This is a Codex-native adaptation. Codex plugins do not currently provide the same Claude Code hook/slash-command runtime, so use explicit skill invocation and CLI calls instead of claiming automatic background observation.

## Workflow

1. At the start of a repo task, run:

```powershell
<plugin-root>\scripts\codex-homunculus.ps1 start
```

Use `node <plugin-root>\scripts\homunculus.mjs ...` or `./scripts/homunculus.mjs ...` on POSIX when a PowerShell wrapper is not available.

2. Before style-sensitive, workflow-sensitive, or repeated decisions, apply relevant instincts:

```powershell
<plugin-root>\scripts\codex-homunculus.ps1 apply --context "<brief task context>"
```

3. When the user corrects Codex or states a durable preference, save a narrow instinct:

```powershell
<plugin-root>\scripts\codex-homunculus.ps1 add-instinct --domain repo-debugging --trigger "user asks for repo debugging" --action "inspect files and run verification before claiming success" --confidence 0.85 --evidence "User explicitly requested evidence-first repo debugging."
```

4. When you need to record both evidence and an instinct in one step, use `learn`:

```powershell
<plugin-root>\scripts\codex-homunculus.ps1 learn --domain repo-debugging --trigger "user corrects a shortcut" --action "save the durable preference after checking for secrets" --confidence 0.8 --evidence "User corrected the workflow."
```

5. When related instincts accumulate, evolve them into a reusable summary:

```powershell
<plugin-root>\scripts\codex-homunculus.ps1 evolve --min-count 3
```

6. Validate state before sharing, installing globally, or relying on inherited instincts:

```powershell
<plugin-root>\scripts\codex-homunculus.ps1 validate
```

7. To install or refresh the local Homunculus folder Codex bootstrap instructions, run:

```powershell
<plugin-root>\scripts\codex-homunculus.ps1 install-codex-instructions
```

Use `--print` to inspect the block without writing. The default target is the local Homunculus folder `AGENTS.md`, and the generated block embeds the installed CLI script path when available instead of assuming a caller repo layout. Use `--script-command` for a custom wrapper, and use `--global --yes` or an out-of-folder `--target <path> --yes` only after explicit user approval. Generated instructions tell Codex not to ask before running local Homunculus bootstrap commands when tool permissions allow.

8. For portability between repos or machines, use:

```powershell
<plugin-root>\scripts\codex-homunculus.ps1 export --output homunculus-export.json
<plugin-root>\scripts\codex-homunculus.ps1 import --input homunculus-export.json
```

## Command guide

- `init`: create state directories without recording a session.
- `start`: create state, increment the session counter, and print current context.
- `status`: summarize identity, state location, observations, instincts, and evolved files.
- `observe`: append a manual observation to `observations.jsonl`.
- `add-instinct`: write a Markdown instinct with frontmatter metadata.
- `learn`: append an observation and create an instinct in a single guarded operation.
- `list-instincts`: list all personal and inherited instincts.
- `apply`: rank active instincts against a task context and print actionable matches. Use `--json` to inspect score components.
- `audit-memory`: report duplicate, incomplete, or sensitive-looking memories.
- `quarantine`: move an instinct out of active retrieval while preserving it for review.
- `forget`: archive an instinct so it no longer influences future tasks.
- `evolve`: create deterministic domain summaries from repeated instincts.
- `export`: write a JSON bundle containing identity and instincts.
- `import`: import a JSON bundle into inherited instincts by default without overwriting existing files.
- `install-codex-instructions`: add or update a marked AGENTS.md bootstrap block for start/apply/learn workflow steps.
- `doctor`: verify that the local state layout is readable and writable.
- `doctor --global`: inspect the source checkout, installed copies, wrapper, state root, and Codex home.
- `sync-installed`: copy verified source plugin files to installed copies; use `--dry-run` before `--yes`.
- `repair-installed`: sync installed copies and validate Homunculus state.
- `codex-homunculus-helper start`: production helper workflow for start, apply, and validation.
- `codex-homunculus-helper health`: production helper workflow for global doctor, validation, and memory audit.
- `codex-homunculus-helper maintenance`: production helper workflow for validation, audit, and evolution.
- `validate`: check state files, JSONL records, instinct metadata, duplicate IDs, confidence values, privacy guards, and sensitive-data warnings. Use `--strict` before sharing or depending on state.

## Safety rules

- Keep instincts atomic: one trigger and one action per file.
- Treat observations as evidence, not truth. Convert them into instincts only after a repeated or explicit pattern exists.
- Prefer local Homunculus-folder state. Use `--root <path>` only when the user asks for a non-default location.
- Before persisting potentially sensitive facts, ask the user.
- Use `--allow-sensitive` only after explicit user approval, and prefer redaction instead.
- If automatic hook behavior is requested, use `install-codex-instructions` for Homunculus bootstrap instructions and explain that every-message hooks require a future Codex hook surface or an external wrapper.
