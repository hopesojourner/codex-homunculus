#!/usr/bin/env node
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = mkdtempSync(join(tmpdir(), "codex-homunculus-test-"));
const script = fileURLToPath(new URL("./homunculus.mjs", import.meta.url));

function run(args) {
  const result = runRaw(args);
  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    throw new Error(`command failed: ${args.join(" ")}`);
  }
  return result.stdout;
}

function runRaw(args) {
  return spawnSync(process.execPath, [script, ...args, "--root", root], {
    encoding: "utf8",
    windowsHide: true
  });
}

try {
  run(["init"]);
  run([
    "add-instinct",
    "--domain",
    "repo-debugging",
    "--trigger",
    "repo debugging task",
    "--action",
    "inspect files and verify commands before claiming success",
    "--confidence",
    "0.9",
    "--evidence",
    "smoke test"
  ]);
  const applyOut = run(["apply", "--context", "repo debugging task"]);
  if (!applyOut.includes("inspect files")) {
    throw new Error("apply did not return the saved instinct");
  }
  const exportPath = join(root, "bundle.json");
  run(["export", "--output", exportPath]);
  const exported = JSON.parse(readFileSync(exportPath, "utf8"));
  if (!Array.isArray(exported.instincts) || exported.instincts.length !== 1) {
    throw new Error("export did not include exactly one instinct");
  }
  run([
    "add-instinct",
    "--domain",
    "low-confidence",
    "--trigger",
    "untrusted signal",
    "--action",
    "do not apply without a stronger match",
    "--confidence",
    "0",
    "--evidence",
    "smoke test zero confidence"
  ]);
  const listed = JSON.parse(run(["list", "--json", "--domain", "low-confidence"]));
  if (listed.length !== 1 || listed[0].confidence !== 0) {
    throw new Error("zero confidence was not preserved");
  }
  run([
    "learn",
    "--domain",
    "repo-debugging",
    "--trigger",
    "user corrects a repo debugging shortcut",
    "--action",
    "save the preference as a narrow instinct after checking for secrets",
    "--confidence",
    "0.8",
    "--evidence",
    "smoke test learning"
  ]);
  const instructionPrint = run(["install-codex-instructions", "--print"]);
  if (!instructionPrint.includes("codex-homunculus:start") || !instructionPrint.includes("Homunculus Bootstrap")) {
    throw new Error("install-codex-instructions --print did not emit the expected block");
  }
  const agentsPath = join(root, "AGENTS.md");
  run(["install-codex-instructions", "--target", agentsPath, "--yes"]);
  run(["install-codex-instructions", "--target", agentsPath, "--yes"]);
  const agentsText = readFileSync(agentsPath, "utf8");
  const markerCount = agentsText.match(/codex-homunculus:start/g)?.length || 0;
  if (markerCount !== 1 || !agentsText.includes("apply --context")) {
    throw new Error("install-codex-instructions did not idempotently write AGENTS.md");
  }
  const outsideRefused = runRaw(["install-codex-instructions", "--target", join(tmpdir(), "codex-homunculus-outside.md")]);
  if (outsideRefused.status === 0 || !outsideRefused.stderr.includes("outside the current project root")) {
    throw new Error("outside target write was not refused without --yes");
  }
  const globalRefused = runRaw(["install-codex-instructions", "--global"]);
  if (globalRefused.status === 0 || !globalRefused.stderr.includes("--global writes")) {
    throw new Error("global instruction install was not refused without --yes");
  }
  const refused = runRaw(["observe", "--text", "token=super-secret-value"]);
  if (refused.status === 0 || !refused.stderr.includes("sensitive material")) {
    throw new Error("sensitive observation was not refused");
  }
  const invalidLimit = runRaw(["apply", "--limit", "nope"]);
  if (invalidLimit.status === 0 || !invalidLimit.stderr.includes("limit must be a finite number")) {
    throw new Error("invalid limit was not refused");
  }
  const invalidMinCount = runRaw(["evolve", "--min-count", "0"]);
  if (invalidMinCount.status === 0 || !invalidMinCount.stderr.includes("min-count must be between")) {
    throw new Error("invalid min-count was not refused");
  }
  const invalidImportPath = join(root, "not-json.json");
  writeFileSync(invalidImportPath, "{not json", "utf8");
  const invalidImport = runRaw(["import", "--input", invalidImportPath]);
  if (invalidImport.status === 0 || !invalidImport.stderr.includes("import input is not valid JSON")) {
    throw new Error("invalid import JSON was not refused cleanly");
  }
  const badIdentityRoot = mkdtempSync(join(tmpdir(), "codex-homunculus-bad-identity-"));
  writeFileSync(join(badIdentityRoot, "identity.json"), "[]", "utf8");
  const badIdentity = spawnSync(process.execPath, [script, "start", "--root", badIdentityRoot], {
    encoding: "utf8",
    windowsHide: true
  });
  rmSync(badIdentityRoot, { recursive: true, force: true });
  if (badIdentity.status === 0 || !badIdentity.stderr.includes("identity must be a JSON object")) {
    throw new Error("wrong-shaped identity JSON was not refused cleanly");
  }
  run(["import", "--input", exportPath]);
  run(["import", "--input", exportPath]);
  const inherited = readdirSync(join(root, "instincts", "inherited")).filter((name) => name.endsWith(".md"));
  if (inherited.length !== 2) {
    throw new Error("duplicate imports did not create unique inherited files");
  }
  run(["doctor"]);
  run(["validate"]);
  console.log("smoke test passed");
} finally {
  rmSync(root, { recursive: true, force: true });
}
