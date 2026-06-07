# Homunculus Reliability-First Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reliable install diagnostics, installed-copy sync, memory lifecycle controls, stricter validation, and deterministic retrieval improvements to Codex Homunculus.

**Architecture:** Keep the current no-dependency Node.js CLI while adding small helper functions inside `plugins/codex-homunculus/scripts/homunculus.mjs`. Extend the smoke test as the regression suite, then update docs and skill references after behavior is passing.

**Tech Stack:** Node.js ES modules, PowerShell/Windows wrappers, filesystem JSON/Markdown state, npm scripts.

---

## Baseline Notes

This plan assumes the working tree already contains the approved state-root behavior: Homunculus state defaults to the Homunculus repo/install root, while caller repo metadata is stored in `identity.json`, observations, and instinct frontmatter.

Implementation should not revert the existing unstaged changes in these files:

- `README.md`
- `plugins/codex-homunculus/scripts/homunculus.mjs`
- `plugins/codex-homunculus/scripts/smoke-test.mjs`
- `plugins/codex-homunculus/skills/codex-homunculus/SKILL.md`
- `plugins/codex-homunculus/skills/codex-homunculus/references/automation-options.md`
- `plugins/codex-homunculus/skills/codex-homunculus/references/state-format.md`

## File Structure

- Modify `plugins/codex-homunculus/scripts/homunculus.mjs`: add lifecycle directories, active-memory filtering, ranking explanations, install inventory, sync, repair, and new command routing.
- Modify `plugins/codex-homunculus/scripts/smoke-test.mjs`: add regression coverage for lifecycle commands, global diagnostics, sync dry-run, and cross-repo installed behavior.
- Modify `README.md`: document reliability-first commands and operational boundaries.
- Modify `plugins/codex-homunculus/skills/codex-homunculus/SKILL.md`: teach Codex when to use audit, quarantine, forget, sync, and repair.
- Modify `plugins/codex-homunculus/skills/codex-homunculus/references/state-format.md`: document `quarantine/`, `archive/`, active status, and usage metadata.
- Modify `plugins/codex-homunculus/skills/codex-homunculus/references/automation-options.md`: document installed-copy sync and wrapper verification.

---

### Task 1: Add State Directories and Active Memory Loading

**Files:**
- Modify: `plugins/codex-homunculus/scripts/homunculus.mjs`
- Test: `plugins/codex-homunculus/scripts/smoke-test.mjs`

- [ ] **Step 1: Extend state directory tests first**

Add this check after the existing `run(["init"]);` call in `plugins/codex-homunculus/scripts/smoke-test.mjs`:

```js
  for (const expectedDir of ["quarantine", "archive"]) {
    if (!existsSync(join(root, expectedDir))) {
      throw new Error(`${expectedDir} directory was not created by init`);
    }
  }
```

- [ ] **Step 2: Run the smoke test and verify it fails**

Run:

```powershell
cd plugins\codex-homunculus
npm test
```

Expected: FAIL with `quarantine directory was not created by init`.

- [ ] **Step 3: Add the new directories to `dirs`**

In `plugins/codex-homunculus/scripts/homunculus.mjs`, update `dirs(root)` to include:

```js
    quarantine: join(root, "quarantine"),
    archive: join(root, "archive"),
```

The returned object should include `quarantine` and `archive` beside `exports`.

- [ ] **Step 4: Ensure the directories are created**

In `ensureState(root)`, update the directory list from:

```js
  for (const path of [d.root, d.personal, d.inherited, d.evolvedSkills, d.exports]) {
```

to:

```js
  for (const path of [d.root, d.personal, d.inherited, d.evolvedSkills, d.exports, d.quarantine, d.archive]) {
```

- [ ] **Step 5: Load quarantined files with inactive scope**

Replace the `files` array construction in `loadInstincts(root)` with:

