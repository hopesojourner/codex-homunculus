# Codex Homunculus State Format

State defaults to the local Homunculus folder at `CODEX_HOME\homunculus` or
`%USERPROFILE%\.codex\homunculus`, not under OneDrive and not under the
caller repo's current git root. `CODEX_HOMUNCULUS_HOME` pins that local folder;
`CODEX_HOMUNCULUS_DIR` and `--root` are explicit state-directory overrides.
`CODEX_HOMUNCULUS_REPO` remains a backward-compatible alias for
`CODEX_HOMUNCULUS_HOME`.

## Files

- `identity.json`: local state folder metadata, active caller project, per-project history, version, session count, and evolution summary.
- `observations.jsonl`: one JSON object per line for manual observations. Records include `project_id` and a `project` object for the caller repo.
- `instincts/personal/*.md`: instincts learned into the local Homunculus folder. Frontmatter includes source project metadata.
- `instincts/inherited/*.md`: imported instincts from another project or machine.
- `quarantine/*.md`: inactive instincts preserved for audit and review but ignored by `apply` and `evolve`.
- `archive/*.md`: instincts intentionally removed from active use by `forget`.
- `evolved/skills/*.md`: generated domain summaries from repeated instincts.
- `exports/*.json`: optional export bundles.
- `.gitignore`: maintained privacy block that ignores runtime state when the local Homunculus folder is a Git working tree.
- `.lock/`: temporary state lock used while a command is updating Homunculus state. It is removed after each command and ignored by Git.

## Instinct Markdown

Each instinct is a Markdown file with YAML-style frontmatter followed by human-readable sections.

Required frontmatter fields:

- `id`
- `title`
- `domain`
- `trigger`
- `action`
- `confidence`
- `source`
- `created_at`
- `updated_at`

`confidence` must be a number from `0` through `1`.

New learned instincts also include source project metadata:

- `project_id`
- `project_name`
- `project_root`
- `project_remote`
- `project_branch`

Lifecycle metadata is optional for older instincts and may include:

- `status`: `active`, `quarantined`, `archived`, or `superseded`
- `last_applied_at`
- `apply_count`
- `supersedes`

`apply` and `evolve` ignore quarantined instincts and any instinct whose
`status` is not `active`.

## Validation

Run:

```powershell
node <plugin-root>\scripts\homunculus.mjs validate
```

Use `--json` for machine-readable output and `--strict` to treat sensitive-data warnings as errors. Strict validation scans instinct Markdown and observation JSONL records for sensitive-looking content.
When the state folder is inside a Git working tree, validation fails if private runtime state is tracked or not ignored.

Commands that mutate state hold the local `.lock` folder and write JSON files with atomic replacement. This prevents overlapping Codex chats from interleaving writes to `identity.json`.
