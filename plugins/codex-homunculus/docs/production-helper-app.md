# Production Helper App

Codex Homunculus can run as a local production helper around the core
`homunculus.mjs` CLI. The helper app keeps startup, health checks, maintenance,
and installation repeatable without claiming background access that Codex does
not provide.

## Entry Points

```powershell
codex-homunculus-helper start --context "repo debugging"
codex-homunculus-helper health
codex-homunculus-helper maintenance
codex-homunculus-helper install --yes
```

The helper command runs these deterministic checks:

- `start`: `start`, `apply`, and `validate`
- `health`: `doctor --global`, `validate`, and `audit-memory`
- `maintenance`: `validate`, `audit-memory`, and `evolve`
- `install --yes`: `sync-installed --yes`, global instruction install, and global doctor

## Windows Install

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\install-production.ps1 -InstallGlobalInstructions
```

The installer automatically registers a weekly maintenance task named
`Codex Homunculus Maintenance`. To install the helper without a scheduled task:

```powershell
.\scripts\install-production.ps1 -NoMaintenanceTask
```

To remove helper scripts and the scheduled task:

```powershell
.\scripts\uninstall-production.ps1 -UnregisterMaintenanceTask
```

On the verified Windows setup for this repo, the production files live under
`C:\Users\Gchen\.codex\bin`, the state root is
`C:\Users\Gchen\.codex\homunculus`, and the installed plugin copies are:

```text
C:\Users\Gchen\.codex\local-marketplaces\codex-homunculus\plugins\codex-homunculus
C:\Users\Gchen\.codex\plugins\cache\codex-homunculus\codex-homunculus\0.5.0
```

The weekly scheduled task is named `Codex Homunculus Maintenance`.

For manual privacy-hook checks on this machine, use Git for Windows `sh.exe`;
bare `bash.exe` resolves to WSL and fails when no WSL distribution is installed:

```powershell
& "C:\Program Files\Git\bin\sh.exe" scripts\pre-commit-privacy-guard
```

## Boundaries

State defaults to `%USERPROFILE%\.codex\homunculus`. The helper does not store
state in caller repositories unless `--root` or `CODEX_HOMUNCULUS_DIR` explicitly
points there. Global instruction writes and installed-copy sync require `--yes`.