```js
  const files = [
    ...listMarkdownFiles(d.personal).map((path) => ({ path, scope: "personal", active: true })),
    ...listMarkdownFiles(d.inherited).map((path) => ({ path, scope: "inherited", active: true })),
    ...listMarkdownFiles(d.quarantine).map((path) => ({ path, scope: "quarantine", active: false }))
  ];
```

Update the returned object to include `active`:

```js
      active,
```

- [ ] **Step 6: Add active filtering helper**

Add this function after `loadInstincts(root)`:

```js
function activeInstincts(root) {
  return loadInstincts(root).filter((item) => item.active && String(item.meta.status || "active") === "active");
}
```

- [ ] **Step 7: Use active instincts in retrieval and evolution**

In `commandApply(root, options)`, change:

```js
  const matches = loadInstincts(root)
```

to:

```js
  const matches = activeInstincts(root)
```

In `commandEvolve(root, options)`, change:

```js
  const groups = groupByDomain(loadInstincts(root));
```

to:

```js
  const groups = groupByDomain(activeInstincts(root));
```

- [ ] **Step 8: Run the smoke test and commit**

Run:

```powershell
cd plugins\codex-homunculus
npm test
```

Expected: PASS.

Commit:

```powershell
git add plugins/codex-homunculus/scripts/homunculus.mjs plugins/codex-homunculus/scripts/smoke-test.mjs
git commit -m "feat: add homunculus lifecycle state directories"
```

---

### Task 2: Add Quarantine and Forget Commands

**Files:**
- Modify: `plugins/codex-homunculus/scripts/homunculus.mjs`
- Test: `plugins/codex-homunculus/scripts/smoke-test.mjs`

- [ ] **Step 1: Add failing quarantine and forget tests**

In `plugins/codex-homunculus/scripts/smoke-test.mjs`, after the first successful `applyOut` check, add:

```js
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
```

- [ ] **Step 2: Run the smoke test and verify it fails**

Run:

```powershell
cd plugins\codex-homunculus
npm test
```

Expected: FAIL with a missing `quarantine` command or `unknown command: quarantine`.

- [ ] **Step 3: Add path movement helper**

Add `renameSync` to the fs import:

```js
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, appendFileSync, renameSync } from "node:fs";
```

Add this function after `updateFrontmatter(text, updates)`:

```js
function moveInstinctFile(item, targetDir, updates) {
  ensureDir(targetDir);
  const text = readFileSync(item.path, "utf8");
  const target = uniquePath(join(targetDir, basename(item.path)));
  writeFileSync(item.path, updateFrontmatter(text, updates), "utf8");
  renameSync(item.path, target);
  return target;
}
```

- [ ] **Step 4: Add instinct lookup helper**

Add this function after `activeInstincts(root)`:

```js
function findInstinct(root, options) {
  const query = String(options.id || options.path || "");
  if (!query) {
    die("command requires --id or --path");
  }
  const matches = loadInstincts(root).filter((item) => item.meta.id === query || item.path === resolve(query));
  if (matches.length === 0) {
    die(`no instinct matched: ${query}`);
  }
  if (matches.length > 1) {
    die(`multiple instincts matched: ${query}`);
  }
  return matches[0];
}
```

- [ ] **Step 5: Implement `commandQuarantine`**

Add this function after `commandList(root, options)`:

```js
function commandQuarantine(root, options) {
  const state = ensureState(root);
  const item = findInstinct(root, options);
  const target = moveInstinctFile(item, state.dirs.quarantine, {
    status: "quarantined",
    updated_at: now()
  });
  console.log(`instinct quarantined: ${target}`);
}
```

- [ ] **Step 6: Implement `commandForget`**

Add this function after `commandQuarantine(root, options)`:

```js
function commandForget(root, options) {
  const state = ensureState(root);
  const item = findInstinct(root, options);
  const target = moveInstinctFile(item, state.dirs.archive, {
    status: "archived",
    updated_at: now()
  });
  console.log(`instinct archived: ${target}`);
}
```

This command archives instead of deleting. The command name stays `forget` because active retrieval forgets the instinct.

