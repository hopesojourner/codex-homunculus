#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import process from "node:process";

const VERSION = "0.5.0";
const INSTRUCTION_BLOCK_START = "<!-- codex-homunculus:start -->";
const INSTRUCTION_BLOCK_END = "<!-- codex-homunculus:end -->";
const REQUIRED_INSTINCT_FIELDS = ["id", "title", "domain", "trigger", "action", "confidence", "source", "created_at", "updated_at"];
const SENSITIVE_PATTERNS = [
  ["private key block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/i],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/],
  ["OpenAI-style API key", /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ["secret assignment", /\b(?:api[_-]?key|token|secret|password|passwd|private[_-]?key)\s*[:=]\s*["']?[^\s"']{8,}/i]
];

function now() {
  return new Date().toISOString();
}

function die(message, code = 1) {
  console.error(`error: ${message}`);
  process.exit(code);
}

function sha(value) {
  return createHash("sha256").update(value).digest("hex");
}

function slug(value, fallback = "item") {
  const cleaned = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  return cleaned || fallback;
}

function uniquePath(path) {
  if (!existsSync(path)) {
    return path;
  }
  const dot = path.lastIndexOf(".");
  const base = dot === -1 ? path : path.slice(0, dot);
  const ext = dot === -1 ? "" : path.slice(dot);
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${base}-${i}${ext}`;
    if (!existsSync(candidate)) {
      return candidate;
    }
  }
  die(`could not find a unique filename for ${path}`);
}

function detectSensitive(value) {
  const text = String(value || "");
  return SENSITIVE_PATTERNS
    .filter(([, pattern]) => pattern.test(text))
    .map(([name]) => name);
}

function assertSafeToPersist(values, options, label) {
  if (options["allow-sensitive"]) {
    return;
  }
  const findings = [];
  for (const value of values) {
    findings.push(...detectSensitive(value));
  }
  const unique = [...new Set(findings)];
  if (unique.length > 0) {
    die(`${label} appears to contain sensitive material (${unique.join(", ")}). Remove it or rerun with --allow-sensitive after explicit user approval.`);
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

function runGit(args, cwd) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
  if (result.status !== 0) {
    return "";
  }
  return result.stdout.trim();
}

function projectInfo(cwd) {
  const root = runGit(["rev-parse", "--show-toplevel"], cwd) || cwd;
  const remote = runGit(["remote", "get-url", "origin"], root);
  const branch = runGit(["branch", "--show-current"], root);
  const source = remote || root;
  return {
    id: sha(source).slice(0, 16),
    name: basename(root),
    root,
    remote,
    branch
  };
}

function stateRoot(options) {
  if (options.root) {
    return resolve(String(options.root));
  }
  if (process.env.CODEX_HOMUNCULUS_DIR) {
    return resolve(process.env.CODEX_HOMUNCULUS_DIR);
  }
  return join(projectInfo(process.cwd()).root, ".codex", "homunculus");
}

function defaultCodexInstructionTarget(options) {
  if (options.target) {
    return resolve(String(options.target));
  }
  if (options.global) {
    const codexHome = process.env.CODEX_HOME || join(homedir(), ".codex");
    return join(codexHome, "AGENTS.md");
  }
  return join(projectInfo(process.cwd()).root, "AGENTS.md");
}

function isWithin(path, parent) {
  const rel = relative(parent, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function codexInstructionBlock(options = {}) {
  const command = String(options["script-command"] || "node plugins/codex-homunculus/scripts/homunculus.mjs");
  return `${INSTRUCTION_BLOCK_START}
## Codex Homunculus Bootstrap

For repo tasks in this workspace:

1. Before planning or editing, run \`${command} start\`.
2. Apply relevant learned instincts with \`${command} apply --context "<short task summary>"\`.
3. Use only relevant instincts; treat them as guidance, not proof.
4. Before the final response, if the task produced a durable workflow lesson or the user corrected Codex behavior, ask before storing it, then run \`${command} learn --domain "<domain>" --trigger "<specific trigger>" --action "<specific action>" --evidence "<brief evidence>"\`.
5. Do not store secrets, credentials, private customer data, or tokens. Prefer redaction.
6. Do not claim every-turn hooks, background observation, or scheduled behavior unless a separate wrapper or automation has been explicitly installed and verified.

${INSTRUCTION_BLOCK_END}`;
}

function upsertInstructionBlock(existing, block) {
  if (!existing.trim()) {
    return `${block}\n`;
  }
  const start = existing.indexOf(INSTRUCTION_BLOCK_START);
  const end = existing.indexOf(INSTRUCTION_BLOCK_END);
  if (start !== -1 && end !== -1 && end > start) {
    const afterEnd = end + INSTRUCTION_BLOCK_END.length;
    return `${existing.slice(0, start)}${block}${existing.slice(afterEnd)}`.replace(/\s+$/u, "\n");
  }
  return `${existing.replace(/\s+$/u, "")}\n\n${block}\n`;
}

function dirs(root) {
  return {
    root,
    instincts: join(root, "instincts"),
    personal: join(root, "instincts", "personal"),
    inherited: join(root, "instincts", "inherited"),
    evolved: join(root, "evolved"),
    evolvedSkills: join(root, "evolved", "skills"),
    exports: join(root, "exports"),
    identity: join(root, "identity.json"),
    observations: join(root, "observations.jsonl")
  };
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function readJson(path, fallback) {
  if (!existsSync(path)) {
    return fallback;
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

function readJsonOrDie(path, label) {
  try {
    return readJson(path, null);
  } catch (error) {
    die(`${label} is not valid JSON: ${path} (${error.message})`);
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseBoundedNumber(value, fallback, label, { min = -Infinity, max = Infinity, integer = false } = {}) {
  const raw = value === undefined || value === null || value === "" ? fallback : value;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    die(`${label} must be a finite number`);
  }
  if (integer && !Number.isInteger(parsed)) {
    die(`${label} must be an integer`);
  }
  if (parsed < min || parsed > max) {
    die(`${label} must be between ${min} and ${max}`);
  }
  return parsed;
}

function ensureState(root) {
  const d = dirs(root);
  for (const path of [d.root, d.personal, d.inherited, d.evolvedSkills, d.exports]) {
    ensureDir(path);
  }
  const project = projectInfo(process.cwd());
  let identity;
  try {
    identity = readJson(d.identity, {
      version: VERSION,
      created_at: now(),
      updated_at: now(),
      project,
      session_count: 0,
      evolution: {
        ready: []
      }
    });
  } catch (error) {
    die(`identity is not valid JSON: ${d.identity} (${error.message})`);
  }
  identity ||= {
    version: VERSION,
    created_at: now(),
    updated_at: now(),
    project,
    session_count: 0,
    evolution: {
      ready: []
    }
  };
  if (!isRecord(identity)) {
    die(`identity must be a JSON object: ${d.identity}`);
  }
  identity.version = VERSION;
  identity.updated_at = now();
  identity.project = project;
  identity.evolution = identity.evolution || { ready: [] };
  writeJson(d.identity, identity);
  if (!existsSync(d.observations)) {
    writeFileSync(d.observations, "", "utf8");
  }
  return { dirs: d, identity };
}

function simpleYamlValue(value) {
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(String(value ?? ""));
}

function frontmatter(fields) {
  const lines = ["---"];
  for (const [key, value] of Object.entries(fields)) {
    lines.push(`${key}: ${simpleYamlValue(value)}`);
  }
  lines.push("---", "");
  return lines.join("\n");
}

function parseFrontmatter(text) {
  if (!text.startsWith("---")) {
    return {};
  }
  const end = text.indexOf("\n---", 3);
  if (end === -1) {
    return {};
  }
  const data = {};
  const block = text.slice(3, end).trim();
  for (const line of block.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) {
      continue;
    }
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      try {
        value = JSON.parse(value);
      } catch {
        value = value.slice(1, -1);
      }
    } else if (/^-?\d+(\.\d+)?$/.test(value)) {
      value = Number(value);
    } else if (value === "true" || value === "false") {
      value = value === "true";
    }
    data[key] = value;
  }
  return data;
}

function updateFrontmatter(text, updates) {
  if (!text.startsWith("---")) {
    return `${frontmatter(updates)}${text}`;
  }
  const end = text.indexOf("\n---", 3);
  if (end === -1) {
    return `${frontmatter(updates)}${text}`;
  }
  const seen = new Set();
  const lines = text
    .slice(3, end)
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf(":");
      if (idx === -1) {
        return line;
      }
      const key = line.slice(0, idx).trim();
      if (!Object.hasOwn(updates, key)) {
        return line;
      }
      seen.add(key);
      return `${key}: ${simpleYamlValue(updates[key])}`;
    });
  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) {
      lines.push(`${key}: ${simpleYamlValue(value)}`);
    }
  }
  return `---\n${lines.join("\n")}\n---${text.slice(end + 4)}`;
}

function markdownInstinct(fields, body) {
  return `${frontmatter(fields)}# ${fields.title}\n\n## Trigger\n${fields.trigger}\n\n## Action\n${fields.action}\n\n## Evidence\n${body.evidence || "No evidence supplied."}\n`;
}

function listMarkdownFiles(path) {
  if (!existsSync(path)) {
    return [];
  }
  return readdirSync(path)
    .filter((name) => name.endsWith(".md"))
    .map((name) => join(path, name));
}

function loadInstincts(root) {
  const d = dirs(root);
  const files = [
    ...listMarkdownFiles(d.personal).map((path) => ({ path, scope: "personal" })),
    ...listMarkdownFiles(d.inherited).map((path) => ({ path, scope: "inherited" }))
  ];
  return files.map(({ path, scope }) => {
    const text = readFileSync(path, "utf8");
    return {
      path,
      scope,
      text,
      meta: parseFrontmatter(text)
    };
  });
}

function tokenize(value) {
  return new Set(
    String(value || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2)
  );
}

function scoreInstinct(instinct, context, domain) {
  const meta = instinct.meta;
  const haystack = tokenize(`${meta.title || ""} ${meta.trigger || ""} ${meta.action || ""} ${meta.domain || ""}`);
  const query = tokenize(`${context || ""} ${domain || ""}`);
  let score = Number(meta.confidence ?? 0.5);
  if (domain && String(meta.domain || "").toLowerCase() === String(domain).toLowerCase()) {
    score += 3;
  }
  for (const token of query) {
    if (haystack.has(token)) {
      score += 1;
    }
  }
  return score;
}

function countLines(path) {
  if (!existsSync(path)) {
    return 0;
  }
  const text = readFileSync(path, "utf8").trim();
  return text ? text.split(/\r?\n/).length : 0;
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function commandInit(root, options) {
  const state = ensureState(root);
  if (options.json) {
    printJson({ ok: true, root: state.dirs.root, identity: state.identity });
    return;
  }
  console.log(`Codex Homunculus initialized at ${state.dirs.root}`);
}

function commandStart(root, options) {
  const state = ensureState(root);
  state.identity.session_count = Number(state.identity.session_count || 0) + 1;
  state.identity.updated_at = now();
  writeJson(state.dirs.identity, state.identity);
  const summary = summaryFor(root, state.identity);
  if (options.json) {
    printJson(summary);
    return;
  }
  console.log(`Codex Homunculus started for ${summary.project.name}`);
  console.log(`state: ${summary.root}`);
  console.log(`sessions: ${summary.session_count}`);
  console.log(`instincts: ${summary.instincts.total} (${summary.instincts.personal} personal, ${summary.instincts.inherited} inherited)`);
  console.log(`observations: ${summary.observations}`);
}

function summaryFor(root, identity = null) {
  const d = dirs(root);
  const loadedIdentity = identity || readJson(d.identity, {});
  const instincts = loadInstincts(root);
  return {
    root,
    project: loadedIdentity.project || projectInfo(process.cwd()),
    session_count: loadedIdentity.session_count || 0,
    observations: countLines(d.observations),
    instincts: {
      total: instincts.length,
      personal: instincts.filter((item) => item.scope === "personal").length,
      inherited: instincts.filter((item) => item.scope === "inherited").length
    },
    evolved_files: listMarkdownFiles(d.evolvedSkills).length,
    evolution_ready: (loadedIdentity.evolution && loadedIdentity.evolution.ready) || []
  };
}

function commandStatus(root, options) {
  ensureState(root);
  const summary = summaryFor(root);
  if (options.json) {
    printJson(summary);
    return;
  }
  console.log(`root: ${summary.root}`);
  console.log(`project: ${summary.project.name}`);
  console.log(`sessions: ${summary.session_count}`);
  console.log(`observations: ${summary.observations}`);
  console.log(`instincts: ${summary.instincts.total}`);
  console.log(`evolved files: ${summary.evolved_files}`);
}

function commandObserve(root, options) {
  if (!options.text) {
    die("observe requires --text");
  }
  assertSafeToPersist([options.text], options, "observation");
  const state = ensureState(root);
  const record = {
    time: now(),
    kind: String(options.kind || "note"),
    domain: String(options.domain || "general"),
    text: String(options.text),
    project_id: state.identity.project.id
  };
  appendFileSync(state.dirs.observations, `${JSON.stringify(record)}\n`, "utf8");
  console.log(`observation recorded: ${record.domain}/${record.kind}`);
}

function commandAddInstinct(root, options) {
  if (!options.trigger) {
    die("add-instinct requires --trigger");
  }
  if (!options.action) {
    die("add-instinct requires --action");
  }
  assertSafeToPersist([options.trigger, options.action, options.evidence], options, "instinct");
  const state = ensureState(root);
  const scope = options.scope === "inherited" ? "inherited" : "personal";
  const targetDir = scope === "inherited" ? state.dirs.inherited : state.dirs.personal;
  const id = sha(`${now()} ${options.trigger} ${options.action}`).slice(0, 12);
  const title = String(options.name || options.title || options.trigger).slice(0, 90);
  const file = join(targetDir, `${slug(title)}-${id}.md`);
  const confidence = parseBoundedNumber(options.confidence, 0.5, "confidence", { min: 0, max: 1 });
  const fields = {
    id,
    title,
    domain: String(options.domain || "general"),
    trigger: String(options.trigger),
    action: String(options.action),
    confidence,
    source: String(options.source || "manual"),
    created_at: now(),
    updated_at: now()
  };
  writeFileSync(file, markdownInstinct(fields, { evidence: options.evidence }), "utf8");
  console.log(`instinct added: ${file}`);
}

function commandLearn(root, options) {
  if (!options.trigger) {
    die("learn requires --trigger");
  }
  if (!options.action) {
    die("learn requires --action");
  }
  assertSafeToPersist([options.trigger, options.action, options.evidence], options, "learning");
  const state = ensureState(root);
  const record = {
    time: now(),
    kind: "learning",
    domain: String(options.domain || "general"),
    text: String(options.evidence || `${options.trigger} -> ${options.action}`),
    project_id: state.identity.project.id
  };
  appendFileSync(state.dirs.observations, `${JSON.stringify(record)}\n`, "utf8");
  commandAddInstinct(root, { ...options, source: options.source || "learn" });
}

function commandList(root, options) {
  ensureState(root);
  const instincts = loadInstincts(root)
    .filter((item) => !options.domain || String(item.meta.domain || "").toLowerCase() === String(options.domain).toLowerCase())
    .sort((a, b) => String(a.meta.domain || "").localeCompare(String(b.meta.domain || "")));
  if (options.json) {
    printJson(instincts.map((item) => ({ ...item.meta, scope: item.scope, path: item.path })));
    return;
  }
  if (instincts.length === 0) {
    console.log("no instincts found");
    return;
  }
  for (const item of instincts) {
    console.log(`[${item.scope}] ${item.meta.domain || "general"} :: ${item.meta.title || basename(item.path)}`);
    console.log(`  trigger: ${item.meta.trigger || ""}`);
    console.log(`  action: ${item.meta.action || ""}`);
  }
}

function commandApply(root, options) {
  ensureState(root);
  const context = String(options.context || options.text || "");
  const limit = parseBoundedNumber(options.limit, 5, "limit", { min: 1, max: 1000, integer: true });
  const matches = loadInstincts(root)
    .map((instinct) => ({ instinct, score: scoreInstinct(instinct, context, options.domain) }))
    .filter((item) => item.score > 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  if (options.json) {
    printJson(matches.map((item) => ({ score: item.score, scope: item.instinct.scope, path: item.instinct.path, ...item.instinct.meta })));
    return;
  }
  if (matches.length === 0) {
    console.log("no matching instincts");
    return;
  }
  console.log("matching instincts:");
  for (const item of matches) {
    const meta = item.instinct.meta;
    console.log(`- ${meta.title || basename(item.instinct.path)} (${item.instinct.scope}, score ${item.score.toFixed(2)})`);
    console.log(`  action: ${meta.action || ""}`);
  }
}

function groupByDomain(instincts) {
  const groups = new Map();
  for (const item of instincts) {
    const domain = slug(item.meta.domain || "general", "general");
    if (!groups.has(domain)) {
      groups.set(domain, []);
    }
    groups.get(domain).push(item);
  }
  return groups;
}

function commandEvolve(root, options) {
  const state = ensureState(root);
  const minCount = parseBoundedNumber(options["min-count"] ?? options.minCount, 3, "min-count", { min: 1, max: 100000, integer: true });
  const groups = groupByDomain(loadInstincts(root));
  const evolved = [];
  for (const [domain, items] of groups.entries()) {
    if (items.length < minCount) {
      continue;
    }
    const file = join(state.dirs.evolvedSkills, `${domain}-workflow.md`);
    const lines = [
      `# ${domain} workflow`,
      "",
      `Generated by Codex Homunculus ${VERSION} at ${now()}.`,
      "",
      "## Instincts",
      ""
    ];
    for (const item of items) {
      lines.push(`- ${item.meta.title || basename(item.path)}: ${item.meta.action || "No action recorded."}`);
    }
    lines.push("", "## Source files", "");
    for (const item of items) {
      lines.push(`- ${item.path}`);
    }
    writeFileSync(file, `${lines.join("\n")}\n`, "utf8");
    evolved.push({ domain, count: items.length, file });
  }
  state.identity.evolution.ready = evolved;
  state.identity.updated_at = now();
  writeJson(state.dirs.identity, state.identity);
  if (options.json) {
    printJson({ evolved });
    return;
  }
  if (evolved.length === 0) {
    console.log(`no domains met min-count ${minCount}`);
    return;
  }
  for (const item of evolved) {
    console.log(`evolved ${item.domain}: ${item.file}`);
  }
}

function commandExport(root, options) {
  const state = ensureState(root);
  const output = resolve(String(options.output || join(state.dirs.exports, `homunculus-export-${Date.now()}.json`)));
  ensureDir(dirname(output));
  const bundle = {
    exported_at: now(),
    version: VERSION,
    identity: state.identity,
    instincts: loadInstincts(root).map((item) => ({
      scope: item.scope,
      filename: basename(item.path),
      metadata: item.meta,
      markdown: item.text
    }))
  };
  writeJson(output, bundle);
  console.log(`exported: ${output}`);
}

function commandImport(root, options) {
  if (!options.input) {
    die("import requires --input");
  }
  const input = resolve(String(options.input));
  if (!existsSync(input)) {
    die(`input not found: ${input}`);
  }
  const state = ensureState(root);
  const bundle = readJsonOrDie(input, "import input");
  if (!bundle || !Array.isArray(bundle.instincts)) {
    die("input is not a Codex Homunculus export");
  }
  const scope = options.scope === "personal" ? "personal" : "inherited";
  const targetDir = scope === "personal" ? state.dirs.personal : state.dirs.inherited;
  let imported = 0;
  for (const item of bundle.instincts) {
    const original = item.filename || `${slug(item.metadata?.title || "instinct")}.md`;
    assertSafeToPersist([item.markdown], options, `imported instinct ${original}`);
    const target = uniquePath(join(targetDir, `${slug(original.replace(/\.md$/i, ""))}-imported.md`));
    const importedMarkdown = updateFrontmatter(String(item.markdown || ""), {
      id: sha(`${target} ${now()} ${imported}`).slice(0, 12),
      source: "import",
      updated_at: now()
    });
    writeFileSync(target, importedMarkdown, "utf8");
    imported += 1;
  }
  console.log(`imported ${imported} instincts into ${scope}`);
}

function commandInstallCodexInstructions(root, options) {
  const block = codexInstructionBlock(options);
  if (options.print) {
    console.log(block);
    return;
  }

  const target = defaultCodexInstructionTarget(options);
  const projectRoot = projectInfo(process.cwd()).root;
  if (options.global && !options.yes) {
    die("--global writes to CODEX_HOME or ~/.codex. Rerun with --yes after explicit approval.");
  }
  if (!isWithin(target, projectRoot) && !options.yes) {
    die(`target is outside the current project root: ${target}. Rerun with --yes after explicit approval.`);
  }

  ensureDir(dirname(target));
  const existing = existsSync(target) ? readFileSync(target, "utf8") : "";
  writeFileSync(target, upsertInstructionBlock(existing, block), "utf8");
  console.log(`Codex Homunculus instructions installed: ${target}`);
}

function parseJsonl(path, errors) {
  if (!existsSync(path)) {
    return;
  }
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!line.trim()) {
      return;
    }
    try {
      JSON.parse(line);
    } catch (error) {
      errors.push(`${path}:${index + 1}: invalid JSONL record (${error.message})`);
    }
  });
}

function validateState(root, options) {
  const d = dirs(root);
  const errors = [];
  const warnings = [];
  for (const [name, path, expected] of [
    ["root", d.root, "dir"],
    ["personal instincts", d.personal, "dir"],
    ["inherited instincts", d.inherited, "dir"],
    ["evolved skills", d.evolvedSkills, "dir"],
    ["identity", d.identity, "file"],
    ["observations", d.observations, "file"]
  ]) {
    if (!existsSync(path)) {
      errors.push(`${name} missing: ${path}`);
      continue;
    }
    const actual = statSync(path).isDirectory() ? "dir" : "file";
    if (actual !== expected) {
      errors.push(`${name} should be ${expected}, found ${actual}: ${path}`);
    }
  }
  if (existsSync(d.identity)) {
    try {
      const identity = readJson(d.identity, null);
      if (!isRecord(identity)) {
        errors.push(`${d.identity}: identity must be a JSON object`);
      }
    } catch (error) {
      errors.push(`${d.identity}: invalid JSON (${error.message})`);
    }
  }
  parseJsonl(d.observations, errors);
  const ids = new Set();
  for (const item of loadInstincts(root)) {
    const meta = item.meta;
    for (const field of REQUIRED_INSTINCT_FIELDS) {
      if (meta[field] === undefined || meta[field] === "") {
        errors.push(`${item.path}: missing frontmatter field ${field}`);
      }
    }
    if (meta.id) {
      if (ids.has(meta.id)) {
        errors.push(`${item.path}: duplicate instinct id ${meta.id}`);
      }
      ids.add(meta.id);
    }
    const confidence = Number(meta.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      errors.push(`${item.path}: confidence must be a number between 0 and 1`);
    }
    const sensitive = detectSensitive(item.text);
    if (sensitive.length > 0) {
      warnings.push(`${item.path}: possible sensitive material (${[...new Set(sensitive)].join(", ")})`);
    }
  }
  if (options.strict) {
    errors.push(...warnings);
  }
  return { ok: errors.length === 0, errors, warnings };
}

function commandValidate(root, options) {
  const result = validateState(root, options);
  if (options.json) {
    printJson(result);
    if (!result.ok) {
      process.exitCode = 1;
    }
    return;
  }
  for (const error of result.errors) {
    console.log(`error ${error}`);
  }
  for (const warning of result.warnings) {
    console.log(`warning ${warning}`);
  }
  if (result.ok) {
    console.log("validation passed");
  } else {
    process.exitCode = 1;
  }
}

function commandDoctor(root, options) {
  const state = ensureState(root);
  const checks = [
    ["root", state.dirs.root],
    ["personal instincts", state.dirs.personal],
    ["inherited instincts", state.dirs.inherited],
    ["evolved skills", state.dirs.evolvedSkills],
    ["identity", state.dirs.identity],
    ["observations", state.dirs.observations]
  ].map(([name, path]) => ({ name, path, exists: existsSync(path), type: existsSync(path) ? (statSync(path).isDirectory() ? "dir" : "file") : "missing" }));
  const ok = checks.every((check) => check.exists);
  if (options.json) {
    printJson({ ok, checks });
    return;
  }
  for (const check of checks) {
    console.log(`${check.exists ? "ok" : "missing"} ${check.name}: ${check.path}`);
  }
  if (!ok) {
    process.exitCode = 1;
  }
}

function commandHelp() {
  console.log(`Codex Homunculus ${VERSION}

Usage:
  node scripts/homunculus.mjs <command> [options]

Commands:
  init                 Create state directories.
  start                Start a session and print summary.
  status               Print state summary.
  observe              Append an observation. Requires --text.
  add-instinct         Add an instinct. Requires --trigger and --action.
  list-instincts       List instincts.
  apply                Rank instincts for --context.
  learn                Record an observation and add an instinct.
  evolve               Create domain summaries from repeated instincts.
  export               Export identity and instincts to JSON.
  import               Import a JSON export into inherited instincts.
  install-codex-instructions
                       Add/update an AGENTS.md Homunculus bootstrap block.
  doctor               Verify state layout.
  validate             Validate state files, JSONL, and instinct metadata.

Common options:
  --root <path>        Override state root.
  --json               Print machine-readable JSON where supported.
  --allow-sensitive    Permit persistence of sensitive-looking text.

install-codex-instructions options:
  --target <path>      Write to a specific AGENTS.md-style file.
  --global             Target CODEX_HOME/AGENTS.md or ~/.codex/AGENTS.md.
  --yes                Confirm writes outside the current project root.
  --print              Print the instruction block without writing.
  --script-command <command>
                       Command to embed in the instruction block.
`);
}

function main() {
  const [command = "help", ...rest] = process.argv.slice(2);
  const options = parseArgs(rest);
  const root = stateRoot(options);
  switch (command) {
    case "init":
      commandInit(root, options);
      break;
    case "start":
      commandStart(root, options);
      break;
    case "status":
      commandStatus(root, options);
      break;
    case "observe":
      commandObserve(root, options);
      break;
    case "add-instinct":
      commandAddInstinct(root, options);
      break;
    case "learn":
      commandLearn(root, options);
      break;
    case "list-instincts":
    case "list":
      commandList(root, options);
      break;
    case "apply":
      commandApply(root, options);
      break;
    case "evolve":
      commandEvolve(root, options);
      break;
    case "export":
      commandExport(root, options);
      break;
    case "import":
      commandImport(root, options);
      break;
    case "install-codex-instructions":
      commandInstallCodexInstructions(root, options);
      break;
    case "doctor":
      commandDoctor(root, options);
      break;
    case "validate":
      commandValidate(root, options);
      break;
    case "help":
    case "--help":
    case "-h":
      commandHelp();
      break;
    default:
      die(`unknown command: ${command}`);
  }
}

main();
