#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const VERSION = "0.5.0";
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const HOMUNCULUS = join(SCRIPT_DIR, "homunculus.mjs");

class HelperError extends Error {
  constructor(message, code = 1) {
    super(message);
    this.name = "HelperError";
    this.code = code;
  }
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith("--")) {
      args._.push(item);
      continue;
    }
    const eq = item.indexOf("=");
    if (eq !== -1) {
      args[item.slice(2, eq)] = item.slice(eq + 1);
      continue;
    }
    const key = item.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function withRoot(args, options) {
  if (!options.root) {
    return args;
  }
  return [...args, "--root", String(options.root)];
}

function runHomunculus(args, options = {}) {
  return spawnSync(process.execPath, [HOMUNCULUS, ...withRoot(args, options)], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
    windowsHide: true
  });
}

function runJson(args, options = {}) {
  const result = runHomunculus([...args, "--json"], options);
  if (result.status !== 0) {
    throw new HelperError(`${args[0]} failed: ${result.stderr || result.stdout}`.trim());
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new HelperError(`${args[0]} did not return valid JSON: ${error.message}`);
  }
}

function runText(args, options = {}) {
  const result = runHomunculus(args, options);
  if (result.status !== 0) {
    throw new HelperError(`${args[0]} failed: ${result.stderr || result.stdout}`.trim());
  }
  return result.stdout;
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function printTextSection(title, text) {
  if (!text.trim()) {
    return;
  }
  console.log(`== ${title} ==`);
  console.log(text.trim());
}

function commandStart(options) {
  const context = String(options.context || `production helper session in ${process.cwd()}`);
  const start = runJson(["start"], options);
  const apply = runText(["apply", "--context", context], options);
  const validation = runJson(["validate"], options);
  const result = {
    ok: validation.ok,
    start,
    apply: apply.trim(),
    validation
  };
  if (options.json) {
    printJson(result);
    return;
  }
  printTextSection("start", `project: ${start.project?.name || "unknown"}\nstate: ${start.root}`);
  printTextSection("apply", apply);
  printTextSection("validation", validation.ok ? "passed" : "failed");
}

function commandHealth(options) {
  const doctor = runJson(["doctor", "--global"], options);
  const validation = runJson(["validate"], options);
  const audit = runJson(["audit-memory"], options);
  const result = {
    ok: Boolean(doctor.ok && validation.ok && audit.sensitive.length === 0),
    doctor,
    validation,
    audit
  };
  if (options.json) {
    printJson(result);
    return;
  }
  console.log(`health: ${result.ok ? "ok" : "attention required"}`);
  console.log(`state: ${doctor.inventory?.state_root?.path || doctor.checks?.[0]?.path || "unknown"}`);
  console.log(`sensitive findings: ${audit.sensitive.length}`);
}

function commandMaintenance(options) {
  const minCount = String(options["min-count"] || options.minCount || 3);
  const validation = runJson(["validate"], options);
  const audit = runJson(["audit-memory"], options);
  const evolution = runJson(["evolve", "--min-count", minCount], options);
  const result = {
    ok: Boolean(validation.ok && audit.sensitive.length === 0),
    validation,
    audit,
    evolution
  };
  if (options.json) {
    printJson(result);
    return;
  }
  console.log(`maintenance: ${result.ok ? "ok" : "attention required"}`);
  console.log(`evolved files: ${evolution.evolved?.length || 0}`);
}

function commandStatus(options) {
  const status = runJson(["status"], options);
  if (options.json) {
    printJson({ ok: true, status });
    return;
  }
  console.log(`project: ${status.project?.name || "unknown"}`);
  console.log(`state: ${status.root}`);
  console.log(`sessions: ${status.session_count}`);
}

function commandInstall(options) {
  if (!options.yes) {
    const sync = runJson(["sync-installed", "--dry-run"], options);
    const instructions = runText(["install-codex-instructions", "--print"], options);
    const result = { ok: true, mode: "dry-run", sync, instructions };
    if (options.json) {
      printJson(result);
      return;
    }
    console.log(`install dry-run: ${sync.files.length} file copies planned`);
    return;
  }
  const sync = runText(["sync-installed", "--yes"], options);
  const instructions = runText(["install-codex-instructions", "--global", "--yes"], options);
  const doctor = runJson(["doctor", "--global"], options);
  const result = { ok: doctor.ok, mode: "write", sync: sync.trim(), instructions: instructions.trim(), doctor };
  if (options.json) {
    printJson(result);
    return;
  }
  printTextSection("sync", sync);
  printTextSection("instructions", instructions);
  console.log(`doctor: ${doctor.ok ? "ok" : "failed"}`);
}

function commandHelp() {
  console.log(`Codex Homunculus Helper ${VERSION}

Usage:
  codex-homunculus-helper <command> [options]

Commands:
  start        Run Homunculus start, apply, and validation for the current program context.
  health       Run global doctor, state validation, and memory audit.
  maintenance  Run validation, audit, and deterministic evolution.
  status       Print current Homunculus state summary.
  install      Dry-run production install; use --yes to sync and install global instructions.

Options:
  --context <text>   Context passed to apply during start.
  --root <path>      Override Homunculus state root.
  --min-count <n>    Minimum instincts per domain for maintenance evolution.
  --json            Print machine-readable JSON.
  --yes             Permit install writes for the install command.
`);
}

function dispatch(command, options) {
  switch (command) {
    case "start":
      commandStart(options);
      break;
    case "health":
    case "doctor":
      commandHealth(options);
      break;
    case "maintenance":
      commandMaintenance(options);
      break;
    case "status":
      commandStatus(options);
      break;
    case "install":
      commandInstall(options);
      break;
    case "help":
    case "--help":
    case "-h":
      commandHelp();
      break;
    default:
      throw new HelperError(`unknown helper command: ${command}`);
  }
}

function main() {
  try {
    const [command = "help", ...rest] = process.argv.slice(2);
    const options = parseArgs(rest);
    dispatch(command, options);
  } catch (error) {
    if (error instanceof HelperError) {
      console.error(`error: ${error.message}`);
      process.exitCode = error.code;
      return;
    }
    throw error;
  }
}

main();