- [ ] **Step 7: Wire commands into help and router**

In `commandHelp()`, add:

```text
  quarantine          Move an instinct out of active retrieval.
  forget              Archive an instinct out of active retrieval.
```

In `main()`, add cases:

```js
    case "quarantine":
      commandQuarantine(root, options);
      break;
    case "forget":
      commandForget(root, options);
      break;
```

- [ ] **Step 8: Run tests and commit**

Run:

```powershell
cd plugins\codex-homunculus
npm test
```

Expected: PASS.

Commit:

```powershell
git add plugins/codex-homunculus/scripts/homunculus.mjs plugins/codex-homunculus/scripts/smoke-test.mjs
git commit -m "feat: add homunculus memory lifecycle commands"
```

---

### Task 3: Add Memory Audit Command

**Files:**
- Modify: `plugins/codex-homunculus/scripts/homunculus.mjs`
- Test: `plugins/codex-homunculus/scripts/smoke-test.mjs`

- [ ] **Step 1: Add failing audit test**

After the quarantine test block in `smoke-test.mjs`, add:

```js
  const audit = JSON.parse(run(["audit-memory", "--json"]));
  if (!Array.isArray(audit.duplicates) || !Array.isArray(audit.missing_metadata) || !Array.isArray(audit.sensitive)) {
    throw new Error("audit-memory JSON did not include expected arrays");
  }
```

- [ ] **Step 2: Run the smoke test and verify it fails**

Run:

```powershell
cd plugins\codex-homunculus
npm test
```

Expected: FAIL with `unknown command: audit-memory`.

- [ ] **Step 3: Implement audit helpers**

Add this function after `commandForget(root, options)`:

```js
function commandAuditMemory(root, options) {
  ensureState(root);
  const instincts = loadInstincts(root);
  const bySignature = new Map();
  const duplicates = [];
  const missingMetadata = [];
  const sensitive = [];
  for (const item of instincts) {
    const signature = `${item.meta.domain || ""}\n${item.meta.trigger || ""}\n${item.meta.action || ""}`.toLowerCase();
    if (bySignature.has(signature)) {
      duplicates.push({ first: bySignature.get(signature), duplicate: item.path, id: item.meta.id || "" });
    } else {
      bySignature.set(signature, item.path);
    }
    for (const field of REQUIRED_INSTINCT_FIELDS) {
      if (item.meta[field] === undefined || item.meta[field] === "") {
        missingMetadata.push({ path: item.path, field });
      }
    }
    const findings = detectSensitive(item.text);
    if (findings.length > 0) {
      sensitive.push({ path: item.path, findings: [...new Set(findings)] });
    }
  }
  const result = { duplicates, missing_metadata: missingMetadata, sensitive };
  if (options.json) {
    printJson(result);
    return;
  }
  console.log(`duplicates: ${duplicates.length}`);
  console.log(`missing metadata: ${missingMetadata.length}`);
  console.log(`sensitive findings: ${sensitive.length}`);
}
```

- [ ] **Step 4: Wire audit into help and router**

In `commandHelp()`, add:

```text
  audit-memory        Report duplicate, incomplete, or sensitive memories.
```

In `main()`, add:

```js
    case "audit-memory":
      commandAuditMemory(root, options);
      break;
```

- [ ] **Step 5: Run tests and commit**

Run:

```powershell
cd plugins\codex-homunculus
npm test
```

Expected: PASS.

Commit:

```powershell
git add plugins/codex-homunculus/scripts/homunculus.mjs plugins/codex-homunculus/scripts/smoke-test.mjs
git commit -m "feat: add homunculus memory audit"
```

---

### Task 4: Add Explainable Retrieval Metadata

**Files:**
- Modify: `plugins/codex-homunculus/scripts/homunculus.mjs`
- Test: `plugins/codex-homunculus/scripts/smoke-test.mjs`

- [ ] **Step 1: Add failing JSON scoring test**

