# Codex Homunculus State Format

State defaults to `.codex/homunculus` under the current git root.

## Files

- `identity.json`: project identity, version, session count, and evolution summary.
- `observations.jsonl`: one JSON object per line for manual observations.
- `instincts/personal/*.md`: instincts learned in the current project.
- `instincts/inherited/*.md`: imported instincts from another project or machine.
- `evolved/skills/*.md`: generated domain summaries from repeated instincts.
- `exports/*.json`: optional export bundles.

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

## Validation

Run:

```powershell
node <plugin-root>\scripts\homunculus.mjs validate
```

Use `--json` for machine-readable output and `--strict` to treat sensitive-data warnings as errors.
