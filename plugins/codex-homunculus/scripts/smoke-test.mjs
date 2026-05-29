#!/usr/bin/env node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = mkdtempSync(join(tmpdir(), "codex-homunculus-test-"));
const script = fileURLToPath(new URL("./homunculus.mjs", import.meta.url));
const commandWrapper = fileURLToPath(new URL("./codex-homunculus.cmd", import.meta.url));
const defaultHomunculusFolder = join(root, "local-homunculus-folder");
const callerRepo = join(root, "caller-repo");
mkdirSync(defaultHomunculusFolder, { recursive: true });
mkdirSync(callerRepo, { recursive: true });

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

function homunculusEnv(overrides) {
  const env = { ...process.env };
  delete env.CODEX_HOMUNCULUS_HOME;
  delete env.CODEX_HOMUNCULUS_DIR;
  delete env.CODEX_HOMUNCULUS_REPO;
  return { ...env, ...overrides };
}

function runWithHomunculusEnv(args, overrides, cwd = callerRepo) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: "utf8",
    env: homunculusEnv(overrides),
    windowsHide: true
  });
}

function runDefaultRaw(args) {
  return runWithHomunculusEnv(args, { CODEX_HOMUNCULUS_HOME: defaultHomunculusFolder });
}

function runGitIn(cwd, args) {
  return spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true
  });
}