In `smoke-test.mjs`, after the `low-confidence` listing assertion and before the `learn` command block, add:

```js
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
```

- [ ] **Step 2: Run the smoke test and verify it fails**

Run:

```powershell
cd plugins\codex-homunculus
npm test
```

Expected: FAIL with `apply JSON did not include score components`.

- [ ] **Step 3: Replace score function with component function**

Replace `scoreInstinct(instinct, context, domain)` with:

```js
function scoreInstinct(instinct, context, domain, project = null) {
  const meta = instinct.meta;
  const haystack = tokenize(`${meta.title || ""} ${meta.trigger || ""} ${meta.action || ""} ${meta.domain || ""}`);
  const query = tokenize(`${context || ""} ${domain || ""}`);
  const components = {
    confidence: Number(meta.confidence ?? 0.5),
    domain_match: domain && String(meta.domain || "").toLowerCase() === String(domain).toLowerCase() ? 3 : 0,
    project_match: project && meta.project_id && meta.project_id === project.id ? 2 : 0,
    token_overlap: 0,
    usage: Math.min(Number(meta.apply_count || 0), 5) * 0.1
  };
  for (const token of query) {
    if (haystack.has(token)) {
      components.token_overlap += 1;
    }
  }
  const score = Object.values(components).reduce((sum, value) => sum + value, 0);
  return { score, components };
}
```

- [ ] **Step 4: Update `commandApply` to use explainable scoring**

In `commandApply(root, options)`, change the scoring map to:

```js
  const state = ensureState(root);
  const context = String(options.context || options.text || "");
  const limit = parseBoundedNumber(options.limit, 5, "limit", { min: 1, max: 1000, integer: true });
  const matches = activeInstincts(root)
    .map((instinct) => {
      const scored = scoreInstinct(instinct, context, options.domain, state.identity.active_project);
      return { instinct, score: scored.score, components: scored.components };
    })
```

Keep the existing `.filter`, `.sort`, and `.slice` logic.

Update JSON output to include:

```js
    printJson(matches.map((item) => ({ score: item.score, score_components: item.components, scope: item.instinct.scope, path: item.instinct.path, ...item.instinct.meta })));
```

- [ ] **Step 5: Run tests and commit**

Run:

```powershell
cd plugins\codex-homunculus
npm test
```

Expected: PASS.

Commit:

```powershell
git add plugins/codex-homunculus/scripts/homunculus.mjs plugins/codex-homunculus/scripts/smoke-test.mjs
git commit -m "feat: explain homunculus retrieval scoring"
```

---

### Task 5: Add Global Install Inventory and `doctor --global`

**Files:**
- Modify: `plugins/codex-homunculus/scripts/homunculus.mjs`
- Test: `plugins/codex-homunculus/scripts/smoke-test.mjs`

- [ ] **Step 1: Add failing global doctor test**

Near the existing wrapper test block in `smoke-test.mjs`, add:

```js
  const globalDoctor = JSON.parse(run(["doctor", "--global", "--json"]));
  if (!globalDoctor.inventory?.source_plugin?.path || !globalDoctor.inventory?.state_root?.path) {
    throw new Error("doctor --global JSON did not include install inventory");
  }
```

- [ ] **Step 2: Run the smoke test and verify it fails**

Run:

```powershell
cd plugins\codex-homunculus
npm test
```

Expected: FAIL with `doctor --global JSON did not include install inventory`.

- [ ] **Step 3: Add install inventory helpers**

Add these functions before `commandDoctor(root, options)`:

