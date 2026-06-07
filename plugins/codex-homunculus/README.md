# Codex Homunculus Package

This package contains the complete Codex Homunculus plugin:

- Codex plugin metadata in `.codex-plugin/`
- The `codex-homunculus` CLI in `scripts/homunculus.mjs`
- Windows wrapper and hook scripts in `scripts/`
- Production helper app files in `configs/`, `docs/`, and `production/`
- The Codex skill and references in `skills/`

## Install From Tarball

```powershell
npm install -g .\codex-homunculus-0.5.0.tgz
codex-homunculus doctor --global
codex-homunculus-helper health
codex-homunculus install-codex-instructions --global --yes
```

## Verify

```powershell
npm run check
npm test
npm pack --dry-run --json
node scripts\homunculus.mjs doctor --global
node scripts\homunculus.mjs validate --strict
node scripts\homunculus-helper.mjs health
```

Use `sync-installed --dry-run` before `sync-installed --yes` when updating
Codex local marketplace or plugin cache copies from this package.

## Production Helper

```powershell
codex-homunculus-helper start --context "repo task"
codex-homunculus-helper health
codex-homunculus-helper maintenance
```

On Windows, `scripts\install-production.ps1` copies helper launchers into
`%USERPROFILE%\.codex\bin` and automatically registers weekly maintenance.
Use `-NoMaintenanceTask` only when scheduling should be skipped.

On the verified `C:\Users\Gchen` Windows setup, the active wrappers are in
`C:\Users\Gchen\.codex\bin`, state is in
`C:\Users\Gchen\.codex\homunculus`, and installed copies are refreshed with:

```powershell
node scripts\homunculus.mjs sync-installed --dry-run
node scripts\homunculus.mjs sync-installed --yes
```

Manual privacy-hook checks should use Git for Windows `sh.exe` on this machine
because bare `bash.exe` resolves to WSL:

```powershell
& "C:\Program Files\Git\bin\sh.exe" scripts\pre-commit-privacy-guard
```
