#!/usr/bin/env node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = mkdtempSync(join(tmpdir(), "codex-homunculus-test-"));
const script = fileURLToPath(new URL("./homunculus.mjs", import.meta.url));
const helper = fileURLToPath(new URL("./homunculus-helper.mjs", import.meta.url));
const productionInstaller = fileURLToPath(new URL("./install-production.ps1", import.meta.url));
const productionManifest = fileURLToPath(new URL("../production/helper-app.json", import.meta.url));
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

function runHelperRaw(args) {
  return spawnSync(process.execPath, [helper, ...args, "--root", root], {
    encoding: "utf8",
    windowsHide: true
  });
}

function runHelper(args) {
  const result = runHelperRaw(args);
  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    throw new Error(`helper command failed: ${args.join(" ")}`);
  }
  return result.stdout;
}

function runDefaultRaw(args) {
  const env = { ...process.env, CODEX_HOMUNCULUS_HOME: defaultHomunculusFolder };
  delete env.CODEX_HOMUNCULUS_DIR;
  delete env.CODEX_HOMUNCULUS_REPO;
  return spawnSync(process.execPath, [script, ...args], {
    cwd: callerRepo,
    encoding: "utf8",
    env,
    windowsHide: true
  });
}

function runGitIn(cwd, args) {
  return spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true
  });
}