```js
function pluginRoot() {
  return resolve(dirname(SCRIPT_PATH), "..");
}

function codexHome() {
  return process.env.CODEX_HOME || join(homedir(), ".codex");
}

function installInventory(root) {
  const home = codexHome();
  const sourcePlugin = pluginRoot();
  const marketplacePlugin = join(home, "local-marketplaces", "codex-homunculus", "plugins", "codex-homunculus");
  const cacheRoot = join(home, "plugins", "cache", "codex-homunculus", "codex-homunculus", VERSION);
  const wrapper = join(home, "bin", process.platform === "win32" ? "codex-homunculus.cmd" : "codex-homunculus");
  return {
    codex_home: { path: home, exists: existsSync(home) },
    source_plugin: { path: sourcePlugin, exists: existsSync(join(sourcePlugin, "scripts", "homunculus.mjs")) },
    local_marketplace_plugin: { path: marketplacePlugin, exists: existsSync(join(marketplacePlugin, "scripts", "homunculus.mjs")) },
    plugin_cache: { path: cacheRoot, exists: existsSync(join(cacheRoot, "scripts", "homunculus.mjs")) },
    wrapper: { path: wrapper, exists: existsSync(wrapper) },
    state_root: { path: root, exists: existsSync(root) }
  };
}
```

- [ ] **Step 4: Include inventory in `doctor --global`**

In `commandDoctor(root, options)`, after computing `checks`, add:

```js
  const inventory = options.global ? installInventory(root) : null;
```

Update JSON output from:

```js
    printJson({ ok, checks });
```

to:

```js
    printJson({ ok, checks, inventory });
```

For plain text output, add after the checks loop:

```js
  if (inventory) {
    for (const [name, item] of Object.entries(inventory)) {
      console.log(`${item.exists ? "ok" : "missing"} ${name}: ${item.path}`);
    }
  }
```

- [ ] **Step 5: Run tests and commit**

Run:

```powershell
cd plugins\codex-homunculus
npm test
```

Expected: PASS.

Commit:

```powershell
git add plugins/codex-homunculus/scripts/homunculus.mjs plugins/codex-homunculus/scripts/smoke-test.mjs
git commit -m "feat: add homunculus global doctor inventory"
```

---

### Task 6: Add `sync-installed`

**Files:**
- Modify: `plugins/codex-homunculus/scripts/homunculus.mjs`
- Test: `plugins/codex-homunculus/scripts/smoke-test.mjs`

- [ ] **Step 1: Add failing sync dry-run test**

After the global doctor test in `smoke-test.mjs`, add:

```js
  const syncDryRun = JSON.parse(run(["sync-installed", "--dry-run", "--json"]));
  if (syncDryRun.mode !== "dry-run" || !Array.isArray(syncDryRun.files)) {
    throw new Error("sync-installed --dry-run JSON did not report planned files");
  }
```

- [ ] **Step 2: Run the smoke test and verify it fails**

Run:

```powershell
cd plugins\codex-homunculus
npm test
```

Expected: FAIL with `unknown command: sync-installed`.

- [ ] **Step 3: Add copy support to imports**

Add `copyFileSync` to the fs import:

```js
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, appendFileSync, renameSync, copyFileSync } from "node:fs";
```

- [ ] **Step 4: Add synced file manifest**

Add this constant near `SENSITIVE_PATTERNS`:

```js
const INSTALL_SYNC_FILES = [
  "scripts/homunculus.mjs",
  "scripts/smoke-test.mjs",
  "skills/codex-homunculus/SKILL.md",
  "skills/codex-homunculus/references/automation-options.md",
  "skills/codex-homunculus/references/state-format.md"
];
```

- [ ] **Step 5: Implement sync command**

Add this function after `installInventory(root)`:

```js
function commandSyncInstalled(root, options) {
  const source = pluginRoot();
  const inventory = installInventory(root);
  const targets = [inventory.local_marketplace_plugin, inventory.plugin_cache].filter((item) => item.exists);
  const files = [];
  for (const target of targets) {
    for (const relativePath of INSTALL_SYNC_FILES) {
      const from = join(source, relativePath);
      const to = join(target.path, relativePath);
      files.push({ from, to, exists: existsSync(from) });
    }
  }
  const dryRun = options["dry-run"] || !options.yes;
  if (!dryRun) {
    for (const file of files) {
      if (!file.exists) {
        die(`source file missing: ${file.from}`);
      }
      ensureDir(dirname(file.to));
      copyFileSync(file.from, file.to);
    }
  }
  const result = { mode: dryRun ? "dry-run" : "write", files };
  if (options.json) {
    printJson(result);
    return;
  }
  console.log(`sync-installed ${result.mode}: ${files.length} planned file copies`);
}
```

