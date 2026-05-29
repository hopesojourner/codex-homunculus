# ADR-001: Ship Homunculus as a Local Production Helper App

## Status
Accepted

## Date
2026-05-29

## Context
Homunculus needs to work as a live local program helper for Codex and related
developer tools. The core memory logic already exists as a no-dependency Node.js
CLI. The missing production surface is a repeatable helper app layer for startup,
health checks, maintenance, installation, and packaging.

## Decision
Keep the core CLI as the implementation module and add a thin helper app wrapper
with no new runtime dependencies. The package includes:

- `codex-homunculus` for direct state and memory operations
- `codex-homunculus-helper` for production helper workflows
- Windows `.cmd` launchers
- PowerShell install/uninstall scripts that register weekly maintenance by default
- A production manifest, environment template, and helper app documentation

The helper runs explicit commands and does not claim background observation
unless a wrapper, scheduled task, or external hook is installed and verified.

## Alternatives Considered

### Background daemon
Pros: Always-on behavior.
Cons: Requires lifecycle management, logging, permissions, and a real event
source. Codex does not expose every internal event to plugins, so a daemon would
risk false automation claims.

### GUI tray application
Pros: Familiar production-app shape.
Cons: Adds dependencies and packaging complexity without improving the core
Codex integration.

### Helper wrapper only
Pros: Small, auditable, testable, and compatible with npm package installs.
Cons: Users must opt into scheduled maintenance or wrappers.

## Consequences

The production helper app remains local-first and deterministic. It can be
installed from a single tarball, checked with `health`, and maintained with a
weekly scheduled task by default. Users can opt out with `-NoMaintenanceTask`
when installing.