function runProcess(command, args, options = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, { ...options, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      resolvePromise({ status: 1, stdout, stderr: `${stderr}${error.message}` });
    });
    child.on("close", (status) => {
      resolvePromise({ status, stdout, stderr });
    });
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
  const concurrentRepos = Array.from({ length: 8 }, (_, index) => {
    const repo = join(root, `caller-repo-${index}`);
    mkdirSync(repo, { recursive: true });
    return repo;
  });
  const concurrentStarts = await Promise.all(concurrentRepos.map((cwd) =>
    runProcess(process.execPath, [script, "start", "--json"], {
      cwd,
      env: { ...process.env, CODEX_HOMUNCULUS_HOME: defaultHomunculusFolder },
    })
  ));
  for (const [index, result] of concurrentStarts.entries()) {
    if (result.status !== 0) {
      console.error(result.stdout);
      console.error(result.stderr);
      throw new Error(`concurrent start ${index} failed`);
    }
  }
  const identityAfterConcurrentStarts = JSON.parse(readFileSync(join(expectedDefaultRoot, "identity.json"), "utf8"));
  for (const repo of concurrentRepos) {
    const matchingProject = Object.values(identityAfterConcurrentStarts.projects || {}).find((project) => project.root === repo);
    if (!matchingProject) {
      throw new Error(`concurrent start did not retain project history for ${repo}`);
    }
  }
  if (existsSync(join(expectedDefaultRoot, ".lock"))) {
    throw new Error("state lock folder was not cleaned up after concurrent starts");
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
  const defaultAgentsText = readFileSync(join(defaultHomunculusFolder, "AGENTS.md"), "utf8");
  if (defaultAgentsText.includes("node plugins/codex-homunculus/scripts/homunculus.mjs")) {
    throw new Error("default instruction install used a repo-relative Homunculus command");
  }
  if (!defaultAgentsText.includes("any Codex chat or workspace") || !defaultAgentsText.includes("do not ask the user first")) {
    throw new Error("default instruction install did not describe global no-prompt Homunculus use");
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
  for (const expectedDir of ["quarantine", "archive"]) {
    if (!existsSync(join(root, expectedDir))) {
      throw new Error(`${expectedDir} directory was not created by init`);
    }
  }
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
  const firstInstinct = JSON.parse(run(["list", "--json", "--domain", "repo-debugging"]))[0];
  const quarantineOut = run(["quarantine", "--id", firstInstinct.id]);
  if (!quarantineOut.includes("instinct quarantined")) {
    throw new Error("quarantine did not report success");
  }
  const applyAfterQuarantine = run(["apply", "--context", "repo debugging task"]);
  if (applyAfterQuarantine.includes("inspect files")) {
    throw new Error("quarantined instinct still appeared in apply output");
  }
  const forgetMissing = runRaw(["forget", "--id", "missing-id"]);
  if (forgetMissing.status === 0 || !forgetMissing.stderr.includes("no instinct matched")) {
    throw new Error("forget did not refuse a missing id");
  }
  const audit = JSON.parse(run(["audit-memory", "--json"]));
  if (!Array.isArray(audit.duplicates) || !Array.isArray(audit.missing_metadata) || !Array.isArray(audit.sensitive)) {
    throw new Error("audit-memory JSON did not include expected arrays");
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
    "add-instinct",
    "--domain",
    "repo-debugging",
    "--trigger",
    "repo debugging task",
    "--action",
    "inspect files and verify commands before claiming success again",
    "--confidence",
    "0.9",
    "--evidence",
    "smoke test scoring"
  ]);
  const scoredApply = JSON.parse(run(["apply", "--context", "repo debugging task", "--json"]));
  if (!scoredApply[0]?.score_components?.token_overlap) {
    throw new Error("apply JSON did not include score components");
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
  const sensitiveRoot = mkdtempSync(join(tmpdir(), "codex-homunculus-sensitive-state-"));
  const sensitiveEnv = { ...process.env, CODEX_HOMUNCULUS_DIR: sensitiveRoot };
  const sensitiveInit = spawnSync(process.execPath, [script, "init"], {
    encoding: "utf8",
    env: sensitiveEnv,
    windowsHide: true
  });
  if (sensitiveInit.status !== 0) {
    throw new Error("sensitive validation fixture init failed");
  }
  writeFileSync(join(sensitiveRoot, "observations.jsonl"), `${JSON.stringify({ text: "token=super-secret-value" })}\n`, "utf8");
  const strictSensitive = spawnSync(process.execPath, [script, "validate", "--strict"], {
    encoding: "utf8",
    env: sensitiveEnv,
    windowsHide: true
  });
  rmSync(sensitiveRoot, { recursive: true, force: true });
  if (strictSensitive.status === 0 || !strictSensitive.stdout.includes("possible sensitive material")) {
    throw new Error("strict validation did not flag sensitive observations");
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
  const helperHelp = runHelperRaw(["--help"]);
  if (helperHelp.status !== 0 || !helperHelp.stdout.includes("Codex Homunculus Helper")) {
    throw new Error("production helper help did not run");
  }
  const helperStart = JSON.parse(runHelper(["start", "--context", "smoke helper session", "--json"]));
  if (!helperStart.ok || !helperStart.start?.project?.name || !helperStart.validation?.ok) {
    throw new Error("production helper start did not return a healthy JSON summary");
  }
  const helperHealth = JSON.parse(runHelper(["health", "--json"]));
  if (!helperHealth.ok || !helperHealth.doctor?.ok || !helperHealth.validation?.ok || !helperHealth.audit) {
    throw new Error("production helper health did not include doctor, validation, and audit results");
  }
  const helperMaintenance = JSON.parse(runHelper(["maintenance", "--min-count", "99", "--json"]));
  if (!helperMaintenance.ok || !helperMaintenance.validation?.ok || !helperMaintenance.evolution) {
    throw new Error("production helper maintenance did not run validation and evolution");
  }
  const installerText = readFileSync(productionInstaller, "utf8");
  if (!installerText.includes("Register-ScheduledTask") || !installerText.includes("NoMaintenanceTask") || !installerText.includes("-RunLevel Limited")) {
    throw new Error("production installer does not auto-register maintenance with an opt-out flag");
  }
  const helperManifest = JSON.parse(readFileSync(productionManifest, "utf8"));
  if (helperManifest.maintenance?.autoRegisterOnInstall !== true || helperManifest.maintenance?.optOutFlag !== "-NoMaintenanceTask") {
    throw new Error("production helper manifest does not declare install-time maintenance scheduling");
  }
  const globalDoctor = JSON.parse(run(["doctor", "--global", "--json"]));
  if (!globalDoctor.inventory?.source_plugin?.path || !globalDoctor.inventory?.state_root?.path) {
    throw new Error("doctor --global JSON did not include install inventory");
  }
  const syncDryRun = JSON.parse(run(["sync-installed", "--dry-run", "--json"]));
  if (syncDryRun.mode !== "dry-run" || !Array.isArray(syncDryRun.files)) {
    throw new Error("sync-installed --dry-run JSON did not report planned files");
  }
  for (const requiredPath of [
    "package.json",
    "README.md",
    "LICENSE",
    ".codex-plugin/plugin.json",
    "configs/production.env.example",
    "docs/production-helper-app.md",
    "production/helper-app.json",
    "scripts/homunculus-helper.mjs",
    "scripts/codex-homunculus-helper.cmd",
    "scripts/install-production.ps1",
    "scripts/uninstall-production.ps1",
    "skills/codex-homunculus/agents/openai.yaml"
  ]) {
    if (!syncDryRun.files.some((file) => file.from.endsWith(requiredPath.replaceAll("/", "\\")))) {
      throw new Error(`sync-installed did not include ${requiredPath}`);
    }
  }
  const repairDryRun = JSON.parse(run(["repair-installed", "--dry-run", "--json"]));
  if (repairDryRun.mode !== "dry-run" || repairDryRun.sync.mode !== "dry-run") {
    throw new Error("repair-installed --dry-run did not include sync dry-run result");
  }
  run(["doctor"]);
  run(["validate"]);
  console.log("smoke test passed");
} finally {
  rmSync(root, { recursive: true, force: true });
}