- [ ] **Step 6: Wire sync into help and router**

In `commandHelp()`, add:

```text
  sync-installed      Sync source plugin files into installed copies.
```

In `main()`, add:

```js
    case "sync-installed":
      commandSyncInstalled(root, options);
      break;
```

- [ ] **Step 7: Run tests and commit**

Run:

```powershell
cd plugins\codex-homunculus
npm test
```

Expected: PASS.

Commit:

```powershell
git add plugins/codex-homunculus/scripts/homunculus.mjs plugins/codex-homunculus/scripts/smoke-test.mjs
git commit -m "feat: add homunculus installed-copy sync"
```

---

### Task 7: Add `repair-installed`

**Files:**
- Modify: `plugins/codex-homunculus/scripts/homunculus.mjs`
- Test: `plugins/codex-homunculus/scripts/smoke-test.mjs`

- [ ] **Step 1: Add failing repair dry-run test**

After the sync dry-run test in `smoke-test.mjs`, add:

```js
  const repairDryRun = JSON.parse(run(["repair-installed", "--dry-run", "--json"]));
  if (repairDryRun.mode !== "dry-run" || repairDryRun.sync.mode !== "dry-run") {
    throw new Error("repair-installed --dry-run did not include sync dry-run result");
  }
```

- [ ] **Step 2: Run the smoke test and verify it fails**

Run:

```powershell
cd plugins\codex-homunculus
npm test
```

Expected: FAIL with `unknown command: repair-installed`.

- [ ] **Step 3: Refactor sync into reusable result helper**

Extract the body of `commandSyncInstalled` into:

```js
function syncInstalledResult(root, options) {
  const source = pluginRoot();
  const inventory = installInventory(root);
  const targets = [inventory.local_marketplace_plugin, inventory.plugin_cache].filter((item) => item.exists);
  const files = [];
  for (const target of targets) {
    for (const relativePath of INSTALL_SYNC_FILES) {
      const from = join(source, relativePath);
      const to = join(target.path, relativePath);
      files.push({ from, to, exists: existsSync(from) });
    }
  }
  const dryRun = options["dry-run"] || !options.yes;
  if (!dryRun) {
    for (const file of files) {
      if (!file.exists) {
        die(`source file missing: ${file.from}`);
      }
      ensureDir(dirname(file.to));
      copyFileSync(file.from, file.to);
    }
  }
  return { mode: dryRun ? "dry-run" : "write", files };
}
```

Then make `commandSyncInstalled` call `syncInstalledResult(root, options)`.

- [ ] **Step 4: Implement repair command**

Add this function after `commandSyncInstalled(root, options)`:

```js
function commandRepairInstalled(root, options) {
  const sync = syncInstalledResult(root, options);
  const validation = validateState(root, {});
  const result = {
    mode: sync.mode,
    sync,
    validation
  };
  if (options.json) {
    printJson(result);
    return;
  }
  console.log(`repair-installed ${result.mode}`);
  console.log(`validation: ${validation.ok ? "passed" : "failed"}`);
}
```

- [ ] **Step 5: Wire repair into help and router**

In `commandHelp()`, add:

```text
  repair-installed    Sync installed copies and validate state.
```

In `main()`, add:

```js
    case "repair-installed":
      commandRepairInstalled(root, options);
      break;
```

- [ ] **Step 6: Run tests and commit**

Run:

```powershell
cd plugins\codex-homunculus
npm test
```

Expected: PASS.

Commit:

```powershell
git add plugins/codex-homunculus/scripts/homunculus.mjs plugins/codex-homunculus/scripts/smoke-test.mjs
git commit -m "feat: add homunculus installed repair"
```

