# Homunculus Reliability-First Design

## Goal

Make Codex Homunculus dependable before making it more intelligent. The first implementation slice should ensure that state location, installed-copy sync, global wrapper behavior, validation, and memory lifecycle commands are explicit, testable, and repairable.

## Current Context

The repo is a small Node.js plugin with one primary CLI at `plugins/codex-homunculus/scripts/homunculus.mjs`, a smoke test, Windows wrappers, and a Codex skill/doc bundle. The current CLI can start/status/observe/learn/apply/evolve/export/import/install instructions/doctor/validate. Recent changes made state default to the Homunculus repo or install root while preserving the caller repo as metadata.

The practical weak point is operational drift. The source checkout, local marketplace copy, plugin cache, wrapper, state files, and skill docs can diverge. Homunculus also has only a simple memory lifecycle: observations can become instincts, and instincts can become evolved summaries, but there is no review, quarantine, dedupe, forgetting, or global repair workflow.

## Recommended Approach

Use a reliability-first track with four bounded feature groups:

1. Add global install diagnostics and repair commands.
2. Add lifecycle commands for safe memory management.
3. Strengthen validation and state schema checks.
4. Add regression tests that exercise installed-copy and cross-repo behavior.

This approach keeps the current single-file CLI shape for now, avoiding a broad rewrite. If the CLI keeps growing after this slice, a later refactor can split state, memory, install, and validation modules.

## Alternatives Considered

The intelligence-first approach would add better ranking, embeddings, and summaries immediately. That is attractive, but it risks making an unreliable install/state foundation harder to debug.

The automation-first approach would expand wrappers and hooks first. That would improve convenience, but the repo already documents that Codex cannot honestly observe every internal event. Automation should come after the state and repair surfaces are solid.

The recommended reliability-first approach is less flashy, but it directly addresses the failures seen on this machine: sandbox write mismatches, installed-copy drift, and unclear boundaries between caller repos and Homunculus state.

## CLI Design

Add these commands:

- `doctor --global`: report source checkout, local marketplace copy, plugin cache, global wrapper, state root, skill docs, and Codex home health.
- `sync-installed`: copy verified plugin files from the source checkout to the local marketplace and plugin cache, with `--dry-run` defaulting to report-only and `--yes` required to write outside the repo.
- `repair-installed`: run `sync-installed`, then verify wrapper help, smoke tests, and state validation.
- `forget`: remove or archive a specific instinct by id/path after showing what will be removed.
- `quarantine`: move a suspicious instinct out of active retrieval without deleting it.
- `audit-memory`: list duplicate, stale, conflicting, missing-metadata, and sensitive-looking memories.

Existing commands should remain backward compatible.

## State Design

Keep the existing state directory layout, but add two new folders:

- `quarantine/`: inactive instincts removed from retrieval but retained for audit.
- `archive/`: intentionally forgotten or superseded records, stored only when the user asks to preserve an audit trail.

Add optional metadata fields to learned instincts:

- `status`: `active`, `quarantined`, `archived`, or `superseded`.
- `last_applied_at`: timestamp updated when an instinct is returned by `apply`.
- `apply_count`: integer usage counter.
- `supersedes`: optional id of an older instinct.

Validation should tolerate older instinct files, but new commands should write the richer metadata.

## Retrieval Design

Do not add embeddings in this slice. Improve deterministic ranking first:

- Domain exact match.
- Caller project id/root match.
- Token overlap.
- Confidence.
- Recency.
- Usage count.
- Active status only.

Return JSON fields that make ranking explainable: score and score components. The plain-text output can stay concise.

## Safety Design

`sync-installed`, `repair-installed`, `forget`, and `quarantine` should be conservative:

- Report planned changes before writes.
- Require `--yes` for writes outside the source repo.
- Never delete memories by default; prefer quarantine or archive.
- Preserve the existing sensitive-data checks and extend `validate --strict` to scan observations, instincts, exports, and evolved summaries.

## Testing Design

Extend the smoke test to cover:

- `doctor --global --json` structure.
- `sync-installed --dry-run` report output.
- `forget` refusing ambiguous or missing ids.
- `quarantine` removing an instinct from `apply` results.
- Backward compatibility for older instinct frontmatter.
- Cross-repo state behavior using a caller repo and Homunculus repo.

Add one focused fixture-style test helper only if the smoke test becomes hard to read. Otherwise keep the current no-dependency test style.

## Documentation Design

Update:

- `README.md`: reliability-first command examples and operational boundaries.
- `skills/codex-homunculus/SKILL.md`: when to use new audit/repair/lifecycle commands.
- `references/state-format.md`: new folders and metadata.
- `references/automation-options.md`: installed-copy sync and global wrapper verification.

## Non-Goals

This slice will not add embeddings, remote sync, cloud storage, background observation claims, UI dashboards, or automatic shell profile edits. It will not make Homunculus silently modify arbitrary project repos.

## Success Criteria

- `npm run check` passes.
- `npm test` passes.
- `npm pack --dry-run` passes.
- `doctor --global --json` can identify the source checkout, local marketplace copy, plugin cache, wrapper, and state root.
- `sync-installed --dry-run` is report-only.
- `sync-installed --yes` updates the installed copies from source.
- A global wrapper run from another repo reports that repo as active project while storing state under the Homunculus install root.
- Quarantined instincts do not appear in `apply`.

## Implementation Order

1. Add state helpers for quarantine/archive directories and active-status filtering.
2. Add memory lifecycle commands: `quarantine`, `forget`, and `audit-memory`.
3. Add install inventory helpers and `doctor --global`.
4. Add `sync-installed --dry-run/--yes`.
5. Add `repair-installed`.
6. Update docs and smoke tests.

## Open Boundaries

The implementation should not commit to a permanent modular architecture yet. If `homunculus.mjs` becomes difficult to maintain during this slice, split it into local modules under `scripts/lib/`, but only after tests cover the current behavior.
