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
- `evolved/skills/*.md`: generated domain summaries from repeated instincts.
- `exports/*.json`: optional export bundles.
- `.gitignore`: maintained privacy block that ignores runtime state when the local Homunculus folder is a Git working tree.

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

## Validation

Run:

```powershell
node <plugin-root>\scripts\homunculus.mjs validate
```

Use `--json` for machine-readable output and `--strict` to treat sensitive-data warnings as errors.
When the state folder is inside a Git working tree, validation fails if private runtime state is tracked or not ignored.