---

### Task 8: Extend Strict Validation Coverage

**Files:**
- Modify: `plugins/codex-homunculus/scripts/homunculus.mjs`
- Test: `plugins/codex-homunculus/scripts/smoke-test.mjs`

- [ ] **Step 1: Add failing strict validation test for sensitive observations**

After the existing sensitive observation refusal test in `smoke-test.mjs`, add:

```js
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
```

- [ ] **Step 2: Run the smoke test and verify it fails**

Run:

```powershell
cd plugins\codex-homunculus
npm test
```

Expected: FAIL with `strict validation did not flag sensitive observations`.

- [ ] **Step 3: Add JSONL sensitive scanner**

Add this function after `parseJsonl(path, errors)`:

```js
function scanJsonlSensitive(path, warnings) {
  if (!existsSync(path)) {
    return;
  }
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!line.trim()) {
      return;
    }
    const findings = detectSensitive(line);
    if (findings.length > 0) {
      warnings.push(`${path}:${index + 1}: possible sensitive material (${[...new Set(findings)].join(", ")})`);
    }
  });
}
```

- [ ] **Step 4: Call scanner from validation**

In `validateState(root, options)`, after `parseJsonl(d.observations, errors);`, add:

```js
  scanJsonlSensitive(d.observations, warnings);
```

- [ ] **Step 5: Run tests and commit**

Run:

```powershell
cd plugins\codex-homunculus
npm test
```

Expected: PASS.

Commit:

```powershell
git add plugins/codex-homunculus/scripts/homunculus.mjs plugins/codex-homunculus/scripts/smoke-test.mjs
git commit -m "feat: extend homunculus strict validation"
```

---

### Task 9: Update Documentation and Skill References

**Files:**
- Modify: `README.md`
- Modify: `plugins/codex-homunculus/skills/codex-homunculus/SKILL.md`
- Modify: `plugins/codex-homunculus/skills/codex-homunculus/references/state-format.md`
- Modify: `plugins/codex-homunculus/skills/codex-homunculus/references/automation-options.md`

- [ ] **Step 1: Update README command guide**

Add these lines to the CLI example block in `README.md`:

```powershell
node scripts\homunculus.mjs doctor --global
node scripts\homunculus.mjs audit-memory
node scripts\homunculus.mjs quarantine --id <instinct-id>
node scripts\homunculus.mjs forget --id <instinct-id>
node scripts\homunculus.mjs sync-installed --dry-run
node scripts\homunculus.mjs sync-installed --yes
node scripts\homunculus.mjs repair-installed --dry-run
```

- [ ] **Step 2: Update skill workflow**

In `plugins/codex-homunculus/skills/codex-homunculus/SKILL.md`, add these bullets to the command guide:

```markdown
- `audit-memory`: report duplicate, incomplete, or sensitive-looking memories.
- `quarantine`: move an instinct out of active retrieval while preserving it for review.
- `forget`: archive an instinct so it no longer influences future tasks.
- `doctor --global`: inspect the source checkout, installed copies, wrapper, state root, and Codex home.
- `sync-installed`: copy verified source plugin files to installed copies; use `--dry-run` before `--yes`.
- `repair-installed`: sync installed copies and validate Homunculus state.
```

- [ ] **Step 3: Update state format reference**

In `plugins/codex-homunculus/skills/codex-homunculus/references/state-format.md`, add:

```markdown
- `quarantine/*.md`: inactive instincts preserved for audit but ignored by `apply`.
- `archive/*.md`: instincts intentionally removed from active use.
```

Add this metadata section:

```markdown
New active instincts may include lifecycle metadata:

- `status`: `active`, `quarantined`, `archived`, or `superseded`
- `last_applied_at`
- `apply_count`
- `supersedes`
```

- [ ] **Step 4: Update automation options reference**

In `plugins/codex-homunculus/skills/codex-homunculus/references/automation-options.md`, add:

````markdown
Before relying on the global wrapper after source changes, run:

```powershell
node plugins\codex-homunculus\scripts\homunculus.mjs sync-installed --dry-run
node plugins\codex-homunculus\scripts\homunculus.mjs sync-installed --yes
node plugins\codex-homunculus\scripts\homunculus.mjs doctor --global
```

`sync-installed --yes` writes outside the source checkout into the local marketplace and plugin cache, so use it only when that machine-level update is intended.
````

- [ ] **Step 5: Run docs-related checks and commit**

Run:

```powershell
git diff --check
cd plugins\codex-homunculus
npm run check
```

Expected: both commands PASS.

Commit:

```powershell
git add README.md plugins/codex-homunculus/skills/codex-homunculus/SKILL.md plugins/codex-homunculus/skills/codex-homunculus/references/state-format.md plugins/codex-homunculus/skills/codex-homunculus/references/automation-options.md
git commit -m "docs: document homunculus reliability commands"
```

---

### Task 10: Final Verification and Installed Copy Smoke

**Files:**
- Modify only if verification exposes a defect.

- [ ] **Step 1: Run source verification**

Run:

```powershell
git diff --check
cd plugins\codex-homunculus
npm run check
npm test
npm pack --dry-run
```

Expected:

```text
npm run check exits 0
npm test prints smoke test passed
npm pack --dry-run prints codex-homunculus-0.5.0.tgz
```

- [ ] **Step 2: Run installed sync dry-run**

Run:

```powershell
node plugins\codex-homunculus\scripts\homunculus.mjs sync-installed --dry-run --json
```

Expected: JSON with `"mode": "dry-run"` and a non-empty `files` array.

- [ ] **Step 3: Sync installed copies**

Run after approval for machine-level writes:

```powershell
node plugins\codex-homunculus\scripts\homunculus.mjs sync-installed --yes
```

Expected: plain-text output reporting `sync-installed write`.

- [ ] **Step 4: Verify global wrapper from another repo**

Run:

```powershell
& 'C:\Users\Gchen\.codex\bin\codex-homunculus.cmd' start --json
```

from:

```text
C:\Users\Gchen\OneDrive\Documents\GitHub\hiramhovel
```

Expected:

```json
{
  "project": {
    "name": "hiramhovel"
  },
  "root": "C:\\Users\\Gchen\\.codex\\local-marketplaces\\codex-homunculus\\.codex\\homunculus"
}
```

- [ ] **Step 5: Run global doctor**

Run:

```powershell
& 'C:\Users\Gchen\.codex\bin\codex-homunculus.cmd' doctor --global --json
```

Expected: JSON includes `inventory.source_plugin`, `inventory.local_marketplace_plugin`, `inventory.plugin_cache`, `inventory.wrapper`, and `inventory.state_root`.

- [ ] **Step 6: Commit final fixes if any were needed**

If Step 1 through Step 5 required additional code changes, commit them:

```powershell
git add plugins/codex-homunculus/scripts/homunculus.mjs plugins/codex-homunculus/scripts/smoke-test.mjs README.md plugins/codex-homunculus/skills/codex-homunculus/SKILL.md plugins/codex-homunculus/skills/codex-homunculus/references/state-format.md plugins/codex-homunculus/skills/codex-homunculus/references/automation-options.md
git commit -m "fix: complete homunculus reliability verification"
```

Expected: commit is created only when files changed after verification.

---

## Self-Review

Spec coverage:

- Global install diagnostics: Task 5.
- Installed-copy sync and repair: Tasks 6 and 7.
- Memory lifecycle controls: Tasks 1, 2, and 3.
- Stronger validation: Task 8.
- Regression tests: every implementation task adds smoke-test coverage.
- Documentation: Task 9.
- Final verification: Task 10.

Scope check:

This plan keeps the first slice reliability-focused. It does not add embeddings, cloud sync, UI dashboards, or broad automation claims.

Execution dependency:

The implementation should run on top of the existing state-root working tree changes. Do not revert those changes while executing this plan.