try {
  const defaultStart = runDefaultRaw(["start", "--json"]);
  if (defaultStart.status !== 0) {
    console.error(defaultStart.stdout);
    console.error(defaultStart.stderr);
    throw new Error("default start failed");
  }
  const defaultSummary = JSON.parse(defaultStart.stdout);
  const expectedDefaultRoot = defaultHomunculusFolder;
  if (defaultSummary.root !== expectedDefaultRoot) {
    throw new Error(`default state root was ${defaultSummary.root}, expected ${expectedDefaultRoot}`);
  }
  if (defaultSummary.project.name !== "caller-repo" || defaultSummary.project.root !== callerRepo) {
    throw new Error("default start did not preserve the caller repo as active project context");
  }
  const defaultIdentity = JSON.parse(readFileSync(join(expectedDefaultRoot, "identity.json"), "utf8"));
  if (defaultIdentity.state_repository.root !== defaultHomunculusFolder) {
    throw new Error("default state repository metadata did not point at the local Homunculus folder");
  }
  if (defaultIdentity.active_project.root !== callerRepo) {
    throw new Error("default identity did not record the caller repo as active_project");
  }
  if (!defaultIdentity.projects?.[defaultIdentity.active_project.id]?.last_seen_at) {
    throw new Error("default identity did not retain per-project history");
  }
  if (existsSync(join(callerRepo, ".codex"))) {
    throw new Error("default start wrote state into the caller repo");
  }
  const defaultInstall = runDefaultRaw(["install-codex-instructions"]);
  if (defaultInstall.status !== 0) {
    console.error(defaultInstall.stdout);
    console.error(defaultInstall.stderr);
    throw new Error("default instruction install failed");
  }
  if (!existsSync(join(defaultHomunculusFolder, "AGENTS.md"))) {
    throw new Error("default instruction install did not target the local Homunculus folder");
  }
  if (existsSync(join(callerRepo, "AGENTS.md"))) {
    throw new Error("default instruction install wrote into the caller repo");
  }
  const stateParentRepo = join(root, "state-parent-repo");
  const explicitStateRoot = join(stateParentRepo, "custom-state");
  mkdirSync(stateParentRepo, { recursive: true });
  const explicitGitInit = runGitIn(stateParentRepo, ["init"]);
  if (explicitGitInit.status !== 0) {
    console.error(explicitGitInit.stdout);
    console.error(explicitGitInit.stderr);
    throw new Error("git init failed for explicit state parent repo");
  }
  const explicitStart = runWithHomunculusEnv(["start", "--json"], { CODEX_HOMUNCULUS_DIR: explicitStateRoot });
  if (explicitStart.status !== 0) {
    console.error(explicitStart.stdout);
    console.error(explicitStart.stderr);
    throw new Error("explicit CODEX_HOMUNCULUS_DIR start failed");
  }
  const explicitSummary = JSON.parse(explicitStart.stdout);
  if (explicitSummary.root !== explicitStateRoot) {
    throw new Error(`explicit state root was ${explicitSummary.root}, expected ${explicitStateRoot}`);
  }
  if (explicitSummary.state_repository.root !== explicitStateRoot) {
    throw new Error("state_repository metadata did not preserve the explicit state directory");
  }
  const explicitInstall = runWithHomunculusEnv(["install-codex-instructions"], { CODEX_HOMUNCULUS_DIR: explicitStateRoot });
  if (explicitInstall.status !== 0) {
    console.error(explicitInstall.stdout);
    console.error(explicitInstall.stderr);
    throw new Error("explicit state instruction install failed");
  }
  if (!existsSync(join(explicitStateRoot, "AGENTS.md"))) {
    throw new Error("explicit state instruction install did not target the explicit state directory");
  }
  if (existsSync(join(stateParentRepo, "AGENTS.md"))) {
    throw new Error("explicit state instruction install wrote to the parent repo root");
  }
  const gitInit = runGitIn(defaultHomunculusFolder, ["init"]);
  if (gitInit.status !== 0) {
    console.error(gitInit.stdout);
    console.error(gitInit.stderr);
    throw new Error("git init failed in the local Homunculus folder");
  }
  const guardedValidate = runDefaultRaw(["validate", "--json"]);
  if (guardedValidate.status !== 0) {
    console.error(guardedValidate.stdout);
    console.error(guardedValidate.stderr);
    throw new Error("validate failed with protected untracked state");
  }
  const guardedResult = JSON.parse(guardedValidate.stdout);
  if (!guardedResult.privacy || guardedResult.privacy.tracked.length !== 0 || guardedResult.privacy.notIgnored.length !== 0) {
    throw new Error("validate did not confirm git privacy guards");
  }
  const forcedAdd = runGitIn(defaultHomunculusFolder, ["add", "-f", "identity.json"]);
  if (forcedAdd.status !== 0) {
    console.error(forcedAdd.stdout);
    console.error(forcedAdd.stderr);
    throw new Error("forced add of private state failed in smoke test setup");
  }
  const blockedValidate = runDefaultRaw(["validate", "--json"]);
  if (blockedValidate.status === 0) {
    throw new Error("validate did not fail when private state was tracked");
  }
  const unstagePrivateState = runGitIn(defaultHomunculusFolder, ["rm", "--cached", "--", "identity.json"]);
  if (unstagePrivateState.status !== 0) {
    console.error(unstagePrivateState.stdout);
    console.error(unstagePrivateState.stderr);
    throw new Error("failed to unstage private state after privacy test");
  }
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
  const irrelevantApplyOut = run(["apply", "--context", "frontend css styling"]);
  if (!irrelevantApplyOut.includes("no matching instincts") || irrelevantApplyOut.includes("inspect files")) {
    throw new Error("apply returned an instinct with no context or domain match");
  }
  const domainApplyOut = run(["apply", "--domain", "repo-debugging", "--context", "frontend css styling"]);
  if (!domainApplyOut.includes("inspect files")) {
    throw new Error("apply did not return the saved instinct for an exact domain match");
  }
  const exportPath = join(root, "bundle.json");
  run(["export", "--output", exportPath]);
  const exported = JSON.parse(readFileSync(exportPath, "utf8"));
  if (!Array.isArray(exported.instincts) || exported.instincts.length !== 1) {
    throw new Error("export did not include exactly one instinct");
  }
  if (!exported.instincts[0].metadata.project_id || !exported.instincts[0].metadata.project_root) {
    throw new Error("exported instinct did not retain source project metadata");
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
  const observations = readFileSync(join(root, "observations.jsonl"), "utf8")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const learning = observations.find((record) => record.kind === "learning");
  if (!learning?.project?.root || learning.project_id !== learning.project.id) {
    throw new Error("learning observation did not retain detailed source project metadata");
  }
  const instructionPrint = run(["install-codex-instructions", "--print"]);
  if (!instructionPrint.includes("codex-homunculus:start") || !instructionPrint.includes("Homunculus Bootstrap") || !instructionPrint.includes(script)) {
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
  if (outsideRefused.status === 0 || !outsideRefused.stderr.includes("outside the local Homunculus folder")) {
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
  const missingRootValue = spawnSync(process.execPath, [script, "init", "--root"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true
  });
  if (missingRootValue.status === 0 || !missingRootValue.stderr.includes("root requires a value") || existsSync(join(root, "true"))) {
    throw new Error("missing root value was not refused cleanly");
  }
  const missingOutputValue = runRaw(["export", "--output"]);
  if (missingOutputValue.status === 0 || !missingOutputValue.stderr.includes("output requires a value")) {
    throw new Error("missing output value was not refused cleanly");
  }
  const missingContextValue = runRaw(["apply", "--context"]);
  if (missingContextValue.status === 0 || !missingContextValue.stderr.includes("context requires a value")) {
    throw new Error("missing context value was not refused cleanly");
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
  const malformedImportPath = join(root, "malformed-import.json");
  writeFileSync(malformedImportPath, JSON.stringify({ instincts: [null] }), "utf8");
  const malformedImport = runRaw(["import", "--input", malformedImportPath]);
  if (malformedImport.status === 0 || !malformedImport.stderr.includes("imported instinct 1 must be an object")) {
    throw new Error("malformed import item was not refused cleanly");
  }
  const missingMarkdownImportPath = join(root, "missing-markdown-import.json");
  writeFileSync(missingMarkdownImportPath, JSON.stringify({ instincts: [{ filename: "bad.md", metadata: null, markdown: null }] }), "utf8");
  const missingMarkdownImport = runRaw(["import", "--input", missingMarkdownImportPath]);
  if (missingMarkdownImport.status === 0 || !missingMarkdownImport.stderr.includes("markdown must be a non-empty string")) {
    throw new Error("missing markdown import was not refused cleanly");
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
  if (process.platform === "win32") {
    const wrapperHelp = spawnSync("cmd.exe", ["/c", commandWrapper, "--help"], {
      encoding: "utf8",
      env: { ...process.env, CODEX_HOMUNCULUS_DIR: root },
      windowsHide: true
    });
    if (wrapperHelp.status !== 0 || !wrapperHelp.stdout.includes("Codex Homunculus")) {
      throw new Error("Windows codex-homunculus wrapper did not run the CLI");
    }
  }
  run(["doctor"]);
  run(["validate"]);
  console.log("smoke test passed");
} finally {
  rmSync(root, { recursive: true, force: true });
}
