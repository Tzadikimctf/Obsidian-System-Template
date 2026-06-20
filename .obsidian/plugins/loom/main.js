"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => loomPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian4 = require("obsidian");
var import_state = require("@codemirror/state");
var import_view = require("@codemirror/view");
var import_path6 = require("path");

// src/utils/hash.ts
var import_crypto = require("crypto");
function shortHash(input) {
  return (0, import_crypto.createHash)("sha256").update(input).digest("hex").slice(0, 16);
}

// src/parser.ts
var LANGUAGE_ALIASES = {
  python: "python",
  py: "python",
  javascript: "javascript",
  js: "javascript",
  typescript: "typescript",
  ts: "typescript",
  ocaml: "ocaml",
  ml: "ocaml",
  c: "c",
  h: "c",
  cpp: "cpp",
  cxx: "cpp",
  cc: "cpp",
  "c++": "cpp",
  shell: "shell",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  ruby: "ruby",
  rb: "ruby",
  perl: "perl",
  pl: "perl",
  lua: "lua",
  php: "php",
  go: "go",
  golang: "go",
  rust: "rust",
  rs: "rust",
  java: "java",
  llvm: "llvm-ir",
  llvmir: "llvm-ir",
  "llvm-ir": "llvm-ir",
  ll: "llvm-ir",
  lean: "lean",
  lean4: "lean",
  coq: "coq",
  v: "coq",
  smt: "smtlib",
  smt2: "smtlib",
  smtlib: "smtlib",
  "smt-lib": "smtlib",
  z3: "smtlib"
};
var OUTPUT_START = /^<!--\s*loom:output:start\s+id=([a-f0-9]+)\s*-->$/i;
var OUTPUT_END = /^<!--\s*loom:output:end\s*-->$/i;
var FENCE_START = /^(```+|~~~+)\s*([^\s`]*)?.*$/;
function normalizeLanguage(rawLanguage) {
  const normalized = rawLanguage.trim().toLowerCase();
  return LANGUAGE_ALIASES[normalized] ?? null;
}
function getSupportedLanguageAliases() {
  return Object.keys(LANGUAGE_ALIASES);
}
function parseMarkdownCodeBlocks(filePath, source) {
  const lines = source.split(/\r?\n/);
  const blocks = [];
  let ordinal = 0;
  let insideManagedOutput = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (insideManagedOutput) {
      if (OUTPUT_END.test(line.trim())) {
        insideManagedOutput = false;
      }
      continue;
    }
    if (OUTPUT_START.test(line.trim())) {
      insideManagedOutput = true;
      continue;
    }
    const fenceMatch = line.match(FENCE_START);
    if (!fenceMatch) {
      continue;
    }
    const startLine = i;
    const fenceIndent = getLeadingWhitespace(line);
    const fenceToken = fenceMatch[1];
    const sourceLanguage = (fenceMatch[2] ?? "").trim();
    const language = normalizeLanguage(sourceLanguage);
    let endLine = i;
    const contentLines = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      const innerLine = lines[j];
      const trimmed = innerLine.trim();
      if (trimmed.startsWith(fenceToken) && /^(```+|~~~+)\s*$/.test(trimmed)) {
        endLine = j;
        i = j;
        break;
      }
      contentLines.push(stripFenceIndent(innerLine, fenceIndent));
      endLine = j;
    }
    if (!language) {
      continue;
    }
    ordinal += 1;
    const content = contentLines.join("\n");
    const contentHash = shortHash(content);
    const id = shortHash(`${filePath}:${ordinal}:${language}:${contentHash}`);
    blocks.push({
      id,
      ordinal,
      filePath,
      language,
      languageAlias: sourceLanguage.toLowerCase(),
      sourceLanguage,
      content,
      startLine,
      endLine,
      fenceStart: 0,
      fenceEnd: 0
    });
  }
  return blocks;
}
function findBlockAtLine(blocks, line) {
  return blocks.find((block) => line >= block.startLine && line <= block.endLine) ?? null;
}
function getLeadingWhitespace(line) {
  const match = line.match(/^[\t ]*/);
  return match?.[0] ?? "";
}
function stripFenceIndent(line, fenceIndent) {
  if (!fenceIndent) {
    return line;
  }
  let index = 0;
  while (index < fenceIndent.length && index < line.length && line[index] === fenceIndent[index]) {
    index += 1;
  }
  return line.slice(index);
}

// src/execution/processRunner.ts
var import_promises = require("fs/promises");
var import_os = require("os");
var import_path = require("path");
var import_child_process = require("child_process");
async function withNamedTempSourceFile(fileName, source, callback) {
  const tempDir = await (0, import_promises.mkdtemp)((0, import_path.join)((0, import_os.tmpdir)(), "loom-"));
  const tempFile = (0, import_path.join)(tempDir, fileName);
  try {
    await (0, import_promises.writeFile)(tempFile, normalizeExecutableSource(source), "utf8");
    return await callback({ tempDir, tempFile });
  } finally {
    await (0, import_promises.rm)(tempDir, { recursive: true, force: true });
  }
}
async function withTempSourceFile(fileExtension, source, callback) {
  return withNamedTempSourceFile(`snippet${fileExtension}`, source, callback);
}
function normalizeExecutableSource(source) {
  const lines = source.split("\n");
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
  if (!nonEmptyLines.length) {
    return source;
  }
  let sharedIndent = getLeadingWhitespace2(nonEmptyLines[0]);
  for (const line of nonEmptyLines.slice(1)) {
    sharedIndent = sharedWhitespacePrefix(sharedIndent, getLeadingWhitespace2(line));
    if (!sharedIndent) {
      return source;
    }
  }
  if (!sharedIndent) {
    return source;
  }
  return lines.map((line) => line.trim().length === 0 ? line : line.startsWith(sharedIndent) ? line.slice(sharedIndent.length) : line).join("\n");
}
function getLeadingWhitespace2(line) {
  const match = line.match(/^[\t ]*/);
  return match?.[0] ?? "";
}
function sharedWhitespacePrefix(left, right) {
  let index = 0;
  while (index < left.length && index < right.length && left[index] === right[index]) {
    index += 1;
  }
  return left.slice(0, index);
}
async function runProcess(spec) {
  const startedAt = /* @__PURE__ */ new Date();
  let stdout = "";
  let stderr = "";
  let exitCode = null;
  let timedOut = false;
  let cancelled = false;
  let child = null;
  let timeoutHandle = null;
  let abortHandler = null;
  try {
    await new Promise((resolve, reject) => {
      child = (0, import_child_process.spawn)(spec.executable, spec.args, {
        cwd: spec.workingDirectory,
        shell: false,
        env: {
          ...process.env,
          ...spec.env
        }
      });
      const abort = () => {
        cancelled = true;
        child?.kill("SIGTERM");
      };
      abortHandler = abort;
      if (spec.signal.aborted) {
        abort();
      } else {
        spec.signal.addEventListener("abort", abort, { once: true });
      }
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        child?.kill("SIGTERM");
      }, spec.timeoutMs);
      child.stdout?.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr?.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      child.on("error", (error) => {
        reject(error);
      });
      child.on("close", (code) => {
        exitCode = code;
        resolve();
      });
    });
  } catch (error) {
    stderr = stderr || formatProcessError(error, spec.executable);
    exitCode = exitCode ?? -1;
  } finally {
    if (abortHandler) {
      spec.signal.removeEventListener("abort", abortHandler);
    }
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
  const finishedAt = /* @__PURE__ */ new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();
  const success = !timedOut && !cancelled && exitCode === 0;
  return {
    runnerId: spec.runnerId,
    runnerName: spec.runnerName,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs,
    exitCode,
    stdout,
    stderr,
    success,
    timedOut,
    cancelled
  };
}
function formatProcessError(error, executable) {
  if (error instanceof Error && "code" in error && error.code === "ENOENT") {
    return `Executable not found: ${executable}`;
  }
  return error instanceof Error ? error.message : String(error);
}
async function runTempFileProcess(spec) {
  return withTempSourceFile(
    spec.fileExtension,
    spec.source,
    async ({ tempFile, tempDir }) => runProcess({
      runnerId: spec.runnerId,
      runnerName: spec.runnerName,
      executable: spec.executable,
      args: spec.args.map((value) => value.replaceAll("{file}", tempFile).replaceAll("{tempDir}", tempDir)),
      workingDirectory: spec.workingDirectory,
      timeoutMs: spec.timeoutMs,
      signal: spec.signal,
      env: expandTemplatedEnv(spec.env, tempFile, tempDir)
    })
  );
}
function expandTemplatedEnv(env, tempFile, tempDir) {
  if (!env) {
    return void 0;
  }
  return Object.fromEntries(
    Object.entries(env).map(([key, value]) => [
      key,
      typeof value === "string" ? value.replaceAll("{file}", tempFile).replaceAll("{tempDir}", tempDir) : value
    ])
  );
}

// src/runners/node.ts
var NodeRunner = class {
  constructor() {
    this.id = "node";
    this.displayName = "Node.js";
    this.languages = ["javascript", "typescript"];
  }
  canRun(block, settings) {
    if (block.language === "javascript") {
      return Boolean(settings.nodeExecutable.trim());
    }
    return Boolean(settings.typescriptTranspilerExecutable.trim());
  }
  async run(block, context, settings) {
    if (block.language === "javascript") {
      return runTempFileProcess({
        runnerId: this.id,
        runnerName: this.displayName,
        executable: settings.nodeExecutable.trim(),
        args: ["{file}"],
        fileExtension: ".js",
        source: block.content,
        workingDirectory: context.workingDirectory,
        timeoutMs: context.timeoutMs,
        signal: context.signal
      });
    }
    const executable = settings.typescriptTranspilerExecutable.trim();
    const runnerName = settings.typescriptMode === "tsx" ? "TypeScript (tsx)" : "TypeScript (ts-node)";
    return runTempFileProcess({
      runnerId: `${this.id}:${settings.typescriptMode}`,
      runnerName,
      executable,
      args: ["{file}"],
      fileExtension: ".ts",
      source: block.content,
      workingDirectory: context.workingDirectory,
      timeoutMs: context.timeoutMs,
      signal: context.signal
    });
  }
};

// src/runners/interpreted.ts
var INTERPRETED_SPECS = [
  {
    language: "shell",
    displayName: "Shell",
    executable: (settings) => settings.shellExecutable,
    fileExtension: ".sh"
  },
  {
    language: "ruby",
    displayName: "Ruby",
    executable: (settings) => settings.rubyExecutable,
    fileExtension: ".rb"
  },
  {
    language: "perl",
    displayName: "Perl",
    executable: (settings) => settings.perlExecutable,
    fileExtension: ".pl"
  },
  {
    language: "lua",
    displayName: "Lua",
    executable: (settings) => settings.luaExecutable,
    fileExtension: ".lua"
  },
  {
    language: "php",
    displayName: "PHP",
    executable: (settings) => settings.phpExecutable,
    fileExtension: ".php"
  },
  {
    language: "go",
    displayName: "Go",
    executable: (settings) => settings.goExecutable,
    fileExtension: ".go",
    args: ["run", "{file}"],
    env: {
      GOCACHE: "{tempDir}/gocache"
    },
    minimumTimeoutMs: 3e4
  }
];
var InterpretedRunner = class {
  constructor() {
    this.id = "interpreted";
    this.displayName = "Interpreted";
    this.languages = INTERPRETED_SPECS.map((spec) => spec.language);
  }
  canRun(block, settings) {
    const spec = this.getSpec(block.language);
    return Boolean(spec?.executable(settings).trim());
  }
  run(block, context, settings) {
    const spec = this.getSpec(block.language);
    if (!spec) {
      throw new Error(`Unsupported language: ${block.language}`);
    }
    return runTempFileProcess({
      runnerId: `${this.id}:${block.language}`,
      runnerName: spec.displayName,
      executable: spec.executable(settings).trim(),
      args: spec.args ?? ["{file}"],
      fileExtension: spec.fileExtension,
      source: block.content,
      workingDirectory: context.workingDirectory,
      timeoutMs: Math.max(context.timeoutMs, spec.minimumTimeoutMs ?? 0),
      signal: context.signal,
      env: spec.env
    });
  }
  getSpec(language) {
    return INTERPRETED_SPECS.find((spec) => spec.language === language);
  }
};

// src/runners/llvm.ts
var LlvmRunner = class {
  constructor() {
    this.id = "llvm-ir";
    this.displayName = "LLVM IR";
    this.languages = ["llvm-ir"];
  }
  canRun(block, settings) {
    return block.language === "llvm-ir" && Boolean(settings.llvmInterpreterExecutable.trim());
  }
  run(block, context, settings) {
    return runTempFileProcess({
      runnerId: this.id,
      runnerName: this.displayName,
      executable: settings.llvmInterpreterExecutable.trim(),
      args: ["{file}"],
      fileExtension: ".ll",
      source: block.content,
      workingDirectory: context.workingDirectory,
      timeoutMs: Math.max(context.timeoutMs, 3e4),
      signal: context.signal
    });
  }
};

// src/runners/managedCompiled.ts
var import_path2 = require("path");
var ManagedCompiledRunner = class {
  constructor() {
    this.id = "managed-compiled";
    this.displayName = "Managed compiler";
    this.languages = ["rust", "java"];
  }
  canRun(block, settings) {
    if (block.language === "rust") {
      return Boolean(settings.rustExecutable.trim());
    }
    if (block.language === "java") {
      return Boolean(settings.javaExecutable.trim());
    }
    return false;
  }
  async run(block, context, settings) {
    if (block.language === "rust") {
      return this.runRust(block, context, settings);
    }
    if (block.language === "java") {
      return this.runJava(block, context, settings);
    }
    throw new Error(`Unsupported language: ${block.language}`);
  }
  async runRust(block, context, settings) {
    return withTempSourceFile(".rs", block.content, async ({ tempDir, tempFile }) => {
      const binaryPath = (0, import_path2.join)(tempDir, "snippet.out");
      const compileResult = await runProcess({
        runnerId: `${this.id}:rust:compile`,
        runnerName: "Rust",
        executable: settings.rustExecutable.trim(),
        args: [tempFile, "-o", binaryPath],
        workingDirectory: context.workingDirectory,
        timeoutMs: Math.max(context.timeoutMs, 3e4),
        signal: context.signal
      });
      if (!compileResult.success) {
        return compileResult;
      }
      return runProcess({
        runnerId: `${this.id}:rust:run`,
        runnerName: "Rust",
        executable: binaryPath,
        args: [],
        workingDirectory: context.workingDirectory,
        timeoutMs: Math.max(context.timeoutMs, 3e4),
        signal: context.signal
      });
    });
  }
  async runJava(block, context, settings) {
    return withNamedTempSourceFile("Main.java", block.content, async ({ tempDir, tempFile }) => {
      if (!settings.javaCompilerExecutable.trim()) {
        return runProcess({
          runnerId: `${this.id}:java:source`,
          runnerName: "Java",
          executable: settings.javaExecutable.trim(),
          args: [tempFile],
          workingDirectory: context.workingDirectory,
          timeoutMs: Math.max(context.timeoutMs, 3e4),
          signal: context.signal
        });
      }
      const compileResult = await runProcess({
        runnerId: `${this.id}:java:compile`,
        runnerName: "Java",
        executable: settings.javaCompilerExecutable.trim(),
        args: [tempFile],
        workingDirectory: tempDir,
        timeoutMs: Math.max(context.timeoutMs, 3e4),
        signal: context.signal
      });
      if (!compileResult.success) {
        return compileResult;
      }
      return runProcess({
        runnerId: `${this.id}:java:run`,
        runnerName: "Java",
        executable: settings.javaExecutable.trim(),
        args: ["-cp", tempDir, "Main"],
        workingDirectory: context.workingDirectory,
        timeoutMs: Math.max(context.timeoutMs, 3e4),
        signal: context.signal
      });
    });
  }
};

// src/runners/nativeCompiled.ts
var import_path3 = require("path");
var NativeCompiledRunner = class {
  constructor() {
    this.id = "native-compiled";
    this.displayName = "Native compiler";
    this.languages = ["c", "cpp"];
  }
  canRun(block, settings) {
    if (block.language === "c") {
      return Boolean(settings.cExecutable.trim());
    }
    if (block.language === "cpp") {
      return Boolean(settings.cppExecutable.trim());
    }
    return false;
  }
  async run(block, context, settings) {
    const executable = block.language === "c" ? settings.cExecutable.trim() : settings.cppExecutable.trim();
    const fileExtension = block.language === "c" ? ".c" : ".cpp";
    const runnerName = block.language === "c" ? "C (GCC)" : "C++ (G++)";
    return withTempSourceFile(fileExtension, block.content, async ({ tempDir, tempFile }) => {
      const binaryPath = (0, import_path3.join)(tempDir, "snippet.out");
      const compileResult = await runProcess({
        runnerId: `${this.id}:${block.language}:compile`,
        runnerName,
        executable,
        args: [tempFile, "-o", binaryPath],
        workingDirectory: context.workingDirectory,
        timeoutMs: Math.max(context.timeoutMs, 3e4),
        signal: context.signal
      });
      if (!compileResult.success) {
        return compileResult;
      }
      return runProcess({
        runnerId: `${this.id}:${block.language}:run`,
        runnerName,
        executable: binaryPath,
        args: [],
        workingDirectory: context.workingDirectory,
        timeoutMs: Math.max(context.timeoutMs, 3e4),
        signal: context.signal
      });
    });
  }
};

// src/runners/ocaml.ts
var import_path4 = require("path");
var OcamlRunner = class {
  constructor() {
    this.id = "ocaml";
    this.displayName = "OCaml";
    this.languages = ["ocaml"];
  }
  canRun(block, settings) {
    return block.language === "ocaml" && Boolean(settings.ocamlExecutable.trim());
  }
  async run(block, context, settings) {
    const mode = settings.ocamlMode;
    const executable = settings.ocamlExecutable.trim();
    if (mode === "ocaml") {
      return runTempFileProcess({
        runnerId: `${this.id}:ocaml`,
        runnerName: "OCaml",
        executable,
        args: ["{file}"],
        fileExtension: ".ml",
        source: block.content,
        workingDirectory: context.workingDirectory,
        timeoutMs: context.timeoutMs,
        signal: context.signal
      });
    }
    if (mode === "dune") {
      return runTempFileProcess({
        runnerId: `${this.id}:dune`,
        runnerName: "Dune / OCaml",
        executable,
        args: ["exec", "--", "ocaml", "{file}"],
        fileExtension: ".ml",
        source: block.content,
        workingDirectory: context.workingDirectory,
        timeoutMs: context.timeoutMs,
        signal: context.signal
      });
    }
    return withTempSourceFile(".ml", block.content, async ({ tempDir, tempFile }) => {
      const binaryPath = (0, import_path4.join)(tempDir, "snippet.out");
      const compileResult = await runProcess({
        runnerId: `${this.id}:ocamlc-compile`,
        runnerName: "OCamlc",
        executable,
        args: ["-o", binaryPath, tempFile],
        workingDirectory: context.workingDirectory,
        timeoutMs: context.timeoutMs,
        signal: context.signal
      });
      if (!compileResult.success) {
        return compileResult;
      }
      return runProcess({
        runnerId: `${this.id}:ocamlc-run`,
        runnerName: "OCamlc",
        executable: binaryPath,
        args: [],
        workingDirectory: context.workingDirectory,
        timeoutMs: context.timeoutMs,
        signal: context.signal
      });
    });
  }
};

// src/runners/python.ts
var PythonRunner = class {
  constructor() {
    this.id = "python";
    this.displayName = "Python";
    this.languages = ["python"];
  }
  canRun(block, settings) {
    return block.language === "python" && Boolean(settings.pythonExecutable.trim());
  }
  run(block, context, settings) {
    return runTempFileProcess({
      runnerId: this.id,
      runnerName: this.displayName,
      executable: settings.pythonExecutable.trim(),
      args: ["{file}"],
      fileExtension: ".py",
      source: block.content,
      workingDirectory: context.workingDirectory,
      timeoutMs: context.timeoutMs,
      signal: context.signal
    });
  }
};

// src/runners/proof.ts
var import_fs = require("fs");
var import_path5 = require("path");
var ProofRunner = class {
  constructor() {
    this.id = "proof";
    this.displayName = "Proof checker";
    this.languages = ["lean", "coq", "smtlib"];
  }
  canRun(block, settings) {
    if (block.language === "lean") {
      return Boolean(settings.leanExecutable.trim());
    }
    if (block.language === "coq") {
      return Boolean(resolveCoqExecutable(settings).trim());
    }
    if (block.language === "smtlib") {
      return Boolean(settings.smtExecutable.trim());
    }
    return false;
  }
  run(block, context, settings) {
    if (block.language === "lean") {
      return runTempFileProcess({
        runnerId: `${this.id}:lean`,
        runnerName: "Lean",
        executable: settings.leanExecutable.trim(),
        args: ["{file}"],
        fileExtension: ".lean",
        source: block.content,
        workingDirectory: context.workingDirectory,
        timeoutMs: Math.max(context.timeoutMs, 3e4),
        signal: context.signal
      });
    }
    if (block.language === "coq") {
      return runTempFileProcess({
        runnerId: `${this.id}:coq`,
        runnerName: "Coq",
        executable: resolveCoqExecutable(settings),
        args: ["-q", "{file}"],
        fileExtension: ".v",
        source: block.content,
        workingDirectory: context.workingDirectory,
        timeoutMs: Math.max(context.timeoutMs, 3e4),
        signal: context.signal
      });
    }
    if (block.language === "smtlib") {
      return runTempFileProcess({
        runnerId: `${this.id}:smtlib`,
        runnerName: "SMT-LIB (Z3)",
        executable: settings.smtExecutable.trim(),
        args: ["{file}"],
        fileExtension: ".smt2",
        source: block.content,
        workingDirectory: context.workingDirectory,
        timeoutMs: Math.max(context.timeoutMs, 3e4),
        signal: context.signal
      });
    }
    throw new Error(`Unsupported proof language: ${block.language}`);
  }
};
function resolveCoqExecutable(settings) {
  const configured = settings.coqExecutable.trim();
  if (configured && configured !== "coqc") {
    return configured;
  }
  const opamCoqc = (0, import_path5.join)(process.env.HOME ?? "", ".opam", "default", "bin", "coqc");
  return (0, import_fs.existsSync)(opamCoqc) ? opamCoqc : configured || "coqc";
}

// src/runners/registry.ts
var loomRunnerRegistry = class {
  constructor(runners) {
    this.runners = runners;
  }
  getRunnerForBlock(block, settings) {
    return this.runners.find((runner) => runner.languages.includes(block.language) && runner.canRun(block, settings)) ?? null;
  }
  getSupportedLanguages() {
    return [...new Set(this.runners.flatMap((runner) => runner.languages))];
  }
};

// src/settings.ts
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  enableLocalExecution: false,
  hasAcknowledgedExecutionRisk: false,
  preserveSourceMode: true,
  defaultTimeoutMs: 8e3,
  workingDirectory: "",
  pythonExecutable: "python3",
  nodeExecutable: "node",
  typescriptMode: "ts-node",
  typescriptTranspilerExecutable: "ts-node",
  ocamlMode: "ocaml",
  ocamlExecutable: "ocaml",
  cExecutable: "gcc",
  cppExecutable: "g++",
  shellExecutable: "bash",
  rubyExecutable: "ruby",
  perlExecutable: "perl",
  luaExecutable: "lua",
  phpExecutable: "php",
  goExecutable: "go",
  rustExecutable: "rustc",
  javaCompilerExecutable: "",
  javaExecutable: "java",
  llvmInterpreterExecutable: "lli",
  leanExecutable: "lean",
  coqExecutable: "coqc",
  smtExecutable: "z3",
  writeOutputToNote: false,
  autoRunOnFileOpen: false
};
var loomSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(loomPlugin2) {
    super(loomPlugin2.app, loomPlugin2);
    this.loomPlugin = loomPlugin2;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "loom" });
    containerEl.createEl("p", { text: "Run supported code fences directly from notes while preserving native syntax highlighting." });
    containerEl.createEl("h3", { text: "Execution" });
    new import_obsidian.Setting(containerEl).setName("Enable local execution").setDesc("Disabled by default. loom runs code on your local machine and does not provide sandboxing.").addToggle(
      (toggle) => toggle.setValue(this.loomPlugin.settings.enableLocalExecution).onChange(async (value) => {
        this.loomPlugin.settings.enableLocalExecution = value;
        if (value) {
          this.loomPlugin.settings.hasAcknowledgedExecutionRisk = true;
        }
        await this.loomPlugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Keep loom notes in source mode").setDesc("Preserve raw fenced code in the editor instead of letting live preview collapse research snippets.").addToggle(
      (toggle) => toggle.setValue(this.loomPlugin.settings.preserveSourceMode).onChange(async (value) => {
        this.loomPlugin.settings.preserveSourceMode = value;
        await this.loomPlugin.saveSettings();
        void this.loomPlugin.enforceSourceModeForActiveView();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Default timeout").setDesc("Maximum execution time in milliseconds before loom terminates the process.").addText(
      (text) => text.setPlaceholder("8000").setValue(String(this.loomPlugin.settings.defaultTimeoutMs)).onChange(async (value) => {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isNaN(parsed) && parsed > 0) {
          this.loomPlugin.settings.defaultTimeoutMs = parsed;
          await this.loomPlugin.saveSettings();
        }
      })
    );
    new import_obsidian.Setting(containerEl).setName("Working directory").setDesc("Optional. Empty uses the current note folder when possible, otherwise the vault root.").addText(
      (text) => text.setPlaceholder("Vault root").setValue(this.loomPlugin.settings.workingDirectory).onChange(async (value) => {
        this.loomPlugin.settings.workingDirectory = value.trim() ? (0, import_obsidian.normalizePath)(value.trim()) : "";
        await this.loomPlugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Write output back to note").setDesc("Insert managed loom output sections beneath code blocks instead of keeping results purely in the UI.").addToggle(
      (toggle) => toggle.setValue(this.loomPlugin.settings.writeOutputToNote).onChange(async (value) => {
        this.loomPlugin.settings.writeOutputToNote = value;
        await this.loomPlugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Auto-run on file open").setDesc("Run all supported blocks in the active note when it opens. Disabled by default.").addToggle(
      (toggle) => toggle.setValue(this.loomPlugin.settings.autoRunOnFileOpen).onChange(async (value) => {
        this.loomPlugin.settings.autoRunOnFileOpen = value;
        await this.loomPlugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "Runtimes" });
    new import_obsidian.Setting(containerEl).setName("Python executable").setDesc("Path or command name for Python.").addText(
      (text) => text.setValue(this.loomPlugin.settings.pythonExecutable).onChange(async (value) => {
        this.loomPlugin.settings.pythonExecutable = value.trim();
        await this.loomPlugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Node executable").setDesc("Path or command name for JavaScript execution.").addText(
      (text) => text.setValue(this.loomPlugin.settings.nodeExecutable).onChange(async (value) => {
        this.loomPlugin.settings.nodeExecutable = value.trim();
        await this.loomPlugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("TypeScript runner mode").setDesc("Use ts-node or tsx for TypeScript blocks.").addDropdown(
      (dropdown) => dropdown.addOption("ts-node", "ts-node").addOption("tsx", "tsx").setValue(this.loomPlugin.settings.typescriptMode).onChange(async (value) => {
        this.loomPlugin.settings.typescriptMode = value;
        await this.loomPlugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("TypeScript transpiler executable").setDesc("Command or path for ts-node or tsx.").addText(
      (text) => text.setValue(this.loomPlugin.settings.typescriptTranspilerExecutable).onChange(async (value) => {
        this.loomPlugin.settings.typescriptTranspilerExecutable = value.trim();
        await this.loomPlugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("OCaml mode").setDesc("Choose between the OCaml toplevel, ocamlc compilation, or dune exec.").addDropdown(
      (dropdown) => dropdown.addOption("ocaml", "ocaml").addOption("ocamlc", "ocamlc").addOption("dune", "dune").setValue(this.loomPlugin.settings.ocamlMode).onChange(async (value) => {
        this.loomPlugin.settings.ocamlMode = value;
        await this.loomPlugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("OCaml executable").setDesc("Command or path for ocaml, ocamlc, or dune depending on the selected mode.").addText(
      (text) => text.setValue(this.loomPlugin.settings.ocamlExecutable).onChange(async (value) => {
        this.loomPlugin.settings.ocamlExecutable = value.trim();
        await this.loomPlugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("C compiler").setDesc("Command or path for compiling C blocks.").addText(
      (text) => text.setValue(this.loomPlugin.settings.cExecutable).onChange(async (value) => {
        this.loomPlugin.settings.cExecutable = value.trim();
        await this.loomPlugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("C++ compiler").setDesc("Command or path for compiling C++ blocks.").addText(
      (text) => text.setValue(this.loomPlugin.settings.cppExecutable).onChange(async (value) => {
        this.loomPlugin.settings.cppExecutable = value.trim();
        await this.loomPlugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Shell executable").setDesc("Command or path for Shell, Bash, and sh blocks.").addText(
      (text) => text.setValue(this.loomPlugin.settings.shellExecutable).onChange(async (value) => {
        this.loomPlugin.settings.shellExecutable = value.trim();
        await this.loomPlugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Ruby executable").setDesc("Command or path for Ruby blocks.").addText(
      (text) => text.setValue(this.loomPlugin.settings.rubyExecutable).onChange(async (value) => {
        this.loomPlugin.settings.rubyExecutable = value.trim();
        await this.loomPlugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Perl executable").setDesc("Command or path for Perl blocks.").addText(
      (text) => text.setValue(this.loomPlugin.settings.perlExecutable).onChange(async (value) => {
        this.loomPlugin.settings.perlExecutable = value.trim();
        await this.loomPlugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Lua executable").setDesc("Command or path for Lua blocks.").addText(
      (text) => text.setValue(this.loomPlugin.settings.luaExecutable).onChange(async (value) => {
        this.loomPlugin.settings.luaExecutable = value.trim();
        await this.loomPlugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("PHP executable").setDesc("Command or path for PHP blocks.").addText(
      (text) => text.setValue(this.loomPlugin.settings.phpExecutable).onChange(async (value) => {
        this.loomPlugin.settings.phpExecutable = value.trim();
        await this.loomPlugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Go executable").setDesc("Command or path for Go blocks.").addText(
      (text) => text.setValue(this.loomPlugin.settings.goExecutable).onChange(async (value) => {
        this.loomPlugin.settings.goExecutable = value.trim();
        await this.loomPlugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Rust compiler").setDesc("Command or path for compiling Rust blocks.").addText(
      (text) => text.setValue(this.loomPlugin.settings.rustExecutable).onChange(async (value) => {
        this.loomPlugin.settings.rustExecutable = value.trim();
        await this.loomPlugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Java compiler").setDesc("Optional command or path for javac. Leave empty to use Java source-file mode.").addText(
      (text) => text.setValue(this.loomPlugin.settings.javaCompilerExecutable).onChange(async (value) => {
        this.loomPlugin.settings.javaCompilerExecutable = value.trim();
        await this.loomPlugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("LLVM IR interpreter").setDesc("Command or path for running LLVM IR blocks with lli.").addText(
      (text) => text.setValue(this.loomPlugin.settings.llvmInterpreterExecutable).onChange(async (value) => {
        this.loomPlugin.settings.llvmInterpreterExecutable = value.trim();
        await this.loomPlugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Lean executable").setDesc("Command or path for checking Lean blocks.").addText(
      (text) => text.setValue(this.loomPlugin.settings.leanExecutable).onChange(async (value) => {
        this.loomPlugin.settings.leanExecutable = value.trim();
        await this.loomPlugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Coq executable").setDesc("Command or path for checking Coq blocks with coqc.").addText(
      (text) => text.setValue(this.loomPlugin.settings.coqExecutable).onChange(async (value) => {
        this.loomPlugin.settings.coqExecutable = value.trim();
        await this.loomPlugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("SMT solver").setDesc("Command or path for SMT-LIB blocks. Defaults to z3.").addText(
      (text) => text.setValue(this.loomPlugin.settings.smtExecutable).onChange(async (value) => {
        this.loomPlugin.settings.smtExecutable = value.trim();
        await this.loomPlugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Java executable").setDesc("Command or path for running compiled Java blocks.").addText(
      (text) => text.setValue(this.loomPlugin.settings.javaExecutable).onChange(async (value) => {
        this.loomPlugin.settings.javaExecutable = value.trim();
        await this.loomPlugin.saveSettings();
      })
    );
    containerEl.createEl("p", {
      text: "Missing runtime executables will surface as run errors. loom never claims sandboxing and executes code with your configured commands.",
      cls: "setting-item-description"
    });
  }
};
function showExecutionDisabledNotice() {
  new import_obsidian.Notice("loom local execution is disabled. Enable it in settings or confirm the execution warning first.");
}

// src/ui/codeBlockToolbar.ts
var import_obsidian2 = require("obsidian");
function createCodeBlockToolbar(blockId, isRunning, handlers) {
  const toolbar = document.createElement("div");
  toolbar.className = "loom-code-toolbar";
  toolbar.dataset.loomBlockId = blockId;
  toolbar.appendChild(createButton("Run block", isRunning ? "loader-circle" : "play", handlers.onRun, isRunning));
  toolbar.appendChild(createButton("Copy code", "copy", handlers.onCopy, false));
  toolbar.appendChild(createButton("Clear output", "trash-2", handlers.onClear, false));
  toolbar.appendChild(createButton("Toggle output", "panel-bottom-open", handlers.onToggleOutput, false));
  return toolbar;
}
function createButton(label, iconName, onClick, spinning) {
  const button = document.createElement("button");
  button.className = `loom-toolbar-button${spinning ? " is-running" : ""}`;
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });
  (0, import_obsidian2.setIcon)(button, iconName);
  return button;
}

// src/ui/outputPanel.ts
var import_obsidian3 = require("obsidian");
function getStatusKind(output) {
  if (output.result.success) {
    return output.result.stderr.trim() ? "warning" : "success";
  }
  return "failure";
}
function createOutputPanel(output) {
  const panel = document.createElement("div");
  panel.className = `loom-output-panel is-${getStatusKind(output)}${output.visible ? "" : " is-hidden"}`;
  panel.dataset.loomBlockId = output.blockId;
  renderOutputPanel(panel, output);
  return panel;
}
function renderOutputPanel(panel, output) {
  const kind = getStatusKind(output);
  panel.className = `loom-output-panel is-${kind}${output.visible ? "" : " is-hidden"}${output.collapsed ? " is-collapsed" : ""}`;
  panel.empty();
  const header = panel.createDiv({ cls: "loom-output-header" });
  const badge = header.createDiv({ cls: "loom-output-badge" });
  (0, import_obsidian3.setIcon)(badge, kind === "success" ? "check-circle-2" : kind === "warning" ? "alert-triangle" : "x-circle");
  const title = header.createDiv({ cls: "loom-output-title" });
  title.setText(`${output.result.runnerName} \xB7 exit ${output.result.exitCode ?? "?"}`);
  const meta = header.createDiv({ cls: "loom-output-meta" });
  meta.setText(`${output.result.durationMs} ms \xB7 ${new Date(output.result.finishedAt).toLocaleTimeString()}`);
  const body = panel.createDiv({ cls: "loom-output-body" });
  if (output.result.stdout.trim()) {
    createStream(body, "Stdout", output.result.stdout);
  }
  if (output.result.stderr.trim()) {
    createStream(body, "Stderr", output.result.stderr);
  }
  if (!output.result.stdout.trim() && !output.result.stderr.trim()) {
    const empty = body.createDiv({ cls: "loom-output-empty" });
    empty.setText("No output");
  }
}
function createStream(container, label, content) {
  const section = container.createDiv({ cls: "loom-output-stream" });
  section.createDiv({ cls: "loom-output-stream-label", text: label });
  section.createEl("pre", { cls: "loom-output-pre", text: content });
}
function createRunningPanel() {
  const panel = document.createElement("div");
  panel.className = "loom-output-panel is-running";
  const header = panel.createDiv({ cls: "loom-output-header" });
  const spinner = header.createDiv({ cls: "loom-spinner" });
  (0, import_obsidian3.setIcon)(spinner, "loader-circle");
  const title = header.createDiv({ cls: "loom-output-title" });
  title.setText("Running");
  const meta = header.createDiv({ cls: "loom-output-meta" });
  meta.setText("Executing...");
  spinner.setAttribute("aria-hidden", "true");
  return panel;
}

// src/main.ts
var loomRefreshEffect = import_state.StateEffect.define();
var ExecutionConsentModal = class extends import_obsidian4.Modal {
  constructor(app, onConfirm) {
    super(app);
    this.onConfirm = onConfirm;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Enable loom local execution?" });
    contentEl.createEl("p", {
      text: "loom runs code from your notes on your local machine using the configured executables. It does not sandbox or isolate the process."
    });
    const actions = contentEl.createDiv({ cls: "loom-modal-actions" });
    const cancelButton = actions.createEl("button", { text: "Cancel" });
    const enableButton = actions.createEl("button", { text: "Enable and run", cls: "mod-cta" });
    cancelButton.addEventListener("click", () => this.close());
    enableButton.addEventListener("click", async () => {
      await this.onConfirm();
      this.close();
    });
  }
};
var loomToolbarRenderChild = class extends import_obsidian4.MarkdownRenderChild {
  constructor(containerEl, plugin, block, codeElement) {
    super(containerEl);
    this.plugin = plugin;
    this.block = block;
    this.codeElement = codeElement;
    this.panelContainer = null;
    this.unregisterOutputListener = null;
  }
  onload() {
    this.codeElement.parentElement?.addClass("loom-codeblock-shell");
    this.codeElement.parentElement?.appendChild(this.plugin.createToolbarElement(this.block));
    this.panelContainer = this.containerEl.createDiv({ cls: "loom-inline-output-host" });
    this.plugin.renderOutputInto(this.block.id, this.panelContainer);
    this.unregisterOutputListener = this.plugin.registerOutputListener(this.block.id, () => {
      if (this.panelContainer) {
        this.plugin.renderOutputInto(this.block.id, this.panelContainer);
      }
    });
  }
  onunload() {
    this.unregisterOutputListener?.();
  }
};
var loomToolbarWidget = class extends import_view.WidgetType {
  constructor(plugin, block) {
    super();
    this.plugin = plugin;
    this.block = block;
  }
  eq(other) {
    return other.block.id === this.block.id && other.plugin.isBlockRunning(this.block.id) === this.plugin.isBlockRunning(this.block.id);
  }
  toDOM() {
    return this.plugin.createToolbarElement(this.block);
  }
};
var loomOutputWidget = class extends import_view.WidgetType {
  constructor(plugin, blockId) {
    super();
    this.plugin = plugin;
    this.blockId = blockId;
  }
  eq(other) {
    return false;
  }
  toDOM() {
    const wrapper = document.createElement("div");
    wrapper.className = "loom-inline-output-host";
    this.plugin.renderOutputInto(this.blockId, wrapper);
    return wrapper;
  }
};
var loomPlugin = class extends import_obsidian4.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
    this.registry = new loomRunnerRegistry([
      new PythonRunner(),
      new NodeRunner(),
      new OcamlRunner(),
      new NativeCompiledRunner(),
      new InterpretedRunner(),
      new ManagedCompiledRunner(),
      new LlvmRunner(),
      new ProofRunner()
    ]);
    this.outputs = /* @__PURE__ */ new Map();
    this.running = /* @__PURE__ */ new Map();
    this.outputListeners = /* @__PURE__ */ new Map();
    this.editorViews = /* @__PURE__ */ new Set();
  }
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new loomSettingTab(this));
    this.statusBarItemEl = this.addStatusBarItem();
    this.updateStatusBar();
    this.app.workspace.onLayoutReady(() => {
      void this.enforceSourceModeForActiveView();
    });
    this.addCommand({
      id: "loom-run-current-code-block",
      name: "loom: Run Current Code Block",
      editorCallback: async (editor, view) => {
        const file = view.file;
        if (!file) {
          return;
        }
        const blocks = parseMarkdownCodeBlocks(file.path, editor.getValue());
        const block = findBlockAtLine(blocks, editor.getCursor().line);
        if (!block) {
          new import_obsidian4.Notice("No supported loom block at the current cursor.");
          return;
        }
        await this.runBlock(file, block);
      }
    });
    this.addCommand({
      id: "loom-run-all-code-blocks",
      name: "loom: Run All Supported Code Blocks in Current Note",
      checkCallback: (checking) => {
        const file = this.getActiveMarkdownFile();
        if (!file) {
          return false;
        }
        if (!checking) {
          void this.runAllBlocksInFile(file);
        }
        return true;
      }
    });
    this.addCommand({
      id: "loom-clear-note-outputs",
      name: "loom: Clear loom Outputs in Current Note",
      checkCallback: (checking) => {
        const file = this.getActiveMarkdownFile();
        if (!file) {
          return false;
        }
        if (!checking) {
          void this.clearOutputsForFile(file);
        }
        return true;
      }
    });
    for (const alias of getSupportedLanguageAliases()) {
      this.registerMarkdownCodeBlockProcessor(alias, async (source, el, ctx) => {
        const filePath = ctx.sourcePath;
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (!(file instanceof import_obsidian4.TFile)) {
          return;
        }
        const fullText = await this.app.vault.cachedRead(file);
        const blocks = parseMarkdownCodeBlocks(filePath, fullText);
        const section = ctx.getSectionInfo(el);
        const lineStart = section?.lineStart ?? -1;
        const block = blocks.find((candidate) => candidate.startLine === lineStart && candidate.content === source);
        if (!block) {
          return;
        }
        const pre = el.querySelector("pre") ?? el;
        ctx.addChild(new loomToolbarRenderChild(el, this, block, pre));
      });
    }
    this.registerEditorExtension(this.createLivePreviewExtension());
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        this.refreshAllViews();
        void this.enforceSourceModeForActiveView();
        if (file && this.settings.autoRunOnFileOpen) {
          void this.runAllBlocksInFile(file);
        }
      })
    );
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        void this.enforceSourceModeForActiveView();
      })
    );
    this.registerEvent(
      this.app.workspace.on("editor-change", (_editor, ctx) => {
        if (ctx instanceof import_obsidian4.MarkdownView) {
          void this.enforceSourceModeForLeaf(ctx.leaf);
        }
      })
    );
  }
  onunload() {
    for (const controller of this.running.values()) {
      controller.abort();
    }
  }
  async loadSettings() {
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...await this.loadData()
    };
  }
  async saveSettings() {
    await this.saveData(this.settings);
    this.refreshAllViews();
  }
  isBlockRunning(blockId) {
    return this.running.has(blockId);
  }
  registerOutputListener(blockId, listener) {
    if (!this.outputListeners.has(blockId)) {
      this.outputListeners.set(blockId, /* @__PURE__ */ new Set());
    }
    this.outputListeners.get(blockId)?.add(listener);
    return () => {
      this.outputListeners.get(blockId)?.delete(listener);
    };
  }
  createToolbarElement(block) {
    return createCodeBlockToolbar(block.id, this.isBlockRunning(block.id), {
      onRun: () => void this.runActiveBlockById(block.id),
      onCopy: async () => {
        try {
          await navigator.clipboard.writeText(block.content);
          new import_obsidian4.Notice("Code copied");
        } catch {
          new import_obsidian4.Notice("Clipboard write failed.");
        }
      },
      onClear: () => {
        this.outputs.delete(block.id);
        void this.removeManagedOutputBlock(block.filePath, block.id);
        this.notifyOutputChanged(block.id);
      },
      onToggleOutput: () => {
        const output = this.outputs.get(block.id);
        if (!output) {
          return;
        }
        output.visible = !output.visible;
        this.notifyOutputChanged(block.id);
      }
    });
  }
  renderOutputInto(blockId, container) {
    container.empty();
    const output = this.outputs.get(blockId);
    if (this.running.has(blockId)) {
      container.appendChild(createRunningPanel());
      return;
    }
    if (!output || !output.visible) {
      return;
    }
    container.appendChild(createOutputPanel(output));
  }
  async runActiveBlockById(blockId) {
    const block = this.findActiveBlockById(blockId);
    const file = this.getActiveMarkdownFile();
    if (!block || !file) {
      return;
    }
    await this.runBlock(file, block);
  }
  async runAllBlocksInFile(file) {
    const source = await this.app.vault.cachedRead(file);
    const blocks = parseMarkdownCodeBlocks(file.path, source);
    const supportedBlocks = blocks.filter((block) => this.registry.getRunnerForBlock(block, this.settings));
    if (!supportedBlocks.length) {
      new import_obsidian4.Notice("No supported loom blocks found in the current note.");
      return;
    }
    for (const block of supportedBlocks) {
      await this.runBlock(file, block);
    }
  }
  async clearOutputsForFile(file) {
    const source = await this.app.vault.cachedRead(file);
    const blocks = parseMarkdownCodeBlocks(file.path, source);
    for (const block of blocks) {
      this.outputs.delete(block.id);
      this.notifyOutputChanged(block.id);
      await this.removeManagedOutputBlock(file.path, block.id);
    }
    new import_obsidian4.Notice("loom outputs cleared.");
  }
  async runBlock(file, block) {
    if (this.running.has(block.id)) {
      new import_obsidian4.Notice("This loom block is already running.");
      return;
    }
    if (!await this.ensureExecutionEnabled()) {
      showExecutionDisabledNotice();
      return;
    }
    const runner = this.registry.getRunnerForBlock(block, this.settings);
    if (!runner) {
      new import_obsidian4.Notice(`No configured runner for ${block.language}.`);
      return;
    }
    const controller = new AbortController();
    this.running.set(block.id, controller);
    this.notifyOutputChanged(block.id);
    this.updateStatusBar();
    try {
      const workingDirectory = this.resolveWorkingDirectory(file);
      const result = await runner.run(
        block,
        {
          file,
          workingDirectory,
          timeoutMs: this.settings.defaultTimeoutMs,
          signal: controller.signal
        },
        this.settings
      );
      if (result.timedOut) {
        result.stderr = result.stderr || `Execution timed out after ${this.settings.defaultTimeoutMs} ms.`;
      } else if (result.cancelled) {
        result.stderr = result.stderr || "Execution cancelled.";
      } else if (!result.success && !result.stderr.trim()) {
        result.stderr = "Process exited unsuccessfully.";
      }
      this.outputs.set(block.id, {
        blockId: block.id,
        block,
        result,
        collapsed: false,
        visible: true
      });
      if (this.settings.writeOutputToNote) {
        await this.writeManagedOutputBlock(file, block, result);
      }
      new import_obsidian4.Notice(result.success ? `loom ran ${runner.displayName} block.` : `loom run failed for ${runner.displayName}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.outputs.set(block.id, {
        blockId: block.id,
        block,
        collapsed: false,
        visible: true,
        result: {
          runnerId: runner.id,
          runnerName: runner.displayName,
          startedAt: (/* @__PURE__ */ new Date()).toISOString(),
          finishedAt: (/* @__PURE__ */ new Date()).toISOString(),
          durationMs: 0,
          exitCode: -1,
          stdout: "",
          stderr: message,
          success: false,
          timedOut: false,
          cancelled: false
        }
      });
      new import_obsidian4.Notice(`loom error: ${message}`);
    } finally {
      this.running.delete(block.id);
      this.notifyOutputChanged(block.id);
      this.updateStatusBar();
    }
  }
  async ensureExecutionEnabled() {
    if (this.settings.enableLocalExecution && this.settings.hasAcknowledgedExecutionRisk) {
      return true;
    }
    return await new Promise((resolve) => {
      let settled = false;
      const settle = (value) => {
        if (!settled) {
          settled = true;
          resolve(value);
        }
      };
      const modal = new ExecutionConsentModal(this.app, async () => {
        this.settings.enableLocalExecution = true;
        this.settings.hasAcknowledgedExecutionRisk = true;
        await this.saveSettings();
        settle(true);
      });
      const originalClose = modal.close.bind(modal);
      modal.close = () => {
        originalClose();
        settle(this.settings.enableLocalExecution && this.settings.hasAcknowledgedExecutionRisk);
      };
      modal.open();
    });
  }
  resolveWorkingDirectory(file) {
    if (this.settings.workingDirectory.trim()) {
      return this.settings.workingDirectory.trim();
    }
    const adapterBasePath = this.app.vault.adapter.basePath ?? "";
    const fileFolder = (0, import_path6.dirname)(file.path);
    const resolved = fileFolder === "." ? adapterBasePath : `${adapterBasePath}/${fileFolder}`;
    return resolved || process.cwd();
  }
  updateStatusBar() {
    const activeRuns = this.running.size;
    this.statusBarItemEl.setText(activeRuns ? `loom: ${activeRuns} Active Run${activeRuns === 1 ? "" : "s"}` : "loom: Idle");
  }
  notifyOutputChanged(blockId) {
    this.outputListeners.get(blockId)?.forEach((listener) => listener());
    this.refreshAllViews();
  }
  refreshAllViews() {
    this.app.workspace.getLeavesOfType("markdown").forEach((leaf) => {
      const view = leaf.view;
      const previewMode = view.previewMode;
      previewMode?.rerender?.(true);
    });
    for (const editorView of this.editorViews) {
      editorView.dispatch({ effects: loomRefreshEffect.of(void 0) });
    }
  }
  getActiveMarkdownFile() {
    const view = this.app.workspace.getActiveViewOfType(import_obsidian4.MarkdownView);
    return view?.file ?? null;
  }
  async enforceSourceModeForActiveView() {
    const view = this.app.workspace.getActiveViewOfType(import_obsidian4.MarkdownView);
    if (!view) {
      return;
    }
    await this.enforceSourceModeForLeaf(view.leaf);
  }
  async enforceSourceModeForLeaf(leaf) {
    if (!this.settings.preserveSourceMode) {
      return;
    }
    if (leaf.isDeferred) {
      await leaf.loadIfDeferred();
    }
    const view = leaf.view;
    if (!(view instanceof import_obsidian4.MarkdownView) || !view.file) {
      return;
    }
    const source = view.editor?.getValue?.() ?? await this.app.vault.cachedRead(view.file);
    const blocks = parseMarkdownCodeBlocks(view.file.path, source);
    if (!blocks.length) {
      return;
    }
    const viewState = leaf.getViewState();
    const state = { ...viewState.state ?? {} };
    if (state.mode === "source" && state.source === true) {
      return;
    }
    state.mode = "source";
    state.source = true;
    await leaf.setViewState({
      ...viewState,
      state
    });
  }
  findActiveBlockById(blockId) {
    const view = this.app.workspace.getActiveViewOfType(import_obsidian4.MarkdownView);
    const file = view?.file;
    const editor = view?.editor;
    if (!file || !editor) {
      return this.outputs.get(blockId)?.block ?? null;
    }
    const blocks = parseMarkdownCodeBlocks(file.path, editor.getValue());
    return blocks.find((block) => block.id === blockId) ?? this.outputs.get(blockId)?.block ?? null;
  }
  createLivePreviewExtension() {
    const plugin = this;
    return import_view.ViewPlugin.fromClass(
      class {
        constructor(view) {
          this.view = view;
          plugin.editorViews.add(view);
          this.decorations = this.buildDecorations();
        }
        update(update) {
          if (update.docChanged || update.viewportChanged || update.transactions.some((tr) => tr.effects.some((effect) => effect.is(loomRefreshEffect)))) {
            this.decorations = this.buildDecorations();
          }
        }
        destroy() {
          plugin.editorViews.delete(this.view);
        }
        buildDecorations() {
          const markdownView = plugin.app.workspace.getActiveViewOfType(import_obsidian4.MarkdownView);
          const file = markdownView?.file;
          if (!file) {
            return import_view.Decoration.none;
          }
          const source = this.view.state.doc.toString();
          const blocks = parseMarkdownCodeBlocks(file.path, source);
          const builder = new import_state.RangeSetBuilder();
          for (const block of blocks) {
            const startLine = this.view.state.doc.line(block.startLine + 1);
            builder.add(
              startLine.from,
              startLine.from,
              import_view.Decoration.widget({
                widget: new loomToolbarWidget(plugin, block),
                side: -1
              })
            );
            if (plugin.outputs.has(block.id) || plugin.running.has(block.id)) {
              const endLine = this.view.state.doc.line(block.endLine + 1);
              builder.add(
                endLine.to,
                endLine.to,
                import_view.Decoration.widget({
                  widget: new loomOutputWidget(plugin, block.id),
                  side: 1
                })
              );
            }
          }
          return builder.finish();
        }
      },
      {
        decorations: (value) => value.decorations
      }
    );
  }
  async writeManagedOutputBlock(file, block, result) {
    await this.app.vault.process(file, (content) => {
      const lines = content.split(/\r?\n/);
      const blocks = parseMarkdownCodeBlocks(file.path, content);
      const currentBlock = blocks.find((candidate) => candidate.id === block.id);
      const rendered = this.renderManagedOutputMarkdown(block.id, result);
      const existingRange = this.findManagedOutputRange(lines, block.id);
      if (existingRange) {
        lines.splice(existingRange.start, existingRange.end - existingRange.start + 1, ...rendered);
        return lines.join("\n");
      }
      if (!currentBlock) {
        return content;
      }
      lines.splice(currentBlock.endLine + 1, 0, ...rendered);
      return lines.join("\n");
    });
  }
  async removeManagedOutputBlock(filePath, blockId) {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof import_obsidian4.TFile)) {
      return;
    }
    await this.app.vault.process(file, (content) => {
      const lines = content.split(/\r?\n/);
      const range = this.findManagedOutputRange(lines, blockId);
      if (!range) {
        return content;
      }
      lines.splice(range.start, range.end - range.start + 1);
      return lines.join("\n");
    });
  }
  renderManagedOutputMarkdown(blockId, result) {
    const body = [
      `runner=${result.runnerName}`,
      `exit=${result.exitCode ?? "?"}`,
      `duration=${result.durationMs}ms`,
      `timestamp=${result.finishedAt}`,
      result.stdout ? `stdout:
${result.stdout}` : "",
      result.stderr ? `stderr:
${result.stderr}` : ""
    ].filter(Boolean).join("\n\n");
    return [
      `<!-- loom:output:start id=${blockId} -->`,
      "```text",
      body,
      "```",
      "<!-- loom:output:end -->"
    ];
  }
  findManagedOutputRange(lines, blockId) {
    const startMarker = `<!-- loom:output:start id=${blockId} -->`;
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i].trim() !== startMarker) {
        continue;
      }
      for (let j = i + 1; j < lines.length; j += 1) {
        if (lines[j].trim() === "<!-- loom:output:end -->") {
          return { start: i, end: j };
        }
      }
    }
    return null;
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL3V0aWxzL2hhc2gudHMiLCAic3JjL3BhcnNlci50cyIsICJzcmMvZXhlY3V0aW9uL3Byb2Nlc3NSdW5uZXIudHMiLCAic3JjL3J1bm5lcnMvbm9kZS50cyIsICJzcmMvcnVubmVycy9pbnRlcnByZXRlZC50cyIsICJzcmMvcnVubmVycy9sbHZtLnRzIiwgInNyYy9ydW5uZXJzL21hbmFnZWRDb21waWxlZC50cyIsICJzcmMvcnVubmVycy9uYXRpdmVDb21waWxlZC50cyIsICJzcmMvcnVubmVycy9vY2FtbC50cyIsICJzcmMvcnVubmVycy9weXRob24udHMiLCAic3JjL3J1bm5lcnMvcHJvb2YudHMiLCAic3JjL3J1bm5lcnMvcmVnaXN0cnkudHMiLCAic3JjL3NldHRpbmdzLnRzIiwgInNyYy91aS9jb2RlQmxvY2tUb29sYmFyLnRzIiwgInNyYy91aS9vdXRwdXRQYW5lbC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHtcclxuICBNYXJrZG93blJlbmRlckNoaWxkLFxyXG4gIE1hcmtkb3duVmlldyxcclxuICBNb2RhbCxcclxuICBOb3RpY2UsXHJcbiAgUGx1Z2luLFxyXG4gIFRGaWxlLFxyXG4gIFdvcmtzcGFjZUxlYWYsXHJcbn0gZnJvbSBcIm9ic2lkaWFuXCI7XHJcbmltcG9ydCB7IFJhbmdlU2V0QnVpbGRlciwgU3RhdGVFZmZlY3QgfSBmcm9tIFwiQGNvZGVtaXJyb3Ivc3RhdGVcIjtcclxuaW1wb3J0IHsgRGVjb3JhdGlvbiwgRWRpdG9yVmlldywgVmlld1BsdWdpbiwgVmlld1VwZGF0ZSwgV2lkZ2V0VHlwZSB9IGZyb20gXCJAY29kZW1pcnJvci92aWV3XCI7XHJcbmltcG9ydCB7IGRpcm5hbWUgfSBmcm9tIFwicGF0aFwiO1xyXG5pbXBvcnQgeyBmaW5kQmxvY2tBdExpbmUsIGdldFN1cHBvcnRlZExhbmd1YWdlQWxpYXNlcywgcGFyc2VNYXJrZG93bkNvZGVCbG9ja3MgfSBmcm9tIFwiLi9wYXJzZXJcIjtcclxuaW1wb3J0IHsgTm9kZVJ1bm5lciB9IGZyb20gXCIuL3J1bm5lcnMvbm9kZVwiO1xyXG5pbXBvcnQgeyBJbnRlcnByZXRlZFJ1bm5lciB9IGZyb20gXCIuL3J1bm5lcnMvaW50ZXJwcmV0ZWRcIjtcclxuaW1wb3J0IHsgTGx2bVJ1bm5lciB9IGZyb20gXCIuL3J1bm5lcnMvbGx2bVwiO1xyXG5pbXBvcnQgeyBNYW5hZ2VkQ29tcGlsZWRSdW5uZXIgfSBmcm9tIFwiLi9ydW5uZXJzL21hbmFnZWRDb21waWxlZFwiO1xyXG5pbXBvcnQgeyBOYXRpdmVDb21waWxlZFJ1bm5lciB9IGZyb20gXCIuL3J1bm5lcnMvbmF0aXZlQ29tcGlsZWRcIjtcclxuaW1wb3J0IHsgT2NhbWxSdW5uZXIgfSBmcm9tIFwiLi9ydW5uZXJzL29jYW1sXCI7XHJcbmltcG9ydCB7IFB5dGhvblJ1bm5lciB9IGZyb20gXCIuL3J1bm5lcnMvcHl0aG9uXCI7XHJcbmltcG9ydCB7IFByb29mUnVubmVyIH0gZnJvbSBcIi4vcnVubmVycy9wcm9vZlwiO1xyXG5pbXBvcnQgeyBsb29tUnVubmVyUmVnaXN0cnkgfSBmcm9tIFwiLi9ydW5uZXJzL3JlZ2lzdHJ5XCI7XHJcbmltcG9ydCB7IERFRkFVTFRfU0VUVElOR1MsIGxvb21TZXR0aW5nVGFiLCBzaG93RXhlY3V0aW9uRGlzYWJsZWROb3RpY2UgfSBmcm9tIFwiLi9zZXR0aW5nc1wiO1xyXG5pbXBvcnQgeyBjcmVhdGVDb2RlQmxvY2tUb29sYmFyIH0gZnJvbSBcIi4vdWkvY29kZUJsb2NrVG9vbGJhclwiO1xyXG5pbXBvcnQgeyBjcmVhdGVPdXRwdXRQYW5lbCwgY3JlYXRlUnVubmluZ1BhbmVsIH0gZnJvbSBcIi4vdWkvb3V0cHV0UGFuZWxcIjtcclxuaW1wb3J0IHR5cGUgeyBsb29tQ29kZUJsb2NrLCBsb29tUGx1Z2luU2V0dGluZ3MsIGxvb21TdG9yZWRPdXRwdXQgfSBmcm9tIFwiLi90eXBlc1wiO1xyXG5cclxuY29uc3QgbG9vbVJlZnJlc2hFZmZlY3QgPSBTdGF0ZUVmZmVjdC5kZWZpbmU8dm9pZD4oKTtcclxuXHJcbmNsYXNzIEV4ZWN1dGlvbkNvbnNlbnRNb2RhbCBleHRlbmRzIE1vZGFsIHtcclxuICBjb25zdHJ1Y3RvcihcclxuICAgIGFwcDogUGx1Z2luW1wiYXBwXCJdLFxyXG4gICAgcHJpdmF0ZSByZWFkb25seSBvbkNvbmZpcm06ICgpID0+IFByb21pc2U8dm9pZD4sXHJcbiAgKSB7XHJcbiAgICBzdXBlcihhcHApO1xyXG4gIH1cclxuXHJcbiAgb25PcGVuKCk6IHZvaWQge1xyXG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XHJcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcclxuICAgIGNvbnRlbnRFbC5jcmVhdGVFbChcImgyXCIsIHsgdGV4dDogXCJFbmFibGUgbG9vbSBsb2NhbCBleGVjdXRpb24/XCIgfSk7XHJcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoXCJwXCIsIHtcclxuICAgICAgdGV4dDogXCJsb29tIHJ1bnMgY29kZSBmcm9tIHlvdXIgbm90ZXMgb24geW91ciBsb2NhbCBtYWNoaW5lIHVzaW5nIHRoZSBjb25maWd1cmVkIGV4ZWN1dGFibGVzLiBJdCBkb2VzIG5vdCBzYW5kYm94IG9yIGlzb2xhdGUgdGhlIHByb2Nlc3MuXCIsXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBhY3Rpb25zID0gY29udGVudEVsLmNyZWF0ZURpdih7IGNsczogXCJsb29tLW1vZGFsLWFjdGlvbnNcIiB9KTtcclxuICAgIGNvbnN0IGNhbmNlbEJ1dHRvbiA9IGFjdGlvbnMuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIkNhbmNlbFwiIH0pO1xyXG4gICAgY29uc3QgZW5hYmxlQnV0dG9uID0gYWN0aW9ucy5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiRW5hYmxlIGFuZCBydW5cIiwgY2xzOiBcIm1vZC1jdGFcIiB9KTtcclxuXHJcbiAgICBjYW5jZWxCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHRoaXMuY2xvc2UoKSk7XHJcbiAgICBlbmFibGVCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGFzeW5jICgpID0+IHtcclxuICAgICAgYXdhaXQgdGhpcy5vbkNvbmZpcm0oKTtcclxuICAgICAgdGhpcy5jbG9zZSgpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcblxyXG5jbGFzcyBsb29tVG9vbGJhclJlbmRlckNoaWxkIGV4dGVuZHMgTWFya2Rvd25SZW5kZXJDaGlsZCB7XHJcbiAgcHJpdmF0ZSBwYW5lbENvbnRhaW5lcjogSFRNTERpdkVsZW1lbnQgfCBudWxsID0gbnVsbDtcclxuICBwcml2YXRlIHVucmVnaXN0ZXJPdXRwdXRMaXN0ZW5lcjogKCgpID0+IHZvaWQpIHwgbnVsbCA9IG51bGw7XHJcblxyXG4gIGNvbnN0cnVjdG9yKFxyXG4gICAgY29udGFpbmVyRWw6IEhUTUxFbGVtZW50LFxyXG4gICAgcHJpdmF0ZSByZWFkb25seSBwbHVnaW46IGxvb21QbHVnaW4sXHJcbiAgICBwcml2YXRlIHJlYWRvbmx5IGJsb2NrOiBsb29tQ29kZUJsb2NrLFxyXG4gICAgcHJpdmF0ZSByZWFkb25seSBjb2RlRWxlbWVudDogSFRNTEVsZW1lbnQsXHJcbiAgKSB7XHJcbiAgICBzdXBlcihjb250YWluZXJFbCk7XHJcbiAgfVxyXG5cclxuICBvbmxvYWQoKTogdm9pZCB7XHJcbiAgICB0aGlzLmNvZGVFbGVtZW50LnBhcmVudEVsZW1lbnQ/LmFkZENsYXNzKFwibG9vbS1jb2RlYmxvY2stc2hlbGxcIik7XHJcbiAgICB0aGlzLmNvZGVFbGVtZW50LnBhcmVudEVsZW1lbnQ/LmFwcGVuZENoaWxkKHRoaXMucGx1Z2luLmNyZWF0ZVRvb2xiYXJFbGVtZW50KHRoaXMuYmxvY2spKTtcclxuICAgIHRoaXMucGFuZWxDb250YWluZXIgPSB0aGlzLmNvbnRhaW5lckVsLmNyZWF0ZURpdih7IGNsczogXCJsb29tLWlubGluZS1vdXRwdXQtaG9zdFwiIH0pO1xyXG4gICAgdGhpcy5wbHVnaW4ucmVuZGVyT3V0cHV0SW50byh0aGlzLmJsb2NrLmlkLCB0aGlzLnBhbmVsQ29udGFpbmVyKTtcclxuICAgIHRoaXMudW5yZWdpc3Rlck91dHB1dExpc3RlbmVyID0gdGhpcy5wbHVnaW4ucmVnaXN0ZXJPdXRwdXRMaXN0ZW5lcih0aGlzLmJsb2NrLmlkLCAoKSA9PiB7XHJcbiAgICAgIGlmICh0aGlzLnBhbmVsQ29udGFpbmVyKSB7XHJcbiAgICAgICAgdGhpcy5wbHVnaW4ucmVuZGVyT3V0cHV0SW50byh0aGlzLmJsb2NrLmlkLCB0aGlzLnBhbmVsQ29udGFpbmVyKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBvbnVubG9hZCgpOiB2b2lkIHtcclxuICAgIHRoaXMudW5yZWdpc3Rlck91dHB1dExpc3RlbmVyPy4oKTtcclxuICB9XHJcbn1cclxuXHJcbmNsYXNzIGxvb21Ub29sYmFyV2lkZ2V0IGV4dGVuZHMgV2lkZ2V0VHlwZSB7XHJcbiAgY29uc3RydWN0b3IoXHJcbiAgICBwcml2YXRlIHJlYWRvbmx5IHBsdWdpbjogbG9vbVBsdWdpbixcclxuICAgIHByaXZhdGUgcmVhZG9ubHkgYmxvY2s6IGxvb21Db2RlQmxvY2ssXHJcbiAgKSB7XHJcbiAgICBzdXBlcigpO1xyXG4gIH1cclxuXHJcbiAgZXEob3RoZXI6IGxvb21Ub29sYmFyV2lkZ2V0KTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gb3RoZXIuYmxvY2suaWQgPT09IHRoaXMuYmxvY2suaWQgJiYgb3RoZXIucGx1Z2luLmlzQmxvY2tSdW5uaW5nKHRoaXMuYmxvY2suaWQpID09PSB0aGlzLnBsdWdpbi5pc0Jsb2NrUnVubmluZyh0aGlzLmJsb2NrLmlkKTtcclxuICB9XHJcblxyXG4gIHRvRE9NKCk6IEhUTUxFbGVtZW50IHtcclxuICAgIHJldHVybiB0aGlzLnBsdWdpbi5jcmVhdGVUb29sYmFyRWxlbWVudCh0aGlzLmJsb2NrKTtcclxuICB9XHJcbn1cclxuXHJcbmNsYXNzIGxvb21PdXRwdXRXaWRnZXQgZXh0ZW5kcyBXaWRnZXRUeXBlIHtcclxuICBjb25zdHJ1Y3RvcihcclxuICAgIHByaXZhdGUgcmVhZG9ubHkgcGx1Z2luOiBsb29tUGx1Z2luLFxyXG4gICAgcHJpdmF0ZSByZWFkb25seSBibG9ja0lkOiBzdHJpbmcsXHJcbiAgKSB7XHJcbiAgICBzdXBlcigpO1xyXG4gIH1cclxuXHJcbiAgZXEob3RoZXI6IGxvb21PdXRwdXRXaWRnZXQpOiBib29sZWFuIHtcclxuICAgIHJldHVybiBmYWxzZTtcclxuICB9XHJcblxyXG4gIHRvRE9NKCk6IEhUTUxFbGVtZW50IHtcclxuICAgIGNvbnN0IHdyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gICAgd3JhcHBlci5jbGFzc05hbWUgPSBcImxvb20taW5saW5lLW91dHB1dC1ob3N0XCI7XHJcbiAgICB0aGlzLnBsdWdpbi5yZW5kZXJPdXRwdXRJbnRvKHRoaXMuYmxvY2tJZCwgd3JhcHBlcik7XHJcbiAgICByZXR1cm4gd3JhcHBlcjtcclxuICB9XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIGxvb21QbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xyXG4gIHNldHRpbmdzOiBsb29tUGx1Z2luU2V0dGluZ3MgPSBERUZBVUxUX1NFVFRJTkdTO1xyXG4gIHJlYWRvbmx5IHJlZ2lzdHJ5ID0gbmV3IGxvb21SdW5uZXJSZWdpc3RyeShbXHJcbiAgICBuZXcgUHl0aG9uUnVubmVyKCksXHJcbiAgICBuZXcgTm9kZVJ1bm5lcigpLFxyXG4gICAgbmV3IE9jYW1sUnVubmVyKCksXHJcbiAgICBuZXcgTmF0aXZlQ29tcGlsZWRSdW5uZXIoKSxcclxuICAgIG5ldyBJbnRlcnByZXRlZFJ1bm5lcigpLFxyXG4gICAgbmV3IE1hbmFnZWRDb21waWxlZFJ1bm5lcigpLFxyXG4gICAgbmV3IExsdm1SdW5uZXIoKSxcclxuICAgIG5ldyBQcm9vZlJ1bm5lcigpLFxyXG4gIF0pO1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgb3V0cHV0cyA9IG5ldyBNYXA8c3RyaW5nLCBsb29tU3RvcmVkT3V0cHV0PigpO1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgcnVubmluZyA9IG5ldyBNYXA8c3RyaW5nLCBBYm9ydENvbnRyb2xsZXI+KCk7XHJcbiAgcHJpdmF0ZSByZWFkb25seSBvdXRwdXRMaXN0ZW5lcnMgPSBuZXcgTWFwPHN0cmluZywgU2V0PCgpID0+IHZvaWQ+PigpO1xyXG4gIHByaXZhdGUgc3RhdHVzQmFySXRlbUVsITogSFRNTEVsZW1lbnQ7XHJcbiAgcHJpdmF0ZSBlZGl0b3JWaWV3cyA9IG5ldyBTZXQ8RWRpdG9yVmlldz4oKTtcclxuXHJcbiAgYXN5bmMgb25sb2FkKCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcclxuICAgIHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgbG9vbVNldHRpbmdUYWIodGhpcykpO1xyXG4gICAgdGhpcy5zdGF0dXNCYXJJdGVtRWwgPSB0aGlzLmFkZFN0YXR1c0Jhckl0ZW0oKTtcclxuICAgIHRoaXMudXBkYXRlU3RhdHVzQmFyKCk7XHJcbiAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub25MYXlvdXRSZWFkeSgoKSA9PiB7XHJcbiAgICAgIHZvaWQgdGhpcy5lbmZvcmNlU291cmNlTW9kZUZvckFjdGl2ZVZpZXcoKTtcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XHJcbiAgICAgIGlkOiBcImxvb20tcnVuLWN1cnJlbnQtY29kZS1ibG9ja1wiLFxyXG4gICAgICBuYW1lOiBcImxvb206IFJ1biBDdXJyZW50IENvZGUgQmxvY2tcIixcclxuICAgICAgZWRpdG9yQ2FsbGJhY2s6IGFzeW5jIChlZGl0b3IsIHZpZXcpID0+IHtcclxuICAgICAgICBjb25zdCBmaWxlID0gdmlldy5maWxlO1xyXG4gICAgICAgIGlmICghZmlsZSkge1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgYmxvY2tzID0gcGFyc2VNYXJrZG93bkNvZGVCbG9ja3MoZmlsZS5wYXRoLCBlZGl0b3IuZ2V0VmFsdWUoKSk7XHJcbiAgICAgICAgY29uc3QgYmxvY2sgPSBmaW5kQmxvY2tBdExpbmUoYmxvY2tzLCBlZGl0b3IuZ2V0Q3Vyc29yKCkubGluZSk7XHJcbiAgICAgICAgaWYgKCFibG9jaykge1xyXG4gICAgICAgICAgbmV3IE5vdGljZShcIk5vIHN1cHBvcnRlZCBsb29tIGJsb2NrIGF0IHRoZSBjdXJyZW50IGN1cnNvci5cIik7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGF3YWl0IHRoaXMucnVuQmxvY2soZmlsZSwgYmxvY2spO1xyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcclxuICAgICAgaWQ6IFwibG9vbS1ydW4tYWxsLWNvZGUtYmxvY2tzXCIsXHJcbiAgICAgIG5hbWU6IFwibG9vbTogUnVuIEFsbCBTdXBwb3J0ZWQgQ29kZSBCbG9ja3MgaW4gQ3VycmVudCBOb3RlXCIsXHJcbiAgICAgIGNoZWNrQ2FsbGJhY2s6IChjaGVja2luZykgPT4ge1xyXG4gICAgICAgIGNvbnN0IGZpbGUgPSB0aGlzLmdldEFjdGl2ZU1hcmtkb3duRmlsZSgpO1xyXG4gICAgICAgIGlmICghZmlsZSkge1xyXG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoIWNoZWNraW5nKSB7XHJcbiAgICAgICAgICB2b2lkIHRoaXMucnVuQWxsQmxvY2tzSW5GaWxlKGZpbGUpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XHJcbiAgICAgIGlkOiBcImxvb20tY2xlYXItbm90ZS1vdXRwdXRzXCIsXHJcbiAgICAgIG5hbWU6IFwibG9vbTogQ2xlYXIgbG9vbSBPdXRwdXRzIGluIEN1cnJlbnQgTm90ZVwiLFxyXG4gICAgICBjaGVja0NhbGxiYWNrOiAoY2hlY2tpbmcpID0+IHtcclxuICAgICAgICBjb25zdCBmaWxlID0gdGhpcy5nZXRBY3RpdmVNYXJrZG93bkZpbGUoKTtcclxuICAgICAgICBpZiAoIWZpbGUpIHtcclxuICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKCFjaGVja2luZykge1xyXG4gICAgICAgICAgdm9pZCB0aGlzLmNsZWFyT3V0cHV0c0ZvckZpbGUoZmlsZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgZm9yIChjb25zdCBhbGlhcyBvZiBnZXRTdXBwb3J0ZWRMYW5ndWFnZUFsaWFzZXMoKSkge1xyXG4gICAgICB0aGlzLnJlZ2lzdGVyTWFya2Rvd25Db2RlQmxvY2tQcm9jZXNzb3IoYWxpYXMsIGFzeW5jIChzb3VyY2UsIGVsLCBjdHgpID0+IHtcclxuICAgICAgICBjb25zdCBmaWxlUGF0aCA9IGN0eC5zb3VyY2VQYXRoO1xyXG4gICAgICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoZmlsZVBhdGgpO1xyXG4gICAgICAgIGlmICghKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IGZ1bGxUZXh0ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuY2FjaGVkUmVhZChmaWxlKTtcclxuICAgICAgICBjb25zdCBibG9ja3MgPSBwYXJzZU1hcmtkb3duQ29kZUJsb2NrcyhmaWxlUGF0aCwgZnVsbFRleHQpO1xyXG4gICAgICAgIGNvbnN0IHNlY3Rpb24gPSBjdHguZ2V0U2VjdGlvbkluZm8oZWwpO1xyXG4gICAgICAgIGNvbnN0IGxpbmVTdGFydCA9IHNlY3Rpb24/LmxpbmVTdGFydCA/PyAtMTtcclxuICAgICAgICBjb25zdCBibG9jayA9IGJsb2Nrcy5maW5kKChjYW5kaWRhdGUpID0+IGNhbmRpZGF0ZS5zdGFydExpbmUgPT09IGxpbmVTdGFydCAmJiBjYW5kaWRhdGUuY29udGVudCA9PT0gc291cmNlKTtcclxuICAgICAgICBpZiAoIWJsb2NrKSB7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBwcmUgPSBlbC5xdWVyeVNlbGVjdG9yKFwicHJlXCIpID8/IGVsO1xyXG4gICAgICAgIGN0eC5hZGRDaGlsZChuZXcgbG9vbVRvb2xiYXJSZW5kZXJDaGlsZChlbCwgdGhpcywgYmxvY2ssIHByZSBhcyBIVE1MRWxlbWVudCkpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLnJlZ2lzdGVyRWRpdG9yRXh0ZW5zaW9uKHRoaXMuY3JlYXRlTGl2ZVByZXZpZXdFeHRlbnNpb24oKSk7XHJcblxyXG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KFxyXG4gICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub24oXCJmaWxlLW9wZW5cIiwgKGZpbGUpID0+IHtcclxuICAgICAgICB0aGlzLnJlZnJlc2hBbGxWaWV3cygpO1xyXG4gICAgICAgIHZvaWQgdGhpcy5lbmZvcmNlU291cmNlTW9kZUZvckFjdGl2ZVZpZXcoKTtcclxuICAgICAgICBpZiAoZmlsZSAmJiB0aGlzLnNldHRpbmdzLmF1dG9SdW5PbkZpbGVPcGVuKSB7XHJcbiAgICAgICAgICB2b2lkIHRoaXMucnVuQWxsQmxvY2tzSW5GaWxlKGZpbGUpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSksXHJcbiAgICApO1xyXG5cclxuICAgIHRoaXMucmVnaXN0ZXJFdmVudChcclxuICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9uKFwiYWN0aXZlLWxlYWYtY2hhbmdlXCIsICgpID0+IHtcclxuICAgICAgICB2b2lkIHRoaXMuZW5mb3JjZVNvdXJjZU1vZGVGb3JBY3RpdmVWaWV3KCk7XHJcbiAgICAgIH0pLFxyXG4gICAgKTtcclxuXHJcbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQoXHJcbiAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbihcImVkaXRvci1jaGFuZ2VcIiwgKF9lZGl0b3IsIGN0eCkgPT4ge1xyXG4gICAgICAgIGlmIChjdHggaW5zdGFuY2VvZiBNYXJrZG93blZpZXcpIHtcclxuICAgICAgICAgIHZvaWQgdGhpcy5lbmZvcmNlU291cmNlTW9kZUZvckxlYWYoY3R4LmxlYWYpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSksXHJcbiAgICApO1xyXG4gIH1cclxuXHJcbiAgb251bmxvYWQoKTogdm9pZCB7XHJcbiAgICBmb3IgKGNvbnN0IGNvbnRyb2xsZXIgb2YgdGhpcy5ydW5uaW5nLnZhbHVlcygpKSB7XHJcbiAgICAgIGNvbnRyb2xsZXIuYWJvcnQoKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGFzeW5jIGxvYWRTZXR0aW5ncygpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIHRoaXMuc2V0dGluZ3MgPSB7XHJcbiAgICAgIC4uLkRFRkFVTFRfU0VUVElOR1MsXHJcbiAgICAgIC4uLihhd2FpdCB0aGlzLmxvYWREYXRhKCkpLFxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIGFzeW5jIHNhdmVTZXR0aW5ncygpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XHJcbiAgICB0aGlzLnJlZnJlc2hBbGxWaWV3cygpO1xyXG4gIH1cclxuXHJcbiAgaXNCbG9ja1J1bm5pbmcoYmxvY2tJZDogc3RyaW5nKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gdGhpcy5ydW5uaW5nLmhhcyhibG9ja0lkKTtcclxuICB9XHJcblxyXG4gIHJlZ2lzdGVyT3V0cHV0TGlzdGVuZXIoYmxvY2tJZDogc3RyaW5nLCBsaXN0ZW5lcjogKCkgPT4gdm9pZCk6ICgpID0+IHZvaWQge1xyXG4gICAgaWYgKCF0aGlzLm91dHB1dExpc3RlbmVycy5oYXMoYmxvY2tJZCkpIHtcclxuICAgICAgdGhpcy5vdXRwdXRMaXN0ZW5lcnMuc2V0KGJsb2NrSWQsIG5ldyBTZXQoKSk7XHJcbiAgICB9XHJcbiAgICB0aGlzLm91dHB1dExpc3RlbmVycy5nZXQoYmxvY2tJZCk/LmFkZChsaXN0ZW5lcik7XHJcbiAgICByZXR1cm4gKCkgPT4ge1xyXG4gICAgICB0aGlzLm91dHB1dExpc3RlbmVycy5nZXQoYmxvY2tJZCk/LmRlbGV0ZShsaXN0ZW5lcik7XHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgY3JlYXRlVG9vbGJhckVsZW1lbnQoYmxvY2s6IGxvb21Db2RlQmxvY2spOiBIVE1MRWxlbWVudCB7XHJcbiAgICByZXR1cm4gY3JlYXRlQ29kZUJsb2NrVG9vbGJhcihibG9jay5pZCwgdGhpcy5pc0Jsb2NrUnVubmluZyhibG9jay5pZCksIHtcclxuICAgICAgb25SdW46ICgpID0+IHZvaWQgdGhpcy5ydW5BY3RpdmVCbG9ja0J5SWQoYmxvY2suaWQpLFxyXG4gICAgICBvbkNvcHk6IGFzeW5jICgpID0+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgYXdhaXQgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQoYmxvY2suY29udGVudCk7XHJcbiAgICAgICAgICBuZXcgTm90aWNlKFwiQ29kZSBjb3BpZWRcIik7XHJcbiAgICAgICAgfSBjYXRjaCB7XHJcbiAgICAgICAgICBuZXcgTm90aWNlKFwiQ2xpcGJvYXJkIHdyaXRlIGZhaWxlZC5cIik7XHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICBvbkNsZWFyOiAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5vdXRwdXRzLmRlbGV0ZShibG9jay5pZCk7XHJcbiAgICAgICAgdm9pZCB0aGlzLnJlbW92ZU1hbmFnZWRPdXRwdXRCbG9jayhibG9jay5maWxlUGF0aCwgYmxvY2suaWQpO1xyXG4gICAgICAgIHRoaXMubm90aWZ5T3V0cHV0Q2hhbmdlZChibG9jay5pZCk7XHJcbiAgICAgIH0sXHJcbiAgICAgIG9uVG9nZ2xlT3V0cHV0OiAoKSA9PiB7XHJcbiAgICAgICAgY29uc3Qgb3V0cHV0ID0gdGhpcy5vdXRwdXRzLmdldChibG9jay5pZCk7XHJcbiAgICAgICAgaWYgKCFvdXRwdXQpIHtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgb3V0cHV0LnZpc2libGUgPSAhb3V0cHV0LnZpc2libGU7XHJcbiAgICAgICAgdGhpcy5ub3RpZnlPdXRwdXRDaGFuZ2VkKGJsb2NrLmlkKTtcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcmVuZGVyT3V0cHV0SW50byhibG9ja0lkOiBzdHJpbmcsIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcclxuICAgIGNvbnRhaW5lci5lbXB0eSgpO1xyXG5cclxuICAgIGNvbnN0IG91dHB1dCA9IHRoaXMub3V0cHV0cy5nZXQoYmxvY2tJZCk7XHJcbiAgICBpZiAodGhpcy5ydW5uaW5nLmhhcyhibG9ja0lkKSkge1xyXG4gICAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQoY3JlYXRlUnVubmluZ1BhbmVsKCkpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCFvdXRwdXQgfHwgIW91dHB1dC52aXNpYmxlKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQoY3JlYXRlT3V0cHV0UGFuZWwob3V0cHV0KSk7XHJcbiAgfVxyXG5cclxuICBhc3luYyBydW5BY3RpdmVCbG9ja0J5SWQoYmxvY2tJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBibG9jayA9IHRoaXMuZmluZEFjdGl2ZUJsb2NrQnlJZChibG9ja0lkKTtcclxuICAgIGNvbnN0IGZpbGUgPSB0aGlzLmdldEFjdGl2ZU1hcmtkb3duRmlsZSgpO1xyXG4gICAgaWYgKCFibG9jayB8fCAhZmlsZSkge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBhd2FpdCB0aGlzLnJ1bkJsb2NrKGZpbGUsIGJsb2NrKTtcclxuICB9XHJcblxyXG4gIGFzeW5jIHJ1bkFsbEJsb2Nrc0luRmlsZShmaWxlOiBURmlsZSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3Qgc291cmNlID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuY2FjaGVkUmVhZChmaWxlKTtcclxuICAgIGNvbnN0IGJsb2NrcyA9IHBhcnNlTWFya2Rvd25Db2RlQmxvY2tzKGZpbGUucGF0aCwgc291cmNlKTtcclxuICAgIGNvbnN0IHN1cHBvcnRlZEJsb2NrcyA9IGJsb2Nrcy5maWx0ZXIoKGJsb2NrKSA9PiB0aGlzLnJlZ2lzdHJ5LmdldFJ1bm5lckZvckJsb2NrKGJsb2NrLCB0aGlzLnNldHRpbmdzKSk7XHJcblxyXG4gICAgaWYgKCFzdXBwb3J0ZWRCbG9ja3MubGVuZ3RoKSB7XHJcbiAgICAgIG5ldyBOb3RpY2UoXCJObyBzdXBwb3J0ZWQgbG9vbSBibG9ja3MgZm91bmQgaW4gdGhlIGN1cnJlbnQgbm90ZS5cIik7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBmb3IgKGNvbnN0IGJsb2NrIG9mIHN1cHBvcnRlZEJsb2Nrcykge1xyXG4gICAgICBhd2FpdCB0aGlzLnJ1bkJsb2NrKGZpbGUsIGJsb2NrKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGFzeW5jIGNsZWFyT3V0cHV0c0ZvckZpbGUoZmlsZTogVEZpbGUpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IHNvdXJjZSA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNhY2hlZFJlYWQoZmlsZSk7XHJcbiAgICBjb25zdCBibG9ja3MgPSBwYXJzZU1hcmtkb3duQ29kZUJsb2NrcyhmaWxlLnBhdGgsIHNvdXJjZSk7XHJcbiAgICBmb3IgKGNvbnN0IGJsb2NrIG9mIGJsb2Nrcykge1xyXG4gICAgICB0aGlzLm91dHB1dHMuZGVsZXRlKGJsb2NrLmlkKTtcclxuICAgICAgdGhpcy5ub3RpZnlPdXRwdXRDaGFuZ2VkKGJsb2NrLmlkKTtcclxuICAgICAgYXdhaXQgdGhpcy5yZW1vdmVNYW5hZ2VkT3V0cHV0QmxvY2soZmlsZS5wYXRoLCBibG9jay5pZCk7XHJcbiAgICB9XHJcbiAgICBuZXcgTm90aWNlKFwibG9vbSBvdXRwdXRzIGNsZWFyZWQuXCIpO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgcnVuQmxvY2soZmlsZTogVEZpbGUsIGJsb2NrOiBsb29tQ29kZUJsb2NrKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBpZiAodGhpcy5ydW5uaW5nLmhhcyhibG9jay5pZCkpIHtcclxuICAgICAgbmV3IE5vdGljZShcIlRoaXMgbG9vbSBibG9jayBpcyBhbHJlYWR5IHJ1bm5pbmcuXCIpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCEoYXdhaXQgdGhpcy5lbnN1cmVFeGVjdXRpb25FbmFibGVkKCkpKSB7XHJcbiAgICAgIHNob3dFeGVjdXRpb25EaXNhYmxlZE5vdGljZSgpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgcnVubmVyID0gdGhpcy5yZWdpc3RyeS5nZXRSdW5uZXJGb3JCbG9jayhibG9jaywgdGhpcy5zZXR0aW5ncyk7XHJcbiAgICBpZiAoIXJ1bm5lcikge1xyXG4gICAgICBuZXcgTm90aWNlKGBObyBjb25maWd1cmVkIHJ1bm5lciBmb3IgJHtibG9jay5sYW5ndWFnZX0uYCk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xyXG4gICAgdGhpcy5ydW5uaW5nLnNldChibG9jay5pZCwgY29udHJvbGxlcik7XHJcbiAgICB0aGlzLm5vdGlmeU91dHB1dENoYW5nZWQoYmxvY2suaWQpO1xyXG4gICAgdGhpcy51cGRhdGVTdGF0dXNCYXIoKTtcclxuXHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCB3b3JraW5nRGlyZWN0b3J5ID0gdGhpcy5yZXNvbHZlV29ya2luZ0RpcmVjdG9yeShmaWxlKTtcclxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcnVubmVyLnJ1bihcclxuICAgICAgICBibG9jayxcclxuICAgICAgICB7XHJcbiAgICAgICAgICBmaWxlLFxyXG4gICAgICAgICAgd29ya2luZ0RpcmVjdG9yeSxcclxuICAgICAgICAgIHRpbWVvdXRNczogdGhpcy5zZXR0aW5ncy5kZWZhdWx0VGltZW91dE1zLFxyXG4gICAgICAgICAgc2lnbmFsOiBjb250cm9sbGVyLnNpZ25hbCxcclxuICAgICAgICB9LFxyXG4gICAgICAgIHRoaXMuc2V0dGluZ3MsXHJcbiAgICAgICk7XHJcblxyXG4gICAgICBpZiAocmVzdWx0LnRpbWVkT3V0KSB7XHJcbiAgICAgICAgcmVzdWx0LnN0ZGVyciA9IHJlc3VsdC5zdGRlcnIgfHwgYEV4ZWN1dGlvbiB0aW1lZCBvdXQgYWZ0ZXIgJHt0aGlzLnNldHRpbmdzLmRlZmF1bHRUaW1lb3V0TXN9IG1zLmA7XHJcbiAgICAgIH0gZWxzZSBpZiAocmVzdWx0LmNhbmNlbGxlZCkge1xyXG4gICAgICAgIHJlc3VsdC5zdGRlcnIgPSByZXN1bHQuc3RkZXJyIHx8IFwiRXhlY3V0aW9uIGNhbmNlbGxlZC5cIjtcclxuICAgICAgfSBlbHNlIGlmICghcmVzdWx0LnN1Y2Nlc3MgJiYgIXJlc3VsdC5zdGRlcnIudHJpbSgpKSB7XHJcbiAgICAgICAgcmVzdWx0LnN0ZGVyciA9IFwiUHJvY2VzcyBleGl0ZWQgdW5zdWNjZXNzZnVsbHkuXCI7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHRoaXMub3V0cHV0cy5zZXQoYmxvY2suaWQsIHtcclxuICAgICAgICBibG9ja0lkOiBibG9jay5pZCxcclxuICAgICAgICBibG9jayxcclxuICAgICAgICByZXN1bHQsXHJcbiAgICAgICAgY29sbGFwc2VkOiBmYWxzZSxcclxuICAgICAgICB2aXNpYmxlOiB0cnVlLFxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGlmICh0aGlzLnNldHRpbmdzLndyaXRlT3V0cHV0VG9Ob3RlKSB7XHJcbiAgICAgICAgYXdhaXQgdGhpcy53cml0ZU1hbmFnZWRPdXRwdXRCbG9jayhmaWxlLCBibG9jaywgcmVzdWx0KTtcclxuICAgICAgfVxyXG5cclxuICAgICAgbmV3IE5vdGljZShyZXN1bHQuc3VjY2VzcyA/IGBsb29tIHJhbiAke3J1bm5lci5kaXNwbGF5TmFtZX0gYmxvY2suYCA6IGBsb29tIHJ1biBmYWlsZWQgZm9yICR7cnVubmVyLmRpc3BsYXlOYW1lfS5gKTtcclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIGNvbnN0IG1lc3NhZ2UgPSBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcik7XHJcbiAgICAgIHRoaXMub3V0cHV0cy5zZXQoYmxvY2suaWQsIHtcclxuICAgICAgICBibG9ja0lkOiBibG9jay5pZCxcclxuICAgICAgICBibG9jayxcclxuICAgICAgICBjb2xsYXBzZWQ6IGZhbHNlLFxyXG4gICAgICAgIHZpc2libGU6IHRydWUsXHJcbiAgICAgICAgcmVzdWx0OiB7XHJcbiAgICAgICAgICBydW5uZXJJZDogcnVubmVyLmlkLFxyXG4gICAgICAgICAgcnVubmVyTmFtZTogcnVubmVyLmRpc3BsYXlOYW1lLFxyXG4gICAgICAgICAgc3RhcnRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXHJcbiAgICAgICAgICBmaW5pc2hlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXHJcbiAgICAgICAgICBkdXJhdGlvbk1zOiAwLFxyXG4gICAgICAgICAgZXhpdENvZGU6IC0xLFxyXG4gICAgICAgICAgc3Rkb3V0OiBcIlwiLFxyXG4gICAgICAgICAgc3RkZXJyOiBtZXNzYWdlLFxyXG4gICAgICAgICAgc3VjY2VzczogZmFsc2UsXHJcbiAgICAgICAgICB0aW1lZE91dDogZmFsc2UsXHJcbiAgICAgICAgICBjYW5jZWxsZWQ6IGZhbHNlLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0pO1xyXG4gICAgICBuZXcgTm90aWNlKGBsb29tIGVycm9yOiAke21lc3NhZ2V9YCk7XHJcbiAgICB9IGZpbmFsbHkge1xyXG4gICAgICB0aGlzLnJ1bm5pbmcuZGVsZXRlKGJsb2NrLmlkKTtcclxuICAgICAgdGhpcy5ub3RpZnlPdXRwdXRDaGFuZ2VkKGJsb2NrLmlkKTtcclxuICAgICAgdGhpcy51cGRhdGVTdGF0dXNCYXIoKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXN5bmMgZW5zdXJlRXhlY3V0aW9uRW5hYmxlZCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuICAgIGlmICh0aGlzLnNldHRpbmdzLmVuYWJsZUxvY2FsRXhlY3V0aW9uICYmIHRoaXMuc2V0dGluZ3MuaGFzQWNrbm93bGVkZ2VkRXhlY3V0aW9uUmlzaykge1xyXG4gICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gYXdhaXQgbmV3IFByb21pc2U8Ym9vbGVhbj4oKHJlc29sdmUpID0+IHtcclxuICAgICAgbGV0IHNldHRsZWQgPSBmYWxzZTtcclxuICAgICAgY29uc3Qgc2V0dGxlID0gKHZhbHVlOiBib29sZWFuKSA9PiB7XHJcbiAgICAgICAgaWYgKCFzZXR0bGVkKSB7XHJcbiAgICAgICAgICBzZXR0bGVkID0gdHJ1ZTtcclxuICAgICAgICAgIHJlc29sdmUodmFsdWUpO1xyXG4gICAgICAgIH1cclxuICAgICAgfTtcclxuXHJcbiAgICAgIGNvbnN0IG1vZGFsID0gbmV3IEV4ZWN1dGlvbkNvbnNlbnRNb2RhbCh0aGlzLmFwcCwgYXN5bmMgKCkgPT4ge1xyXG4gICAgICAgIHRoaXMuc2V0dGluZ3MuZW5hYmxlTG9jYWxFeGVjdXRpb24gPSB0cnVlO1xyXG4gICAgICAgIHRoaXMuc2V0dGluZ3MuaGFzQWNrbm93bGVkZ2VkRXhlY3V0aW9uUmlzayA9IHRydWU7XHJcbiAgICAgICAgYXdhaXQgdGhpcy5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICBzZXR0bGUodHJ1ZSk7XHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgY29uc3Qgb3JpZ2luYWxDbG9zZSA9IG1vZGFsLmNsb3NlLmJpbmQobW9kYWwpO1xyXG4gICAgICBtb2RhbC5jbG9zZSA9ICgpID0+IHtcclxuICAgICAgICBvcmlnaW5hbENsb3NlKCk7XHJcbiAgICAgICAgc2V0dGxlKHRoaXMuc2V0dGluZ3MuZW5hYmxlTG9jYWxFeGVjdXRpb24gJiYgdGhpcy5zZXR0aW5ncy5oYXNBY2tub3dsZWRnZWRFeGVjdXRpb25SaXNrKTtcclxuICAgICAgfTtcclxuICAgICAgbW9kYWwub3BlbigpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlc29sdmVXb3JraW5nRGlyZWN0b3J5KGZpbGU6IFRGaWxlKTogc3RyaW5nIHtcclxuICAgIGlmICh0aGlzLnNldHRpbmdzLndvcmtpbmdEaXJlY3RvcnkudHJpbSgpKSB7XHJcbiAgICAgIHJldHVybiB0aGlzLnNldHRpbmdzLndvcmtpbmdEaXJlY3RvcnkudHJpbSgpO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGFkYXB0ZXJCYXNlUGF0aCA9ICh0aGlzLmFwcC52YXVsdC5hZGFwdGVyIGFzIHsgYmFzZVBhdGg/OiBzdHJpbmcgfSkuYmFzZVBhdGggPz8gXCJcIjtcclxuICAgIGNvbnN0IGZpbGVGb2xkZXIgPSBkaXJuYW1lKGZpbGUucGF0aCk7XHJcbiAgICBjb25zdCByZXNvbHZlZCA9IGZpbGVGb2xkZXIgPT09IFwiLlwiID8gYWRhcHRlckJhc2VQYXRoIDogYCR7YWRhcHRlckJhc2VQYXRofS8ke2ZpbGVGb2xkZXJ9YDtcclxuICAgIHJldHVybiByZXNvbHZlZCB8fCBwcm9jZXNzLmN3ZCgpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSB1cGRhdGVTdGF0dXNCYXIoKTogdm9pZCB7XHJcbiAgICBjb25zdCBhY3RpdmVSdW5zID0gdGhpcy5ydW5uaW5nLnNpemU7XHJcbiAgICB0aGlzLnN0YXR1c0Jhckl0ZW1FbC5zZXRUZXh0KGFjdGl2ZVJ1bnMgPyBgbG9vbTogJHthY3RpdmVSdW5zfSBBY3RpdmUgUnVuJHthY3RpdmVSdW5zID09PSAxID8gXCJcIiA6IFwic1wifWAgOiBcImxvb206IElkbGVcIik7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIG5vdGlmeU91dHB1dENoYW5nZWQoYmxvY2tJZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICB0aGlzLm91dHB1dExpc3RlbmVycy5nZXQoYmxvY2tJZCk/LmZvckVhY2goKGxpc3RlbmVyKSA9PiBsaXN0ZW5lcigpKTtcclxuICAgIHRoaXMucmVmcmVzaEFsbFZpZXdzKCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlZnJlc2hBbGxWaWV3cygpOiB2b2lkIHtcclxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoXCJtYXJrZG93blwiKS5mb3JFYWNoKChsZWFmKSA9PiB7XHJcbiAgICAgIGNvbnN0IHZpZXcgPSBsZWFmLnZpZXcgYXMgTWFya2Rvd25WaWV3O1xyXG4gICAgICBjb25zdCBwcmV2aWV3TW9kZSA9ICh2aWV3IGFzIHsgcHJldmlld01vZGU/OiB7IHJlcmVuZGVyPzogKGZvcmNlPzogYm9vbGVhbikgPT4gdm9pZCB9IH0pLnByZXZpZXdNb2RlO1xyXG4gICAgICBwcmV2aWV3TW9kZT8ucmVyZW5kZXI/Lih0cnVlKTtcclxuICAgIH0pO1xyXG5cclxuICAgIGZvciAoY29uc3QgZWRpdG9yVmlldyBvZiB0aGlzLmVkaXRvclZpZXdzKSB7XHJcbiAgICAgIGVkaXRvclZpZXcuZGlzcGF0Y2goeyBlZmZlY3RzOiBsb29tUmVmcmVzaEVmZmVjdC5vZih1bmRlZmluZWQpIH0pO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRBY3RpdmVNYXJrZG93bkZpbGUoKTogVEZpbGUgfCBudWxsIHtcclxuICAgIGNvbnN0IHZpZXcgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlVmlld09mVHlwZShNYXJrZG93blZpZXcpO1xyXG4gICAgcmV0dXJuIHZpZXc/LmZpbGUgPz8gbnVsbDtcclxuICB9XHJcblxyXG4gIGFzeW5jIGVuZm9yY2VTb3VyY2VNb2RlRm9yQWN0aXZlVmlldygpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IHZpZXcgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlVmlld09mVHlwZShNYXJrZG93blZpZXcpO1xyXG4gICAgaWYgKCF2aWV3KSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBhd2FpdCB0aGlzLmVuZm9yY2VTb3VyY2VNb2RlRm9yTGVhZih2aWV3LmxlYWYpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhc3luYyBlbmZvcmNlU291cmNlTW9kZUZvckxlYWYobGVhZjogV29ya3NwYWNlTGVhZik6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgaWYgKCF0aGlzLnNldHRpbmdzLnByZXNlcnZlU291cmNlTW9kZSkge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGxlYWYuaXNEZWZlcnJlZCkge1xyXG4gICAgICBhd2FpdCBsZWFmLmxvYWRJZkRlZmVycmVkKCk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgdmlldyA9IGxlYWYudmlldztcclxuICAgIGlmICghKHZpZXcgaW5zdGFuY2VvZiBNYXJrZG93blZpZXcpIHx8ICF2aWV3LmZpbGUpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHNvdXJjZSA9IHZpZXcuZWRpdG9yPy5nZXRWYWx1ZT8uKCkgPz8gKGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNhY2hlZFJlYWQodmlldy5maWxlKSk7XHJcbiAgICBjb25zdCBibG9ja3MgPSBwYXJzZU1hcmtkb3duQ29kZUJsb2Nrcyh2aWV3LmZpbGUucGF0aCwgc291cmNlKTtcclxuICAgIGlmICghYmxvY2tzLmxlbmd0aCkge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3Qgdmlld1N0YXRlID0gbGVhZi5nZXRWaWV3U3RhdGUoKTtcclxuICAgIGNvbnN0IHN0YXRlID0geyAuLi4odmlld1N0YXRlLnN0YXRlID8/IHt9KSB9IGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xyXG4gICAgaWYgKHN0YXRlLm1vZGUgPT09IFwic291cmNlXCIgJiYgc3RhdGUuc291cmNlID09PSB0cnVlKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBzdGF0ZS5tb2RlID0gXCJzb3VyY2VcIjtcclxuICAgIHN0YXRlLnNvdXJjZSA9IHRydWU7XHJcblxyXG4gICAgYXdhaXQgbGVhZi5zZXRWaWV3U3RhdGUoe1xyXG4gICAgICAuLi52aWV3U3RhdGUsXHJcbiAgICAgIHN0YXRlLFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGZpbmRBY3RpdmVCbG9ja0J5SWQoYmxvY2tJZDogc3RyaW5nKTogbG9vbUNvZGVCbG9jayB8IG51bGwge1xyXG4gICAgY29uc3QgdmlldyA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVWaWV3T2ZUeXBlKE1hcmtkb3duVmlldyk7XHJcbiAgICBjb25zdCBmaWxlID0gdmlldz8uZmlsZTtcclxuICAgIGNvbnN0IGVkaXRvciA9IHZpZXc/LmVkaXRvcjtcclxuICAgIGlmICghZmlsZSB8fCAhZWRpdG9yKSB7XHJcbiAgICAgIHJldHVybiB0aGlzLm91dHB1dHMuZ2V0KGJsb2NrSWQpPy5ibG9jayA/PyBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGJsb2NrcyA9IHBhcnNlTWFya2Rvd25Db2RlQmxvY2tzKGZpbGUucGF0aCwgZWRpdG9yLmdldFZhbHVlKCkpO1xyXG4gICAgcmV0dXJuIGJsb2Nrcy5maW5kKChibG9jaykgPT4gYmxvY2suaWQgPT09IGJsb2NrSWQpID8/IHRoaXMub3V0cHV0cy5nZXQoYmxvY2tJZCk/LmJsb2NrID8/IG51bGw7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGNyZWF0ZUxpdmVQcmV2aWV3RXh0ZW5zaW9uKCkge1xyXG4gICAgY29uc3QgcGx1Z2luID0gdGhpcztcclxuXHJcbiAgICByZXR1cm4gVmlld1BsdWdpbi5mcm9tQ2xhc3MoXHJcbiAgICAgIGNsYXNzIHtcclxuICAgICAgICBkZWNvcmF0aW9ucztcclxuXHJcbiAgICAgICAgY29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSB2aWV3OiBFZGl0b3JWaWV3KSB7XHJcbiAgICAgICAgICBwbHVnaW4uZWRpdG9yVmlld3MuYWRkKHZpZXcpO1xyXG4gICAgICAgICAgdGhpcy5kZWNvcmF0aW9ucyA9IHRoaXMuYnVpbGREZWNvcmF0aW9ucygpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdXBkYXRlKHVwZGF0ZTogVmlld1VwZGF0ZSk6IHZvaWQge1xyXG4gICAgICAgICAgaWYgKHVwZGF0ZS5kb2NDaGFuZ2VkIHx8IHVwZGF0ZS52aWV3cG9ydENoYW5nZWQgfHwgdXBkYXRlLnRyYW5zYWN0aW9ucy5zb21lKCh0cikgPT4gdHIuZWZmZWN0cy5zb21lKChlZmZlY3QpID0+IGVmZmVjdC5pcyhsb29tUmVmcmVzaEVmZmVjdCkpKSkge1xyXG4gICAgICAgICAgICB0aGlzLmRlY29yYXRpb25zID0gdGhpcy5idWlsZERlY29yYXRpb25zKCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBkZXN0cm95KCk6IHZvaWQge1xyXG4gICAgICAgICAgcGx1Z2luLmVkaXRvclZpZXdzLmRlbGV0ZSh0aGlzLnZpZXcpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcHJpdmF0ZSBidWlsZERlY29yYXRpb25zKCkge1xyXG4gICAgICAgICAgY29uc3QgbWFya2Rvd25WaWV3ID0gcGx1Z2luLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlVmlld09mVHlwZShNYXJrZG93blZpZXcpO1xyXG4gICAgICAgICAgY29uc3QgZmlsZSA9IG1hcmtkb3duVmlldz8uZmlsZTtcclxuICAgICAgICAgIGlmICghZmlsZSkge1xyXG4gICAgICAgICAgICByZXR1cm4gRGVjb3JhdGlvbi5ub25lO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIGNvbnN0IHNvdXJjZSA9IHRoaXMudmlldy5zdGF0ZS5kb2MudG9TdHJpbmcoKTtcclxuICAgICAgICAgIGNvbnN0IGJsb2NrcyA9IHBhcnNlTWFya2Rvd25Db2RlQmxvY2tzKGZpbGUucGF0aCwgc291cmNlKTtcclxuICAgICAgICAgIGNvbnN0IGJ1aWxkZXIgPSBuZXcgUmFuZ2VTZXRCdWlsZGVyPERlY29yYXRpb24+KCk7XHJcblxyXG4gICAgICAgICAgZm9yIChjb25zdCBibG9jayBvZiBibG9ja3MpIHtcclxuICAgICAgICAgICAgY29uc3Qgc3RhcnRMaW5lID0gdGhpcy52aWV3LnN0YXRlLmRvYy5saW5lKGJsb2NrLnN0YXJ0TGluZSArIDEpO1xyXG4gICAgICAgICAgICBidWlsZGVyLmFkZChcclxuICAgICAgICAgICAgICBzdGFydExpbmUuZnJvbSxcclxuICAgICAgICAgICAgICBzdGFydExpbmUuZnJvbSxcclxuICAgICAgICAgICAgICBEZWNvcmF0aW9uLndpZGdldCh7XHJcbiAgICAgICAgICAgICAgICB3aWRnZXQ6IG5ldyBsb29tVG9vbGJhcldpZGdldChwbHVnaW4sIGJsb2NrKSxcclxuICAgICAgICAgICAgICAgIHNpZGU6IC0xLFxyXG4gICAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgICApO1xyXG5cclxuICAgICAgICAgICAgaWYgKHBsdWdpbi5vdXRwdXRzLmhhcyhibG9jay5pZCkgfHwgcGx1Z2luLnJ1bm5pbmcuaGFzKGJsb2NrLmlkKSkge1xyXG4gICAgICAgICAgICAgIGNvbnN0IGVuZExpbmUgPSB0aGlzLnZpZXcuc3RhdGUuZG9jLmxpbmUoYmxvY2suZW5kTGluZSArIDEpO1xyXG4gICAgICAgICAgICAgIGJ1aWxkZXIuYWRkKFxyXG4gICAgICAgICAgICAgICAgZW5kTGluZS50byxcclxuICAgICAgICAgICAgICAgIGVuZExpbmUudG8sXHJcbiAgICAgICAgICAgICAgICBEZWNvcmF0aW9uLndpZGdldCh7XHJcbiAgICAgICAgICAgICAgICAgIHdpZGdldDogbmV3IGxvb21PdXRwdXRXaWRnZXQocGx1Z2luLCBibG9jay5pZCksXHJcbiAgICAgICAgICAgICAgICAgIHNpZGU6IDEsXHJcbiAgICAgICAgICAgICAgICB9KSxcclxuICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgcmV0dXJuIGJ1aWxkZXIuZmluaXNoKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICB7XHJcbiAgICAgICAgZGVjb3JhdGlvbnM6ICh2YWx1ZSkgPT4gdmFsdWUuZGVjb3JhdGlvbnMsXHJcbiAgICAgIH0sXHJcbiAgICApO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhc3luYyB3cml0ZU1hbmFnZWRPdXRwdXRCbG9jayhmaWxlOiBURmlsZSwgYmxvY2s6IGxvb21Db2RlQmxvY2ssIHJlc3VsdDogbG9vbVN0b3JlZE91dHB1dFtcInJlc3VsdFwiXSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5hcHAudmF1bHQucHJvY2VzcyhmaWxlLCAoY29udGVudCkgPT4ge1xyXG4gICAgICBjb25zdCBsaW5lcyA9IGNvbnRlbnQuc3BsaXQoL1xccj9cXG4vKTtcclxuICAgICAgY29uc3QgYmxvY2tzID0gcGFyc2VNYXJrZG93bkNvZGVCbG9ja3MoZmlsZS5wYXRoLCBjb250ZW50KTtcclxuICAgICAgY29uc3QgY3VycmVudEJsb2NrID0gYmxvY2tzLmZpbmQoKGNhbmRpZGF0ZSkgPT4gY2FuZGlkYXRlLmlkID09PSBibG9jay5pZCk7XHJcbiAgICAgIGNvbnN0IHJlbmRlcmVkID0gdGhpcy5yZW5kZXJNYW5hZ2VkT3V0cHV0TWFya2Rvd24oYmxvY2suaWQsIHJlc3VsdCk7XHJcbiAgICAgIGNvbnN0IGV4aXN0aW5nUmFuZ2UgPSB0aGlzLmZpbmRNYW5hZ2VkT3V0cHV0UmFuZ2UobGluZXMsIGJsb2NrLmlkKTtcclxuXHJcbiAgICAgIGlmIChleGlzdGluZ1JhbmdlKSB7XHJcbiAgICAgICAgbGluZXMuc3BsaWNlKGV4aXN0aW5nUmFuZ2Uuc3RhcnQsIGV4aXN0aW5nUmFuZ2UuZW5kIC0gZXhpc3RpbmdSYW5nZS5zdGFydCArIDEsIC4uLnJlbmRlcmVkKTtcclxuICAgICAgICByZXR1cm4gbGluZXMuam9pbihcIlxcblwiKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKCFjdXJyZW50QmxvY2spIHtcclxuICAgICAgICByZXR1cm4gY29udGVudDtcclxuICAgICAgfVxyXG5cclxuICAgICAgbGluZXMuc3BsaWNlKGN1cnJlbnRCbG9jay5lbmRMaW5lICsgMSwgMCwgLi4ucmVuZGVyZWQpO1xyXG4gICAgICByZXR1cm4gbGluZXMuam9pbihcIlxcblwiKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhc3luYyByZW1vdmVNYW5hZ2VkT3V0cHV0QmxvY2soZmlsZVBhdGg6IHN0cmluZywgYmxvY2tJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGZpbGVQYXRoKTtcclxuICAgIGlmICghKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0LnByb2Nlc3MoZmlsZSwgKGNvbnRlbnQpID0+IHtcclxuICAgICAgY29uc3QgbGluZXMgPSBjb250ZW50LnNwbGl0KC9cXHI/XFxuLyk7XHJcbiAgICAgIGNvbnN0IHJhbmdlID0gdGhpcy5maW5kTWFuYWdlZE91dHB1dFJhbmdlKGxpbmVzLCBibG9ja0lkKTtcclxuICAgICAgaWYgKCFyYW5nZSkge1xyXG4gICAgICAgIHJldHVybiBjb250ZW50O1xyXG4gICAgICB9XHJcbiAgICAgIGxpbmVzLnNwbGljZShyYW5nZS5zdGFydCwgcmFuZ2UuZW5kIC0gcmFuZ2Uuc3RhcnQgKyAxKTtcclxuICAgICAgcmV0dXJuIGxpbmVzLmpvaW4oXCJcXG5cIik7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVuZGVyTWFuYWdlZE91dHB1dE1hcmtkb3duKGJsb2NrSWQ6IHN0cmluZywgcmVzdWx0OiBsb29tU3RvcmVkT3V0cHV0W1wicmVzdWx0XCJdKTogc3RyaW5nW10ge1xyXG4gICAgY29uc3QgYm9keSA9IFtcclxuICAgICAgYHJ1bm5lcj0ke3Jlc3VsdC5ydW5uZXJOYW1lfWAsXHJcbiAgICAgIGBleGl0PSR7cmVzdWx0LmV4aXRDb2RlID8/IFwiP1wifWAsXHJcbiAgICAgIGBkdXJhdGlvbj0ke3Jlc3VsdC5kdXJhdGlvbk1zfW1zYCxcclxuICAgICAgYHRpbWVzdGFtcD0ke3Jlc3VsdC5maW5pc2hlZEF0fWAsXHJcbiAgICAgIHJlc3VsdC5zdGRvdXQgPyBgc3Rkb3V0OlxcbiR7cmVzdWx0LnN0ZG91dH1gIDogXCJcIixcclxuICAgICAgcmVzdWx0LnN0ZGVyciA/IGBzdGRlcnI6XFxuJHtyZXN1bHQuc3RkZXJyfWAgOiBcIlwiLFxyXG4gICAgXVxyXG4gICAgICAuZmlsdGVyKEJvb2xlYW4pXHJcbiAgICAgIC5qb2luKFwiXFxuXFxuXCIpO1xyXG5cclxuICAgIHJldHVybiBbXHJcbiAgICAgIGA8IS0tIGxvb206b3V0cHV0OnN0YXJ0IGlkPSR7YmxvY2tJZH0gLS0+YCxcclxuICAgICAgXCJgYGB0ZXh0XCIsXHJcbiAgICAgIGJvZHksXHJcbiAgICAgIFwiYGBgXCIsXHJcbiAgICAgIFwiPCEtLSBsb29tOm91dHB1dDplbmQgLS0+XCIsXHJcbiAgICBdO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBmaW5kTWFuYWdlZE91dHB1dFJhbmdlKGxpbmVzOiBzdHJpbmdbXSwgYmxvY2tJZDogc3RyaW5nKTogeyBzdGFydDogbnVtYmVyOyBlbmQ6IG51bWJlciB9IHwgbnVsbCB7XHJcbiAgICBjb25zdCBzdGFydE1hcmtlciA9IGA8IS0tIGxvb206b3V0cHV0OnN0YXJ0IGlkPSR7YmxvY2tJZH0gLS0+YDtcclxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGluZXMubGVuZ3RoOyBpICs9IDEpIHtcclxuICAgICAgaWYgKGxpbmVzW2ldLnRyaW0oKSAhPT0gc3RhcnRNYXJrZXIpIHtcclxuICAgICAgICBjb250aW51ZTtcclxuICAgICAgfVxyXG5cclxuICAgICAgZm9yIChsZXQgaiA9IGkgKyAxOyBqIDwgbGluZXMubGVuZ3RoOyBqICs9IDEpIHtcclxuICAgICAgICBpZiAobGluZXNbal0udHJpbSgpID09PSBcIjwhLS0gbG9vbTpvdXRwdXQ6ZW5kIC0tPlwiKSB7XHJcbiAgICAgICAgICByZXR1cm4geyBzdGFydDogaSwgZW5kOiBqIH07XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbnVsbDtcclxuICB9XHJcbn1cclxuIiwgImltcG9ydCB7IGNyZWF0ZUhhc2ggfSBmcm9tIFwiY3J5cHRvXCI7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gc2hvcnRIYXNoKGlucHV0OiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gIHJldHVybiBjcmVhdGVIYXNoKFwic2hhMjU2XCIpLnVwZGF0ZShpbnB1dCkuZGlnZXN0KFwiaGV4XCIpLnNsaWNlKDAsIDE2KTtcclxufVxyXG4iLCAiaW1wb3J0IHsgc2hvcnRIYXNoIH0gZnJvbSBcIi4vdXRpbHMvaGFzaFwiO1xyXG5pbXBvcnQgdHlwZSB7IGxvb21Db2RlQmxvY2ssIGxvb21Ob3JtYWxpemVkTGFuZ3VhZ2UgfSBmcm9tIFwiLi90eXBlc1wiO1xyXG5cclxuY29uc3QgTEFOR1VBR0VfQUxJQVNFUzogUmVjb3JkPHN0cmluZywgbG9vbU5vcm1hbGl6ZWRMYW5ndWFnZT4gPSB7XHJcbiAgcHl0aG9uOiBcInB5dGhvblwiLFxyXG4gIHB5OiBcInB5dGhvblwiLFxyXG4gIGphdmFzY3JpcHQ6IFwiamF2YXNjcmlwdFwiLFxyXG4gIGpzOiBcImphdmFzY3JpcHRcIixcclxuICB0eXBlc2NyaXB0OiBcInR5cGVzY3JpcHRcIixcclxuICB0czogXCJ0eXBlc2NyaXB0XCIsXHJcbiAgb2NhbWw6IFwib2NhbWxcIixcclxuICBtbDogXCJvY2FtbFwiLFxyXG4gIGM6IFwiY1wiLFxyXG4gIGg6IFwiY1wiLFxyXG4gIGNwcDogXCJjcHBcIixcclxuICBjeHg6IFwiY3BwXCIsXHJcbiAgY2M6IFwiY3BwXCIsXHJcbiAgXCJjKytcIjogXCJjcHBcIixcclxuICBzaGVsbDogXCJzaGVsbFwiLFxyXG4gIHNoOiBcInNoZWxsXCIsXHJcbiAgYmFzaDogXCJzaGVsbFwiLFxyXG4gIHpzaDogXCJzaGVsbFwiLFxyXG4gIHJ1Ynk6IFwicnVieVwiLFxyXG4gIHJiOiBcInJ1YnlcIixcclxuICBwZXJsOiBcInBlcmxcIixcclxuICBwbDogXCJwZXJsXCIsXHJcbiAgbHVhOiBcImx1YVwiLFxyXG4gIHBocDogXCJwaHBcIixcclxuICBnbzogXCJnb1wiLFxyXG4gIGdvbGFuZzogXCJnb1wiLFxyXG4gIHJ1c3Q6IFwicnVzdFwiLFxyXG4gIHJzOiBcInJ1c3RcIixcclxuICBqYXZhOiBcImphdmFcIixcclxuICBsbHZtOiBcImxsdm0taXJcIixcclxuICBsbHZtaXI6IFwibGx2bS1pclwiLFxyXG4gIFwibGx2bS1pclwiOiBcImxsdm0taXJcIixcclxuICBsbDogXCJsbHZtLWlyXCIsXHJcbiAgbGVhbjogXCJsZWFuXCIsXHJcbiAgbGVhbjQ6IFwibGVhblwiLFxyXG4gIGNvcTogXCJjb3FcIixcclxuICB2OiBcImNvcVwiLFxyXG4gIHNtdDogXCJzbXRsaWJcIixcclxuICBzbXQyOiBcInNtdGxpYlwiLFxyXG4gIHNtdGxpYjogXCJzbXRsaWJcIixcclxuICBcInNtdC1saWJcIjogXCJzbXRsaWJcIixcclxuICB6MzogXCJzbXRsaWJcIixcclxufTtcclxuXHJcbmNvbnN0IE9VVFBVVF9TVEFSVCA9IC9ePCEtLVxccypsb29tOm91dHB1dDpzdGFydFxccytpZD0oW2EtZjAtOV0rKVxccyotLT4kL2k7XHJcbmNvbnN0IE9VVFBVVF9FTkQgPSAvXjwhLS1cXHMqbG9vbTpvdXRwdXQ6ZW5kXFxzKi0tPiQvaTtcclxuY29uc3QgRkVOQ0VfU1RBUlQgPSAvXihgYGArfH5+fispXFxzKihbXlxcc2BdKik/LiokLztcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemVMYW5ndWFnZShyYXdMYW5ndWFnZTogc3RyaW5nKTogbG9vbU5vcm1hbGl6ZWRMYW5ndWFnZSB8IG51bGwge1xyXG4gIGNvbnN0IG5vcm1hbGl6ZWQgPSByYXdMYW5ndWFnZS50cmltKCkudG9Mb3dlckNhc2UoKTtcclxuICByZXR1cm4gTEFOR1VBR0VfQUxJQVNFU1tub3JtYWxpemVkXSA/PyBudWxsO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZ2V0U3VwcG9ydGVkTGFuZ3VhZ2VBbGlhc2VzKCk6IHN0cmluZ1tdIHtcclxuICByZXR1cm4gT2JqZWN0LmtleXMoTEFOR1VBR0VfQUxJQVNFUyk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBwYXJzZU1hcmtkb3duQ29kZUJsb2NrcyhmaWxlUGF0aDogc3RyaW5nLCBzb3VyY2U6IHN0cmluZyk6IGxvb21Db2RlQmxvY2tbXSB7XHJcbiAgY29uc3QgbGluZXMgPSBzb3VyY2Uuc3BsaXQoL1xccj9cXG4vKTtcclxuICBjb25zdCBibG9ja3M6IGxvb21Db2RlQmxvY2tbXSA9IFtdO1xyXG4gIGxldCBvcmRpbmFsID0gMDtcclxuICBsZXQgaW5zaWRlTWFuYWdlZE91dHB1dCA9IGZhbHNlO1xyXG5cclxuICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbmVzLmxlbmd0aDsgaSArPSAxKSB7XHJcbiAgICBjb25zdCBsaW5lID0gbGluZXNbaV07XHJcblxyXG4gICAgaWYgKGluc2lkZU1hbmFnZWRPdXRwdXQpIHtcclxuICAgICAgaWYgKE9VVFBVVF9FTkQudGVzdChsaW5lLnRyaW0oKSkpIHtcclxuICAgICAgICBpbnNpZGVNYW5hZ2VkT3V0cHV0ID0gZmFsc2U7XHJcbiAgICAgIH1cclxuICAgICAgY29udGludWU7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKE9VVFBVVF9TVEFSVC50ZXN0KGxpbmUudHJpbSgpKSkge1xyXG4gICAgICBpbnNpZGVNYW5hZ2VkT3V0cHV0ID0gdHJ1ZTtcclxuICAgICAgY29udGludWU7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgZmVuY2VNYXRjaCA9IGxpbmUubWF0Y2goRkVOQ0VfU1RBUlQpO1xyXG4gICAgaWYgKCFmZW5jZU1hdGNoKSB7XHJcbiAgICAgIGNvbnRpbnVlO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHN0YXJ0TGluZSA9IGk7XHJcbiAgICBjb25zdCBmZW5jZUluZGVudCA9IGdldExlYWRpbmdXaGl0ZXNwYWNlKGxpbmUpO1xyXG4gICAgY29uc3QgZmVuY2VUb2tlbiA9IGZlbmNlTWF0Y2hbMV07XHJcbiAgICBjb25zdCBzb3VyY2VMYW5ndWFnZSA9IChmZW5jZU1hdGNoWzJdID8/IFwiXCIpLnRyaW0oKTtcclxuICAgIGNvbnN0IGxhbmd1YWdlID0gbm9ybWFsaXplTGFuZ3VhZ2Uoc291cmNlTGFuZ3VhZ2UpO1xyXG5cclxuICAgIGxldCBlbmRMaW5lID0gaTtcclxuICAgIGNvbnN0IGNvbnRlbnRMaW5lczogc3RyaW5nW10gPSBbXTtcclxuXHJcbiAgICBmb3IgKGxldCBqID0gaSArIDE7IGogPCBsaW5lcy5sZW5ndGg7IGogKz0gMSkge1xyXG4gICAgICBjb25zdCBpbm5lckxpbmUgPSBsaW5lc1tqXTtcclxuICAgICAgY29uc3QgdHJpbW1lZCA9IGlubmVyTGluZS50cmltKCk7XHJcblxyXG4gICAgICBpZiAodHJpbW1lZC5zdGFydHNXaXRoKGZlbmNlVG9rZW4pICYmIC9eKGBgYCt8fn5+KylcXHMqJC8udGVzdCh0cmltbWVkKSkge1xyXG4gICAgICAgIGVuZExpbmUgPSBqO1xyXG4gICAgICAgIGkgPSBqO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjb250ZW50TGluZXMucHVzaChzdHJpcEZlbmNlSW5kZW50KGlubmVyTGluZSwgZmVuY2VJbmRlbnQpKTtcclxuICAgICAgZW5kTGluZSA9IGo7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCFsYW5ndWFnZSkge1xyXG4gICAgICBjb250aW51ZTtcclxuICAgIH1cclxuXHJcbiAgICBvcmRpbmFsICs9IDE7XHJcbiAgICBjb25zdCBjb250ZW50ID0gY29udGVudExpbmVzLmpvaW4oXCJcXG5cIik7XHJcbiAgICBjb25zdCBjb250ZW50SGFzaCA9IHNob3J0SGFzaChjb250ZW50KTtcclxuICAgIGNvbnN0IGlkID0gc2hvcnRIYXNoKGAke2ZpbGVQYXRofToke29yZGluYWx9OiR7bGFuZ3VhZ2V9OiR7Y29udGVudEhhc2h9YCk7XHJcblxyXG4gICAgYmxvY2tzLnB1c2goe1xyXG4gICAgICBpZCxcclxuICAgICAgb3JkaW5hbCxcclxuICAgICAgZmlsZVBhdGgsXHJcbiAgICAgIGxhbmd1YWdlLFxyXG4gICAgICBsYW5ndWFnZUFsaWFzOiBzb3VyY2VMYW5ndWFnZS50b0xvd2VyQ2FzZSgpLFxyXG4gICAgICBzb3VyY2VMYW5ndWFnZSxcclxuICAgICAgY29udGVudCxcclxuICAgICAgc3RhcnRMaW5lLFxyXG4gICAgICBlbmRMaW5lLFxyXG4gICAgICBmZW5jZVN0YXJ0OiAwLFxyXG4gICAgICBmZW5jZUVuZDogMCxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIGJsb2NrcztcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGZpbmRCbG9ja0F0TGluZShibG9ja3M6IGxvb21Db2RlQmxvY2tbXSwgbGluZTogbnVtYmVyKTogbG9vbUNvZGVCbG9jayB8IG51bGwge1xyXG4gIHJldHVybiBibG9ja3MuZmluZCgoYmxvY2spID0+IGxpbmUgPj0gYmxvY2suc3RhcnRMaW5lICYmIGxpbmUgPD0gYmxvY2suZW5kTGluZSkgPz8gbnVsbDtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0TGVhZGluZ1doaXRlc3BhY2UobGluZTogc3RyaW5nKTogc3RyaW5nIHtcclxuICBjb25zdCBtYXRjaCA9IGxpbmUubWF0Y2goL15bXFx0IF0qLyk7XHJcbiAgcmV0dXJuIG1hdGNoPy5bMF0gPz8gXCJcIjtcclxufVxyXG5cclxuZnVuY3Rpb24gc3RyaXBGZW5jZUluZGVudChsaW5lOiBzdHJpbmcsIGZlbmNlSW5kZW50OiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gIGlmICghZmVuY2VJbmRlbnQpIHtcclxuICAgIHJldHVybiBsaW5lO1xyXG4gIH1cclxuXHJcbiAgbGV0IGluZGV4ID0gMDtcclxuICB3aGlsZSAoaW5kZXggPCBmZW5jZUluZGVudC5sZW5ndGggJiYgaW5kZXggPCBsaW5lLmxlbmd0aCAmJiBsaW5lW2luZGV4XSA9PT0gZmVuY2VJbmRlbnRbaW5kZXhdKSB7XHJcbiAgICBpbmRleCArPSAxO1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIGxpbmUuc2xpY2UoaW5kZXgpO1xyXG59XHJcbiIsICJpbXBvcnQgeyBta2R0ZW1wLCBybSwgd3JpdGVGaWxlIH0gZnJvbSBcImZzL3Byb21pc2VzXCI7XHJcbmltcG9ydCB7IHRtcGRpciB9IGZyb20gXCJvc1wiO1xyXG5pbXBvcnQgeyBqb2luIH0gZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IHsgc3Bhd24gfSBmcm9tIFwiY2hpbGRfcHJvY2Vzc1wiO1xyXG5pbXBvcnQgdHlwZSB7IGxvb21SdW5SZXN1bHQgfSBmcm9tIFwiLi4vdHlwZXNcIjtcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgbG9vbVByb2Nlc3NTcGVjIHtcclxuICBydW5uZXJJZDogc3RyaW5nO1xyXG4gIHJ1bm5lck5hbWU6IHN0cmluZztcclxuICBleGVjdXRhYmxlOiBzdHJpbmc7XHJcbiAgYXJnczogc3RyaW5nW107XHJcbiAgd29ya2luZ0RpcmVjdG9yeTogc3RyaW5nO1xyXG4gIHRpbWVvdXRNczogbnVtYmVyO1xyXG4gIHNpZ25hbDogQWJvcnRTaWduYWw7XHJcbiAgZW52PzogTm9kZUpTLlByb2Nlc3NFbnY7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgbG9vbVRlbXBTb3VyY2VTcGVjIGV4dGVuZHMgbG9vbVByb2Nlc3NTcGVjIHtcclxuICBmaWxlRXh0ZW5zaW9uOiBzdHJpbmc7XHJcbiAgc291cmNlOiBzdHJpbmc7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgbG9vbVRlbXBTb3VyY2VIYW5kbGUge1xyXG4gIHRlbXBEaXI6IHN0cmluZztcclxuICB0ZW1wRmlsZTogc3RyaW5nO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gd2l0aE5hbWVkVGVtcFNvdXJjZUZpbGU8VD4oXHJcbiAgZmlsZU5hbWU6IHN0cmluZyxcclxuICBzb3VyY2U6IHN0cmluZyxcclxuICBjYWxsYmFjazogKGhhbmRsZTogbG9vbVRlbXBTb3VyY2VIYW5kbGUpID0+IFByb21pc2U8VD4sXHJcbik6IFByb21pc2U8VD4ge1xyXG4gIGNvbnN0IHRlbXBEaXIgPSBhd2FpdCBta2R0ZW1wKGpvaW4odG1wZGlyKCksIFwibG9vbS1cIikpO1xyXG4gIGNvbnN0IHRlbXBGaWxlID0gam9pbih0ZW1wRGlyLCBmaWxlTmFtZSk7XHJcblxyXG4gIHRyeSB7XHJcbiAgICBhd2FpdCB3cml0ZUZpbGUodGVtcEZpbGUsIG5vcm1hbGl6ZUV4ZWN1dGFibGVTb3VyY2Uoc291cmNlKSwgXCJ1dGY4XCIpO1xyXG4gICAgcmV0dXJuIGF3YWl0IGNhbGxiYWNrKHsgdGVtcERpciwgdGVtcEZpbGUgfSk7XHJcbiAgfSBmaW5hbGx5IHtcclxuICAgIGF3YWl0IHJtKHRlbXBEaXIsIHsgcmVjdXJzaXZlOiB0cnVlLCBmb3JjZTogdHJ1ZSB9KTtcclxuICB9XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB3aXRoVGVtcFNvdXJjZUZpbGU8VD4oXHJcbiAgZmlsZUV4dGVuc2lvbjogc3RyaW5nLFxyXG4gIHNvdXJjZTogc3RyaW5nLFxyXG4gIGNhbGxiYWNrOiAoaGFuZGxlOiBsb29tVGVtcFNvdXJjZUhhbmRsZSkgPT4gUHJvbWlzZTxUPixcclxuKTogUHJvbWlzZTxUPiB7XHJcbiAgcmV0dXJuIHdpdGhOYW1lZFRlbXBTb3VyY2VGaWxlKGBzbmlwcGV0JHtmaWxlRXh0ZW5zaW9ufWAsIHNvdXJjZSwgY2FsbGJhY2spO1xyXG59XHJcblxyXG5mdW5jdGlvbiBub3JtYWxpemVFeGVjdXRhYmxlU291cmNlKHNvdXJjZTogc3RyaW5nKTogc3RyaW5nIHtcclxuICBjb25zdCBsaW5lcyA9IHNvdXJjZS5zcGxpdChcIlxcblwiKTtcclxuICBjb25zdCBub25FbXB0eUxpbmVzID0gbGluZXMuZmlsdGVyKChsaW5lKSA9PiBsaW5lLnRyaW0oKS5sZW5ndGggPiAwKTtcclxuICBpZiAoIW5vbkVtcHR5TGluZXMubGVuZ3RoKSB7XHJcbiAgICByZXR1cm4gc291cmNlO1xyXG4gIH1cclxuXHJcbiAgbGV0IHNoYXJlZEluZGVudCA9IGdldExlYWRpbmdXaGl0ZXNwYWNlKG5vbkVtcHR5TGluZXNbMF0pO1xyXG4gIGZvciAoY29uc3QgbGluZSBvZiBub25FbXB0eUxpbmVzLnNsaWNlKDEpKSB7XHJcbiAgICBzaGFyZWRJbmRlbnQgPSBzaGFyZWRXaGl0ZXNwYWNlUHJlZml4KHNoYXJlZEluZGVudCwgZ2V0TGVhZGluZ1doaXRlc3BhY2UobGluZSkpO1xyXG4gICAgaWYgKCFzaGFyZWRJbmRlbnQpIHtcclxuICAgICAgcmV0dXJuIHNvdXJjZTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGlmICghc2hhcmVkSW5kZW50KSB7XHJcbiAgICByZXR1cm4gc291cmNlO1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIGxpbmVzXHJcbiAgICAubWFwKChsaW5lKSA9PiAobGluZS50cmltKCkubGVuZ3RoID09PSAwID8gbGluZSA6IGxpbmUuc3RhcnRzV2l0aChzaGFyZWRJbmRlbnQpID8gbGluZS5zbGljZShzaGFyZWRJbmRlbnQubGVuZ3RoKSA6IGxpbmUpKVxyXG4gICAgLmpvaW4oXCJcXG5cIik7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldExlYWRpbmdXaGl0ZXNwYWNlKGxpbmU6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgY29uc3QgbWF0Y2ggPSBsaW5lLm1hdGNoKC9eW1xcdCBdKi8pO1xyXG4gIHJldHVybiBtYXRjaD8uWzBdID8/IFwiXCI7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHNoYXJlZFdoaXRlc3BhY2VQcmVmaXgobGVmdDogc3RyaW5nLCByaWdodDogc3RyaW5nKTogc3RyaW5nIHtcclxuICBsZXQgaW5kZXggPSAwO1xyXG4gIHdoaWxlIChpbmRleCA8IGxlZnQubGVuZ3RoICYmIGluZGV4IDwgcmlnaHQubGVuZ3RoICYmIGxlZnRbaW5kZXhdID09PSByaWdodFtpbmRleF0pIHtcclxuICAgIGluZGV4ICs9IDE7XHJcbiAgfVxyXG4gIHJldHVybiBsZWZ0LnNsaWNlKDAsIGluZGV4KTtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJ1blByb2Nlc3Moc3BlYzogbG9vbVByb2Nlc3NTcGVjKTogUHJvbWlzZTxsb29tUnVuUmVzdWx0PiB7XHJcbiAgY29uc3Qgc3RhcnRlZEF0ID0gbmV3IERhdGUoKTtcclxuICBsZXQgc3Rkb3V0ID0gXCJcIjtcclxuICBsZXQgc3RkZXJyID0gXCJcIjtcclxuICBsZXQgZXhpdENvZGU6IG51bWJlciB8IG51bGwgPSBudWxsO1xyXG4gIGxldCB0aW1lZE91dCA9IGZhbHNlO1xyXG4gIGxldCBjYW5jZWxsZWQgPSBmYWxzZTtcclxuICBsZXQgY2hpbGQ6IFJldHVyblR5cGU8dHlwZW9mIHNwYXduPiB8IG51bGwgPSBudWxsO1xyXG4gIGxldCB0aW1lb3V0SGFuZGxlOiBOb2RlSlMuVGltZW91dCB8IG51bGwgPSBudWxsO1xyXG4gIGxldCBhYm9ydEhhbmRsZXI6ICgoKSA9PiB2b2lkKSB8IG51bGwgPSBudWxsO1xyXG5cclxuICB0cnkge1xyXG4gICAgYXdhaXQgbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICBjaGlsZCA9IHNwYXduKHNwZWMuZXhlY3V0YWJsZSwgc3BlYy5hcmdzLCB7XHJcbiAgICAgICAgY3dkOiBzcGVjLndvcmtpbmdEaXJlY3RvcnksXHJcbiAgICAgICAgc2hlbGw6IGZhbHNlLFxyXG4gICAgICAgIGVudjoge1xyXG4gICAgICAgICAgLi4ucHJvY2Vzcy5lbnYsXHJcbiAgICAgICAgICAuLi5zcGVjLmVudixcclxuICAgICAgICB9LFxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGNvbnN0IGFib3J0ID0gKCkgPT4ge1xyXG4gICAgICAgIGNhbmNlbGxlZCA9IHRydWU7XHJcbiAgICAgICAgY2hpbGQ/LmtpbGwoXCJTSUdURVJNXCIpO1xyXG4gICAgICB9O1xyXG4gICAgICBhYm9ydEhhbmRsZXIgPSBhYm9ydDtcclxuXHJcbiAgICAgIGlmIChzcGVjLnNpZ25hbC5hYm9ydGVkKSB7XHJcbiAgICAgICAgYWJvcnQoKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBzcGVjLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgYWJvcnQsIHsgb25jZTogdHJ1ZSB9KTtcclxuICAgICAgfVxyXG5cclxuICAgICAgdGltZW91dEhhbmRsZSA9IHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgIHRpbWVkT3V0ID0gdHJ1ZTtcclxuICAgICAgICBjaGlsZD8ua2lsbChcIlNJR1RFUk1cIik7XHJcbiAgICAgIH0sIHNwZWMudGltZW91dE1zKTtcclxuXHJcbiAgICAgIGNoaWxkLnN0ZG91dD8ub24oXCJkYXRhXCIsIChjaHVuaykgPT4ge1xyXG4gICAgICAgIHN0ZG91dCArPSBjaHVuay50b1N0cmluZygpO1xyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGNoaWxkLnN0ZGVycj8ub24oXCJkYXRhXCIsIChjaHVuaykgPT4ge1xyXG4gICAgICAgIHN0ZGVyciArPSBjaHVuay50b1N0cmluZygpO1xyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGNoaWxkLm9uKFwiZXJyb3JcIiwgKGVycm9yKSA9PiB7XHJcbiAgICAgICAgcmVqZWN0KGVycm9yKTtcclxuICAgICAgfSk7XHJcblxyXG4gICAgICBjaGlsZC5vbihcImNsb3NlXCIsIChjb2RlKSA9PiB7XHJcbiAgICAgICAgZXhpdENvZGUgPSBjb2RlO1xyXG4gICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgc3RkZXJyID0gc3RkZXJyIHx8IGZvcm1hdFByb2Nlc3NFcnJvcihlcnJvciwgc3BlYy5leGVjdXRhYmxlKTtcclxuICAgIGV4aXRDb2RlID0gZXhpdENvZGUgPz8gLTE7XHJcbiAgfSBmaW5hbGx5IHtcclxuICAgIGlmIChhYm9ydEhhbmRsZXIpIHtcclxuICAgICAgc3BlYy5zaWduYWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGFib3J0SGFuZGxlcik7XHJcbiAgICB9XHJcbiAgICBpZiAodGltZW91dEhhbmRsZSkge1xyXG4gICAgICBjbGVhclRpbWVvdXQodGltZW91dEhhbmRsZSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBjb25zdCBmaW5pc2hlZEF0ID0gbmV3IERhdGUoKTtcclxuICBjb25zdCBkdXJhdGlvbk1zID0gZmluaXNoZWRBdC5nZXRUaW1lKCkgLSBzdGFydGVkQXQuZ2V0VGltZSgpO1xyXG4gIGNvbnN0IHN1Y2Nlc3MgPSAhdGltZWRPdXQgJiYgIWNhbmNlbGxlZCAmJiBleGl0Q29kZSA9PT0gMDtcclxuXHJcbiAgcmV0dXJuIHtcclxuICAgIHJ1bm5lcklkOiBzcGVjLnJ1bm5lcklkLFxyXG4gICAgcnVubmVyTmFtZTogc3BlYy5ydW5uZXJOYW1lLFxyXG4gICAgc3RhcnRlZEF0OiBzdGFydGVkQXQudG9JU09TdHJpbmcoKSxcclxuICAgIGZpbmlzaGVkQXQ6IGZpbmlzaGVkQXQudG9JU09TdHJpbmcoKSxcclxuICAgIGR1cmF0aW9uTXMsXHJcbiAgICBleGl0Q29kZSxcclxuICAgIHN0ZG91dCxcclxuICAgIHN0ZGVycixcclxuICAgIHN1Y2Nlc3MsXHJcbiAgICB0aW1lZE91dCxcclxuICAgIGNhbmNlbGxlZCxcclxuICB9O1xyXG59XHJcblxyXG5mdW5jdGlvbiBmb3JtYXRQcm9jZXNzRXJyb3IoZXJyb3I6IHVua25vd24sIGV4ZWN1dGFibGU6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgaWYgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IgJiYgXCJjb2RlXCIgaW4gZXJyb3IgJiYgKGVycm9yIGFzIE5vZGVKUy5FcnJub0V4Y2VwdGlvbikuY29kZSA9PT0gXCJFTk9FTlRcIikge1xyXG4gICAgcmV0dXJuIGBFeGVjdXRhYmxlIG5vdCBmb3VuZDogJHtleGVjdXRhYmxlfWA7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcnVuVGVtcEZpbGVQcm9jZXNzKHNwZWM6IGxvb21UZW1wU291cmNlU3BlYyk6IFByb21pc2U8bG9vbVJ1blJlc3VsdD4ge1xyXG4gIHJldHVybiB3aXRoVGVtcFNvdXJjZUZpbGUoc3BlYy5maWxlRXh0ZW5zaW9uLCBzcGVjLnNvdXJjZSwgYXN5bmMgKHsgdGVtcEZpbGUsIHRlbXBEaXIgfSkgPT5cclxuICAgIHJ1blByb2Nlc3Moe1xyXG4gICAgICBydW5uZXJJZDogc3BlYy5ydW5uZXJJZCxcclxuICAgICAgcnVubmVyTmFtZTogc3BlYy5ydW5uZXJOYW1lLFxyXG4gICAgICBleGVjdXRhYmxlOiBzcGVjLmV4ZWN1dGFibGUsXHJcbiAgICAgIGFyZ3M6IHNwZWMuYXJncy5tYXAoKHZhbHVlKSA9PiB2YWx1ZS5yZXBsYWNlQWxsKFwie2ZpbGV9XCIsIHRlbXBGaWxlKS5yZXBsYWNlQWxsKFwie3RlbXBEaXJ9XCIsIHRlbXBEaXIpKSxcclxuICAgICAgd29ya2luZ0RpcmVjdG9yeTogc3BlYy53b3JraW5nRGlyZWN0b3J5LFxyXG4gICAgICB0aW1lb3V0TXM6IHNwZWMudGltZW91dE1zLFxyXG4gICAgICBzaWduYWw6IHNwZWMuc2lnbmFsLFxyXG4gICAgICBlbnY6IGV4cGFuZFRlbXBsYXRlZEVudihzcGVjLmVudiwgdGVtcEZpbGUsIHRlbXBEaXIpLFxyXG4gICAgfSksXHJcbiAgKTtcclxufVxyXG5cclxuZnVuY3Rpb24gZXhwYW5kVGVtcGxhdGVkRW52KGVudjogTm9kZUpTLlByb2Nlc3NFbnYgfCB1bmRlZmluZWQsIHRlbXBGaWxlOiBzdHJpbmcsIHRlbXBEaXI6IHN0cmluZyk6IE5vZGVKUy5Qcm9jZXNzRW52IHwgdW5kZWZpbmVkIHtcclxuICBpZiAoIWVudikge1xyXG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICB9XHJcblxyXG4gIHJldHVybiBPYmplY3QuZnJvbUVudHJpZXMoXHJcbiAgICBPYmplY3QuZW50cmllcyhlbnYpLm1hcCgoW2tleSwgdmFsdWVdKSA9PiBbXHJcbiAgICAgIGtleSxcclxuICAgICAgdHlwZW9mIHZhbHVlID09PSBcInN0cmluZ1wiID8gdmFsdWUucmVwbGFjZUFsbChcIntmaWxlfVwiLCB0ZW1wRmlsZSkucmVwbGFjZUFsbChcInt0ZW1wRGlyfVwiLCB0ZW1wRGlyKSA6IHZhbHVlLFxyXG4gICAgXSksXHJcbiAgKTtcclxufVxyXG4iLCAiaW1wb3J0IHsgcnVuVGVtcEZpbGVQcm9jZXNzIH0gZnJvbSBcIi4uL2V4ZWN1dGlvbi9wcm9jZXNzUnVubmVyXCI7XHJcbmltcG9ydCB0eXBlIHsgbG9vbUNvZGVCbG9jaywgbG9vbVBsdWdpblNldHRpbmdzLCBsb29tUnVuQ29udGV4dCwgbG9vbVJ1blJlc3VsdCwgbG9vbVJ1bm5lciB9IGZyb20gXCIuLi90eXBlc1wiO1xyXG5cclxuZXhwb3J0IGNsYXNzIE5vZGVSdW5uZXIgaW1wbGVtZW50cyBsb29tUnVubmVyIHtcclxuICBpZCA9IFwibm9kZVwiO1xyXG4gIGRpc3BsYXlOYW1lID0gXCJOb2RlLmpzXCI7XHJcbiAgbGFuZ3VhZ2VzID0gW1wiamF2YXNjcmlwdFwiLCBcInR5cGVzY3JpcHRcIl0gYXMgY29uc3Q7XHJcblxyXG4gIGNhblJ1bihibG9jazogbG9vbUNvZGVCbG9jaywgc2V0dGluZ3M6IGxvb21QbHVnaW5TZXR0aW5ncyk6IGJvb2xlYW4ge1xyXG4gICAgaWYgKGJsb2NrLmxhbmd1YWdlID09PSBcImphdmFzY3JpcHRcIikge1xyXG4gICAgICByZXR1cm4gQm9vbGVhbihzZXR0aW5ncy5ub2RlRXhlY3V0YWJsZS50cmltKCkpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBCb29sZWFuKHNldHRpbmdzLnR5cGVzY3JpcHRUcmFuc3BpbGVyRXhlY3V0YWJsZS50cmltKCkpO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgcnVuKGJsb2NrOiBsb29tQ29kZUJsb2NrLCBjb250ZXh0OiBsb29tUnVuQ29udGV4dCwgc2V0dGluZ3M6IGxvb21QbHVnaW5TZXR0aW5ncyk6IFByb21pc2U8bG9vbVJ1blJlc3VsdD4ge1xyXG4gICAgaWYgKGJsb2NrLmxhbmd1YWdlID09PSBcImphdmFzY3JpcHRcIikge1xyXG4gICAgICByZXR1cm4gcnVuVGVtcEZpbGVQcm9jZXNzKHtcclxuICAgICAgICBydW5uZXJJZDogdGhpcy5pZCxcclxuICAgICAgICBydW5uZXJOYW1lOiB0aGlzLmRpc3BsYXlOYW1lLFxyXG4gICAgICAgIGV4ZWN1dGFibGU6IHNldHRpbmdzLm5vZGVFeGVjdXRhYmxlLnRyaW0oKSxcclxuICAgICAgICBhcmdzOiBbXCJ7ZmlsZX1cIl0sXHJcbiAgICAgICAgZmlsZUV4dGVuc2lvbjogXCIuanNcIixcclxuICAgICAgICBzb3VyY2U6IGJsb2NrLmNvbnRlbnQsXHJcbiAgICAgICAgd29ya2luZ0RpcmVjdG9yeTogY29udGV4dC53b3JraW5nRGlyZWN0b3J5LFxyXG4gICAgICAgIHRpbWVvdXRNczogY29udGV4dC50aW1lb3V0TXMsXHJcbiAgICAgICAgc2lnbmFsOiBjb250ZXh0LnNpZ25hbCxcclxuICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgZXhlY3V0YWJsZSA9IHNldHRpbmdzLnR5cGVzY3JpcHRUcmFuc3BpbGVyRXhlY3V0YWJsZS50cmltKCk7XHJcbiAgICBjb25zdCBydW5uZXJOYW1lID0gc2V0dGluZ3MudHlwZXNjcmlwdE1vZGUgPT09IFwidHN4XCIgPyBcIlR5cGVTY3JpcHQgKHRzeClcIiA6IFwiVHlwZVNjcmlwdCAodHMtbm9kZSlcIjtcclxuXHJcbiAgICByZXR1cm4gcnVuVGVtcEZpbGVQcm9jZXNzKHtcclxuICAgICAgcnVubmVySWQ6IGAke3RoaXMuaWR9OiR7c2V0dGluZ3MudHlwZXNjcmlwdE1vZGV9YCxcclxuICAgICAgcnVubmVyTmFtZSxcclxuICAgICAgZXhlY3V0YWJsZSxcclxuICAgICAgYXJnczogW1wie2ZpbGV9XCJdLFxyXG4gICAgICBmaWxlRXh0ZW5zaW9uOiBcIi50c1wiLFxyXG4gICAgICBzb3VyY2U6IGJsb2NrLmNvbnRlbnQsXHJcbiAgICAgIHdvcmtpbmdEaXJlY3Rvcnk6IGNvbnRleHQud29ya2luZ0RpcmVjdG9yeSxcclxuICAgICAgdGltZW91dE1zOiBjb250ZXh0LnRpbWVvdXRNcyxcclxuICAgICAgc2lnbmFsOiBjb250ZXh0LnNpZ25hbCxcclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG4iLCAiaW1wb3J0IHsgcnVuVGVtcEZpbGVQcm9jZXNzIH0gZnJvbSBcIi4uL2V4ZWN1dGlvbi9wcm9jZXNzUnVubmVyXCI7XHJcbmltcG9ydCB0eXBlIHsgbG9vbUNvZGVCbG9jaywgbG9vbU5vcm1hbGl6ZWRMYW5ndWFnZSwgbG9vbVBsdWdpblNldHRpbmdzLCBsb29tUnVuQ29udGV4dCwgbG9vbVJ1blJlc3VsdCwgbG9vbVJ1bm5lciB9IGZyb20gXCIuLi90eXBlc1wiO1xyXG5cclxuaW50ZXJmYWNlIEludGVycHJldGVkU3BlYyB7XHJcbiAgbGFuZ3VhZ2U6IGxvb21Ob3JtYWxpemVkTGFuZ3VhZ2U7XHJcbiAgZGlzcGxheU5hbWU6IHN0cmluZztcclxuICBleGVjdXRhYmxlOiAoc2V0dGluZ3M6IGxvb21QbHVnaW5TZXR0aW5ncykgPT4gc3RyaW5nO1xyXG4gIGZpbGVFeHRlbnNpb246IHN0cmluZztcclxuICBhcmdzPzogc3RyaW5nW107XHJcbiAgZW52PzogTm9kZUpTLlByb2Nlc3NFbnY7XHJcbiAgbWluaW11bVRpbWVvdXRNcz86IG51bWJlcjtcclxufVxyXG5cclxuY29uc3QgSU5URVJQUkVURURfU1BFQ1M6IEludGVycHJldGVkU3BlY1tdID0gW1xyXG4gIHtcclxuICAgIGxhbmd1YWdlOiBcInNoZWxsXCIsXHJcbiAgICBkaXNwbGF5TmFtZTogXCJTaGVsbFwiLFxyXG4gICAgZXhlY3V0YWJsZTogKHNldHRpbmdzKSA9PiBzZXR0aW5ncy5zaGVsbEV4ZWN1dGFibGUsXHJcbiAgICBmaWxlRXh0ZW5zaW9uOiBcIi5zaFwiLFxyXG4gIH0sXHJcbiAge1xyXG4gICAgbGFuZ3VhZ2U6IFwicnVieVwiLFxyXG4gICAgZGlzcGxheU5hbWU6IFwiUnVieVwiLFxyXG4gICAgZXhlY3V0YWJsZTogKHNldHRpbmdzKSA9PiBzZXR0aW5ncy5ydWJ5RXhlY3V0YWJsZSxcclxuICAgIGZpbGVFeHRlbnNpb246IFwiLnJiXCIsXHJcbiAgfSxcclxuICB7XHJcbiAgICBsYW5ndWFnZTogXCJwZXJsXCIsXHJcbiAgICBkaXNwbGF5TmFtZTogXCJQZXJsXCIsXHJcbiAgICBleGVjdXRhYmxlOiAoc2V0dGluZ3MpID0+IHNldHRpbmdzLnBlcmxFeGVjdXRhYmxlLFxyXG4gICAgZmlsZUV4dGVuc2lvbjogXCIucGxcIixcclxuICB9LFxyXG4gIHtcclxuICAgIGxhbmd1YWdlOiBcImx1YVwiLFxyXG4gICAgZGlzcGxheU5hbWU6IFwiTHVhXCIsXHJcbiAgICBleGVjdXRhYmxlOiAoc2V0dGluZ3MpID0+IHNldHRpbmdzLmx1YUV4ZWN1dGFibGUsXHJcbiAgICBmaWxlRXh0ZW5zaW9uOiBcIi5sdWFcIixcclxuICB9LFxyXG4gIHtcclxuICAgIGxhbmd1YWdlOiBcInBocFwiLFxyXG4gICAgZGlzcGxheU5hbWU6IFwiUEhQXCIsXHJcbiAgICBleGVjdXRhYmxlOiAoc2V0dGluZ3MpID0+IHNldHRpbmdzLnBocEV4ZWN1dGFibGUsXHJcbiAgICBmaWxlRXh0ZW5zaW9uOiBcIi5waHBcIixcclxuICB9LFxyXG4gIHtcclxuICAgIGxhbmd1YWdlOiBcImdvXCIsXHJcbiAgICBkaXNwbGF5TmFtZTogXCJHb1wiLFxyXG4gICAgZXhlY3V0YWJsZTogKHNldHRpbmdzKSA9PiBzZXR0aW5ncy5nb0V4ZWN1dGFibGUsXHJcbiAgICBmaWxlRXh0ZW5zaW9uOiBcIi5nb1wiLFxyXG4gICAgYXJnczogW1wicnVuXCIsIFwie2ZpbGV9XCJdLFxyXG4gICAgZW52OiB7XHJcbiAgICAgIEdPQ0FDSEU6IFwie3RlbXBEaXJ9L2dvY2FjaGVcIixcclxuICAgIH0sXHJcbiAgICBtaW5pbXVtVGltZW91dE1zOiAzMF8wMDAsXHJcbiAgfSxcclxuXTtcclxuXHJcbmV4cG9ydCBjbGFzcyBJbnRlcnByZXRlZFJ1bm5lciBpbXBsZW1lbnRzIGxvb21SdW5uZXIge1xyXG4gIGlkID0gXCJpbnRlcnByZXRlZFwiO1xyXG4gIGRpc3BsYXlOYW1lID0gXCJJbnRlcnByZXRlZFwiO1xyXG4gIGxhbmd1YWdlcyA9IElOVEVSUFJFVEVEX1NQRUNTLm1hcCgoc3BlYykgPT4gc3BlYy5sYW5ndWFnZSk7XHJcblxyXG4gIGNhblJ1bihibG9jazogbG9vbUNvZGVCbG9jaywgc2V0dGluZ3M6IGxvb21QbHVnaW5TZXR0aW5ncyk6IGJvb2xlYW4ge1xyXG4gICAgY29uc3Qgc3BlYyA9IHRoaXMuZ2V0U3BlYyhibG9jay5sYW5ndWFnZSk7XHJcbiAgICByZXR1cm4gQm9vbGVhbihzcGVjPy5leGVjdXRhYmxlKHNldHRpbmdzKS50cmltKCkpO1xyXG4gIH1cclxuXHJcbiAgcnVuKGJsb2NrOiBsb29tQ29kZUJsb2NrLCBjb250ZXh0OiBsb29tUnVuQ29udGV4dCwgc2V0dGluZ3M6IGxvb21QbHVnaW5TZXR0aW5ncyk6IFByb21pc2U8bG9vbVJ1blJlc3VsdD4ge1xyXG4gICAgY29uc3Qgc3BlYyA9IHRoaXMuZ2V0U3BlYyhibG9jay5sYW5ndWFnZSk7XHJcbiAgICBpZiAoIXNwZWMpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBsYW5ndWFnZTogJHtibG9jay5sYW5ndWFnZX1gKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gcnVuVGVtcEZpbGVQcm9jZXNzKHtcclxuICAgICAgcnVubmVySWQ6IGAke3RoaXMuaWR9OiR7YmxvY2subGFuZ3VhZ2V9YCxcclxuICAgICAgcnVubmVyTmFtZTogc3BlYy5kaXNwbGF5TmFtZSxcclxuICAgICAgZXhlY3V0YWJsZTogc3BlYy5leGVjdXRhYmxlKHNldHRpbmdzKS50cmltKCksXHJcbiAgICAgIGFyZ3M6IHNwZWMuYXJncyA/PyBbXCJ7ZmlsZX1cIl0sXHJcbiAgICAgIGZpbGVFeHRlbnNpb246IHNwZWMuZmlsZUV4dGVuc2lvbixcclxuICAgICAgc291cmNlOiBibG9jay5jb250ZW50LFxyXG4gICAgICB3b3JraW5nRGlyZWN0b3J5OiBjb250ZXh0LndvcmtpbmdEaXJlY3RvcnksXHJcbiAgICAgIHRpbWVvdXRNczogTWF0aC5tYXgoY29udGV4dC50aW1lb3V0TXMsIHNwZWMubWluaW11bVRpbWVvdXRNcyA/PyAwKSxcclxuICAgICAgc2lnbmFsOiBjb250ZXh0LnNpZ25hbCxcclxuICAgICAgZW52OiBzcGVjLmVudixcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRTcGVjKGxhbmd1YWdlOiBsb29tTm9ybWFsaXplZExhbmd1YWdlKTogSW50ZXJwcmV0ZWRTcGVjIHwgdW5kZWZpbmVkIHtcclxuICAgIHJldHVybiBJTlRFUlBSRVRFRF9TUEVDUy5maW5kKChzcGVjKSA9PiBzcGVjLmxhbmd1YWdlID09PSBsYW5ndWFnZSk7XHJcbiAgfVxyXG59XHJcbiIsICJpbXBvcnQgeyBydW5UZW1wRmlsZVByb2Nlc3MgfSBmcm9tIFwiLi4vZXhlY3V0aW9uL3Byb2Nlc3NSdW5uZXJcIjtcclxuaW1wb3J0IHR5cGUgeyBsb29tQ29kZUJsb2NrLCBsb29tUGx1Z2luU2V0dGluZ3MsIGxvb21SdW5Db250ZXh0LCBsb29tUnVuUmVzdWx0LCBsb29tUnVubmVyIH0gZnJvbSBcIi4uL3R5cGVzXCI7XHJcblxyXG5leHBvcnQgY2xhc3MgTGx2bVJ1bm5lciBpbXBsZW1lbnRzIGxvb21SdW5uZXIge1xyXG4gIGlkID0gXCJsbHZtLWlyXCI7XHJcbiAgZGlzcGxheU5hbWUgPSBcIkxMVk0gSVJcIjtcclxuICBsYW5ndWFnZXMgPSBbXCJsbHZtLWlyXCJdIGFzIGNvbnN0O1xyXG5cclxuICBjYW5SdW4oYmxvY2s6IGxvb21Db2RlQmxvY2ssIHNldHRpbmdzOiBsb29tUGx1Z2luU2V0dGluZ3MpOiBib29sZWFuIHtcclxuICAgIHJldHVybiBibG9jay5sYW5ndWFnZSA9PT0gXCJsbHZtLWlyXCIgJiYgQm9vbGVhbihzZXR0aW5ncy5sbHZtSW50ZXJwcmV0ZXJFeGVjdXRhYmxlLnRyaW0oKSk7XHJcbiAgfVxyXG5cclxuICBydW4oYmxvY2s6IGxvb21Db2RlQmxvY2ssIGNvbnRleHQ6IGxvb21SdW5Db250ZXh0LCBzZXR0aW5nczogbG9vbVBsdWdpblNldHRpbmdzKTogUHJvbWlzZTxsb29tUnVuUmVzdWx0PiB7XHJcbiAgICByZXR1cm4gcnVuVGVtcEZpbGVQcm9jZXNzKHtcclxuICAgICAgcnVubmVySWQ6IHRoaXMuaWQsXHJcbiAgICAgIHJ1bm5lck5hbWU6IHRoaXMuZGlzcGxheU5hbWUsXHJcbiAgICAgIGV4ZWN1dGFibGU6IHNldHRpbmdzLmxsdm1JbnRlcnByZXRlckV4ZWN1dGFibGUudHJpbSgpLFxyXG4gICAgICBhcmdzOiBbXCJ7ZmlsZX1cIl0sXHJcbiAgICAgIGZpbGVFeHRlbnNpb246IFwiLmxsXCIsXHJcbiAgICAgIHNvdXJjZTogYmxvY2suY29udGVudCxcclxuICAgICAgd29ya2luZ0RpcmVjdG9yeTogY29udGV4dC53b3JraW5nRGlyZWN0b3J5LFxyXG4gICAgICB0aW1lb3V0TXM6IE1hdGgubWF4KGNvbnRleHQudGltZW91dE1zLCAzMF8wMDApLFxyXG4gICAgICBzaWduYWw6IGNvbnRleHQuc2lnbmFsLFxyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcbiIsICJpbXBvcnQgeyBqb2luIH0gZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IHsgcnVuUHJvY2Vzcywgd2l0aE5hbWVkVGVtcFNvdXJjZUZpbGUsIHdpdGhUZW1wU291cmNlRmlsZSB9IGZyb20gXCIuLi9leGVjdXRpb24vcHJvY2Vzc1J1bm5lclwiO1xyXG5pbXBvcnQgdHlwZSB7IGxvb21Db2RlQmxvY2ssIGxvb21QbHVnaW5TZXR0aW5ncywgbG9vbVJ1bkNvbnRleHQsIGxvb21SdW5SZXN1bHQsIGxvb21SdW5uZXIgfSBmcm9tIFwiLi4vdHlwZXNcIjtcclxuXHJcbmV4cG9ydCBjbGFzcyBNYW5hZ2VkQ29tcGlsZWRSdW5uZXIgaW1wbGVtZW50cyBsb29tUnVubmVyIHtcclxuICBpZCA9IFwibWFuYWdlZC1jb21waWxlZFwiO1xyXG4gIGRpc3BsYXlOYW1lID0gXCJNYW5hZ2VkIGNvbXBpbGVyXCI7XHJcbiAgbGFuZ3VhZ2VzID0gW1wicnVzdFwiLCBcImphdmFcIl0gYXMgY29uc3Q7XHJcblxyXG4gIGNhblJ1bihibG9jazogbG9vbUNvZGVCbG9jaywgc2V0dGluZ3M6IGxvb21QbHVnaW5TZXR0aW5ncyk6IGJvb2xlYW4ge1xyXG4gICAgaWYgKGJsb2NrLmxhbmd1YWdlID09PSBcInJ1c3RcIikge1xyXG4gICAgICByZXR1cm4gQm9vbGVhbihzZXR0aW5ncy5ydXN0RXhlY3V0YWJsZS50cmltKCkpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChibG9jay5sYW5ndWFnZSA9PT0gXCJqYXZhXCIpIHtcclxuICAgICAgcmV0dXJuIEJvb2xlYW4oc2V0dGluZ3MuamF2YUV4ZWN1dGFibGUudHJpbSgpKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gZmFsc2U7XHJcbiAgfVxyXG5cclxuICBhc3luYyBydW4oYmxvY2s6IGxvb21Db2RlQmxvY2ssIGNvbnRleHQ6IGxvb21SdW5Db250ZXh0LCBzZXR0aW5nczogbG9vbVBsdWdpblNldHRpbmdzKTogUHJvbWlzZTxsb29tUnVuUmVzdWx0PiB7XHJcbiAgICBpZiAoYmxvY2subGFuZ3VhZ2UgPT09IFwicnVzdFwiKSB7XHJcbiAgICAgIHJldHVybiB0aGlzLnJ1blJ1c3QoYmxvY2ssIGNvbnRleHQsIHNldHRpbmdzKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoYmxvY2subGFuZ3VhZ2UgPT09IFwiamF2YVwiKSB7XHJcbiAgICAgIHJldHVybiB0aGlzLnJ1bkphdmEoYmxvY2ssIGNvbnRleHQsIHNldHRpbmdzKTtcclxuICAgIH1cclxuXHJcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIGxhbmd1YWdlOiAke2Jsb2NrLmxhbmd1YWdlfWApO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhc3luYyBydW5SdXN0KGJsb2NrOiBsb29tQ29kZUJsb2NrLCBjb250ZXh0OiBsb29tUnVuQ29udGV4dCwgc2V0dGluZ3M6IGxvb21QbHVnaW5TZXR0aW5ncyk6IFByb21pc2U8bG9vbVJ1blJlc3VsdD4ge1xyXG4gICAgcmV0dXJuIHdpdGhUZW1wU291cmNlRmlsZShcIi5yc1wiLCBibG9jay5jb250ZW50LCBhc3luYyAoeyB0ZW1wRGlyLCB0ZW1wRmlsZSB9KSA9PiB7XHJcbiAgICAgIGNvbnN0IGJpbmFyeVBhdGggPSBqb2luKHRlbXBEaXIsIFwic25pcHBldC5vdXRcIik7XHJcbiAgICAgIGNvbnN0IGNvbXBpbGVSZXN1bHQgPSBhd2FpdCBydW5Qcm9jZXNzKHtcclxuICAgICAgICBydW5uZXJJZDogYCR7dGhpcy5pZH06cnVzdDpjb21waWxlYCxcclxuICAgICAgICBydW5uZXJOYW1lOiBcIlJ1c3RcIixcclxuICAgICAgICBleGVjdXRhYmxlOiBzZXR0aW5ncy5ydXN0RXhlY3V0YWJsZS50cmltKCksXHJcbiAgICAgICAgYXJnczogW3RlbXBGaWxlLCBcIi1vXCIsIGJpbmFyeVBhdGhdLFxyXG4gICAgICAgIHdvcmtpbmdEaXJlY3Rvcnk6IGNvbnRleHQud29ya2luZ0RpcmVjdG9yeSxcclxuICAgICAgICB0aW1lb3V0TXM6IE1hdGgubWF4KGNvbnRleHQudGltZW91dE1zLCAzMF8wMDApLFxyXG4gICAgICAgIHNpZ25hbDogY29udGV4dC5zaWduYWwsXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgaWYgKCFjb21waWxlUmVzdWx0LnN1Y2Nlc3MpIHtcclxuICAgICAgICByZXR1cm4gY29tcGlsZVJlc3VsdDtcclxuICAgICAgfVxyXG5cclxuICAgICAgcmV0dXJuIHJ1blByb2Nlc3Moe1xyXG4gICAgICAgIHJ1bm5lcklkOiBgJHt0aGlzLmlkfTpydXN0OnJ1bmAsXHJcbiAgICAgICAgcnVubmVyTmFtZTogXCJSdXN0XCIsXHJcbiAgICAgICAgZXhlY3V0YWJsZTogYmluYXJ5UGF0aCxcclxuICAgICAgICBhcmdzOiBbXSxcclxuICAgICAgICB3b3JraW5nRGlyZWN0b3J5OiBjb250ZXh0LndvcmtpbmdEaXJlY3RvcnksXHJcbiAgICAgICAgdGltZW91dE1zOiBNYXRoLm1heChjb250ZXh0LnRpbWVvdXRNcywgMzBfMDAwKSxcclxuICAgICAgICBzaWduYWw6IGNvbnRleHQuc2lnbmFsLFxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhc3luYyBydW5KYXZhKGJsb2NrOiBsb29tQ29kZUJsb2NrLCBjb250ZXh0OiBsb29tUnVuQ29udGV4dCwgc2V0dGluZ3M6IGxvb21QbHVnaW5TZXR0aW5ncyk6IFByb21pc2U8bG9vbVJ1blJlc3VsdD4ge1xyXG4gICAgcmV0dXJuIHdpdGhOYW1lZFRlbXBTb3VyY2VGaWxlKFwiTWFpbi5qYXZhXCIsIGJsb2NrLmNvbnRlbnQsIGFzeW5jICh7IHRlbXBEaXIsIHRlbXBGaWxlIH0pID0+IHtcclxuICAgICAgaWYgKCFzZXR0aW5ncy5qYXZhQ29tcGlsZXJFeGVjdXRhYmxlLnRyaW0oKSkge1xyXG4gICAgICAgIHJldHVybiBydW5Qcm9jZXNzKHtcclxuICAgICAgICAgIHJ1bm5lcklkOiBgJHt0aGlzLmlkfTpqYXZhOnNvdXJjZWAsXHJcbiAgICAgICAgICBydW5uZXJOYW1lOiBcIkphdmFcIixcclxuICAgICAgICAgIGV4ZWN1dGFibGU6IHNldHRpbmdzLmphdmFFeGVjdXRhYmxlLnRyaW0oKSxcclxuICAgICAgICAgIGFyZ3M6IFt0ZW1wRmlsZV0sXHJcbiAgICAgICAgICB3b3JraW5nRGlyZWN0b3J5OiBjb250ZXh0LndvcmtpbmdEaXJlY3RvcnksXHJcbiAgICAgICAgICB0aW1lb3V0TXM6IE1hdGgubWF4KGNvbnRleHQudGltZW91dE1zLCAzMF8wMDApLFxyXG4gICAgICAgICAgc2lnbmFsOiBjb250ZXh0LnNpZ25hbCxcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3QgY29tcGlsZVJlc3VsdCA9IGF3YWl0IHJ1blByb2Nlc3Moe1xyXG4gICAgICAgIHJ1bm5lcklkOiBgJHt0aGlzLmlkfTpqYXZhOmNvbXBpbGVgLFxyXG4gICAgICAgIHJ1bm5lck5hbWU6IFwiSmF2YVwiLFxyXG4gICAgICAgIGV4ZWN1dGFibGU6IHNldHRpbmdzLmphdmFDb21waWxlckV4ZWN1dGFibGUudHJpbSgpLFxyXG4gICAgICAgIGFyZ3M6IFt0ZW1wRmlsZV0sXHJcbiAgICAgICAgd29ya2luZ0RpcmVjdG9yeTogdGVtcERpcixcclxuICAgICAgICB0aW1lb3V0TXM6IE1hdGgubWF4KGNvbnRleHQudGltZW91dE1zLCAzMF8wMDApLFxyXG4gICAgICAgIHNpZ25hbDogY29udGV4dC5zaWduYWwsXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgaWYgKCFjb21waWxlUmVzdWx0LnN1Y2Nlc3MpIHtcclxuICAgICAgICByZXR1cm4gY29tcGlsZVJlc3VsdDtcclxuICAgICAgfVxyXG5cclxuICAgICAgcmV0dXJuIHJ1blByb2Nlc3Moe1xyXG4gICAgICAgIHJ1bm5lcklkOiBgJHt0aGlzLmlkfTpqYXZhOnJ1bmAsXHJcbiAgICAgICAgcnVubmVyTmFtZTogXCJKYXZhXCIsXHJcbiAgICAgICAgZXhlY3V0YWJsZTogc2V0dGluZ3MuamF2YUV4ZWN1dGFibGUudHJpbSgpLFxyXG4gICAgICAgIGFyZ3M6IFtcIi1jcFwiLCB0ZW1wRGlyLCBcIk1haW5cIl0sXHJcbiAgICAgICAgd29ya2luZ0RpcmVjdG9yeTogY29udGV4dC53b3JraW5nRGlyZWN0b3J5LFxyXG4gICAgICAgIHRpbWVvdXRNczogTWF0aC5tYXgoY29udGV4dC50aW1lb3V0TXMsIDMwXzAwMCksXHJcbiAgICAgICAgc2lnbmFsOiBjb250ZXh0LnNpZ25hbCxcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcbn1cclxuIiwgImltcG9ydCB7IGpvaW4gfSBmcm9tIFwicGF0aFwiO1xyXG5pbXBvcnQgeyBydW5Qcm9jZXNzLCB3aXRoVGVtcFNvdXJjZUZpbGUgfSBmcm9tIFwiLi4vZXhlY3V0aW9uL3Byb2Nlc3NSdW5uZXJcIjtcclxuaW1wb3J0IHR5cGUgeyBsb29tQ29kZUJsb2NrLCBsb29tUGx1Z2luU2V0dGluZ3MsIGxvb21SdW5Db250ZXh0LCBsb29tUnVuUmVzdWx0LCBsb29tUnVubmVyIH0gZnJvbSBcIi4uL3R5cGVzXCI7XHJcblxyXG5leHBvcnQgY2xhc3MgTmF0aXZlQ29tcGlsZWRSdW5uZXIgaW1wbGVtZW50cyBsb29tUnVubmVyIHtcclxuICBpZCA9IFwibmF0aXZlLWNvbXBpbGVkXCI7XHJcbiAgZGlzcGxheU5hbWUgPSBcIk5hdGl2ZSBjb21waWxlclwiO1xyXG4gIGxhbmd1YWdlcyA9IFtcImNcIiwgXCJjcHBcIl0gYXMgY29uc3Q7XHJcblxyXG4gIGNhblJ1bihibG9jazogbG9vbUNvZGVCbG9jaywgc2V0dGluZ3M6IGxvb21QbHVnaW5TZXR0aW5ncyk6IGJvb2xlYW4ge1xyXG4gICAgaWYgKGJsb2NrLmxhbmd1YWdlID09PSBcImNcIikge1xyXG4gICAgICByZXR1cm4gQm9vbGVhbihzZXR0aW5ncy5jRXhlY3V0YWJsZS50cmltKCkpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChibG9jay5sYW5ndWFnZSA9PT0gXCJjcHBcIikge1xyXG4gICAgICByZXR1cm4gQm9vbGVhbihzZXR0aW5ncy5jcHBFeGVjdXRhYmxlLnRyaW0oKSk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgcnVuKGJsb2NrOiBsb29tQ29kZUJsb2NrLCBjb250ZXh0OiBsb29tUnVuQ29udGV4dCwgc2V0dGluZ3M6IGxvb21QbHVnaW5TZXR0aW5ncyk6IFByb21pc2U8bG9vbVJ1blJlc3VsdD4ge1xyXG4gICAgY29uc3QgZXhlY3V0YWJsZSA9IGJsb2NrLmxhbmd1YWdlID09PSBcImNcIiA/IHNldHRpbmdzLmNFeGVjdXRhYmxlLnRyaW0oKSA6IHNldHRpbmdzLmNwcEV4ZWN1dGFibGUudHJpbSgpO1xyXG4gICAgY29uc3QgZmlsZUV4dGVuc2lvbiA9IGJsb2NrLmxhbmd1YWdlID09PSBcImNcIiA/IFwiLmNcIiA6IFwiLmNwcFwiO1xyXG4gICAgY29uc3QgcnVubmVyTmFtZSA9IGJsb2NrLmxhbmd1YWdlID09PSBcImNcIiA/IFwiQyAoR0NDKVwiIDogXCJDKysgKEcrKylcIjtcclxuXHJcbiAgICByZXR1cm4gd2l0aFRlbXBTb3VyY2VGaWxlKGZpbGVFeHRlbnNpb24sIGJsb2NrLmNvbnRlbnQsIGFzeW5jICh7IHRlbXBEaXIsIHRlbXBGaWxlIH0pID0+IHtcclxuICAgICAgY29uc3QgYmluYXJ5UGF0aCA9IGpvaW4odGVtcERpciwgXCJzbmlwcGV0Lm91dFwiKTtcclxuICAgICAgY29uc3QgY29tcGlsZVJlc3VsdCA9IGF3YWl0IHJ1blByb2Nlc3Moe1xyXG4gICAgICAgIHJ1bm5lcklkOiBgJHt0aGlzLmlkfToke2Jsb2NrLmxhbmd1YWdlfTpjb21waWxlYCxcclxuICAgICAgICBydW5uZXJOYW1lLFxyXG4gICAgICAgIGV4ZWN1dGFibGUsXHJcbiAgICAgICAgYXJnczogW3RlbXBGaWxlLCBcIi1vXCIsIGJpbmFyeVBhdGhdLFxyXG4gICAgICAgIHdvcmtpbmdEaXJlY3Rvcnk6IGNvbnRleHQud29ya2luZ0RpcmVjdG9yeSxcclxuICAgICAgICB0aW1lb3V0TXM6IE1hdGgubWF4KGNvbnRleHQudGltZW91dE1zLCAzMF8wMDApLFxyXG4gICAgICAgIHNpZ25hbDogY29udGV4dC5zaWduYWwsXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgaWYgKCFjb21waWxlUmVzdWx0LnN1Y2Nlc3MpIHtcclxuICAgICAgICByZXR1cm4gY29tcGlsZVJlc3VsdDtcclxuICAgICAgfVxyXG5cclxuICAgICAgcmV0dXJuIHJ1blByb2Nlc3Moe1xyXG4gICAgICAgIHJ1bm5lcklkOiBgJHt0aGlzLmlkfToke2Jsb2NrLmxhbmd1YWdlfTpydW5gLFxyXG4gICAgICAgIHJ1bm5lck5hbWUsXHJcbiAgICAgICAgZXhlY3V0YWJsZTogYmluYXJ5UGF0aCxcclxuICAgICAgICBhcmdzOiBbXSxcclxuICAgICAgICB3b3JraW5nRGlyZWN0b3J5OiBjb250ZXh0LndvcmtpbmdEaXJlY3RvcnksXHJcbiAgICAgICAgdGltZW91dE1zOiBNYXRoLm1heChjb250ZXh0LnRpbWVvdXRNcywgMzBfMDAwKSxcclxuICAgICAgICBzaWduYWw6IGNvbnRleHQuc2lnbmFsLFxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG4iLCAiaW1wb3J0IHsgam9pbiB9IGZyb20gXCJwYXRoXCI7XHJcbmltcG9ydCB7IHJ1blByb2Nlc3MsIHJ1blRlbXBGaWxlUHJvY2Vzcywgd2l0aFRlbXBTb3VyY2VGaWxlIH0gZnJvbSBcIi4uL2V4ZWN1dGlvbi9wcm9jZXNzUnVubmVyXCI7XHJcbmltcG9ydCB0eXBlIHsgbG9vbUNvZGVCbG9jaywgbG9vbVBsdWdpblNldHRpbmdzLCBsb29tUnVuQ29udGV4dCwgbG9vbVJ1blJlc3VsdCwgbG9vbVJ1bm5lciB9IGZyb20gXCIuLi90eXBlc1wiO1xyXG5cclxuZXhwb3J0IGNsYXNzIE9jYW1sUnVubmVyIGltcGxlbWVudHMgbG9vbVJ1bm5lciB7XHJcbiAgaWQgPSBcIm9jYW1sXCI7XHJcbiAgZGlzcGxheU5hbWUgPSBcIk9DYW1sXCI7XHJcbiAgbGFuZ3VhZ2VzID0gW1wib2NhbWxcIl0gYXMgY29uc3Q7XHJcblxyXG4gIGNhblJ1bihibG9jazogbG9vbUNvZGVCbG9jaywgc2V0dGluZ3M6IGxvb21QbHVnaW5TZXR0aW5ncyk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIGJsb2NrLmxhbmd1YWdlID09PSBcIm9jYW1sXCIgJiYgQm9vbGVhbihzZXR0aW5ncy5vY2FtbEV4ZWN1dGFibGUudHJpbSgpKTtcclxuICB9XHJcblxyXG4gIGFzeW5jIHJ1bihibG9jazogbG9vbUNvZGVCbG9jaywgY29udGV4dDogbG9vbVJ1bkNvbnRleHQsIHNldHRpbmdzOiBsb29tUGx1Z2luU2V0dGluZ3MpOiBQcm9taXNlPGxvb21SdW5SZXN1bHQ+IHtcclxuICAgIGNvbnN0IG1vZGUgPSBzZXR0aW5ncy5vY2FtbE1vZGU7XHJcbiAgICBjb25zdCBleGVjdXRhYmxlID0gc2V0dGluZ3Mub2NhbWxFeGVjdXRhYmxlLnRyaW0oKTtcclxuXHJcbiAgICBpZiAobW9kZSA9PT0gXCJvY2FtbFwiKSB7XHJcbiAgICAgIHJldHVybiBydW5UZW1wRmlsZVByb2Nlc3Moe1xyXG4gICAgICAgIHJ1bm5lcklkOiBgJHt0aGlzLmlkfTpvY2FtbGAsXHJcbiAgICAgICAgcnVubmVyTmFtZTogXCJPQ2FtbFwiLFxyXG4gICAgICAgIGV4ZWN1dGFibGUsXHJcbiAgICAgICAgYXJnczogW1wie2ZpbGV9XCJdLFxyXG4gICAgICAgIGZpbGVFeHRlbnNpb246IFwiLm1sXCIsXHJcbiAgICAgICAgc291cmNlOiBibG9jay5jb250ZW50LFxyXG4gICAgICAgIHdvcmtpbmdEaXJlY3Rvcnk6IGNvbnRleHQud29ya2luZ0RpcmVjdG9yeSxcclxuICAgICAgICB0aW1lb3V0TXM6IGNvbnRleHQudGltZW91dE1zLFxyXG4gICAgICAgIHNpZ25hbDogY29udGV4dC5zaWduYWwsXHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChtb2RlID09PSBcImR1bmVcIikge1xyXG4gICAgICByZXR1cm4gcnVuVGVtcEZpbGVQcm9jZXNzKHtcclxuICAgICAgICBydW5uZXJJZDogYCR7dGhpcy5pZH06ZHVuZWAsXHJcbiAgICAgICAgcnVubmVyTmFtZTogXCJEdW5lIC8gT0NhbWxcIixcclxuICAgICAgICBleGVjdXRhYmxlLFxyXG4gICAgICAgIGFyZ3M6IFtcImV4ZWNcIiwgXCItLVwiLCBcIm9jYW1sXCIsIFwie2ZpbGV9XCJdLFxyXG4gICAgICAgIGZpbGVFeHRlbnNpb246IFwiLm1sXCIsXHJcbiAgICAgICAgc291cmNlOiBibG9jay5jb250ZW50LFxyXG4gICAgICAgIHdvcmtpbmdEaXJlY3Rvcnk6IGNvbnRleHQud29ya2luZ0RpcmVjdG9yeSxcclxuICAgICAgICB0aW1lb3V0TXM6IGNvbnRleHQudGltZW91dE1zLFxyXG4gICAgICAgIHNpZ25hbDogY29udGV4dC5zaWduYWwsXHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB3aXRoVGVtcFNvdXJjZUZpbGUoXCIubWxcIiwgYmxvY2suY29udGVudCwgYXN5bmMgKHsgdGVtcERpciwgdGVtcEZpbGUgfSkgPT4ge1xyXG4gICAgICBjb25zdCBiaW5hcnlQYXRoID0gam9pbih0ZW1wRGlyLCBcInNuaXBwZXQub3V0XCIpO1xyXG4gICAgICBjb25zdCBjb21waWxlUmVzdWx0ID0gYXdhaXQgcnVuUHJvY2Vzcyh7XHJcbiAgICAgICAgcnVubmVySWQ6IGAke3RoaXMuaWR9Om9jYW1sYy1jb21waWxlYCxcclxuICAgICAgICBydW5uZXJOYW1lOiBcIk9DYW1sY1wiLFxyXG4gICAgICAgIGV4ZWN1dGFibGUsXHJcbiAgICAgICAgYXJnczogW1wiLW9cIiwgYmluYXJ5UGF0aCwgdGVtcEZpbGVdLFxyXG4gICAgICAgIHdvcmtpbmdEaXJlY3Rvcnk6IGNvbnRleHQud29ya2luZ0RpcmVjdG9yeSxcclxuICAgICAgICB0aW1lb3V0TXM6IGNvbnRleHQudGltZW91dE1zLFxyXG4gICAgICAgIHNpZ25hbDogY29udGV4dC5zaWduYWwsXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgaWYgKCFjb21waWxlUmVzdWx0LnN1Y2Nlc3MpIHtcclxuICAgICAgICByZXR1cm4gY29tcGlsZVJlc3VsdDtcclxuICAgICAgfVxyXG5cclxuICAgICAgcmV0dXJuIHJ1blByb2Nlc3Moe1xyXG4gICAgICAgIHJ1bm5lcklkOiBgJHt0aGlzLmlkfTpvY2FtbGMtcnVuYCxcclxuICAgICAgICBydW5uZXJOYW1lOiBcIk9DYW1sY1wiLFxyXG4gICAgICAgIGV4ZWN1dGFibGU6IGJpbmFyeVBhdGgsXHJcbiAgICAgICAgYXJnczogW10sXHJcbiAgICAgICAgd29ya2luZ0RpcmVjdG9yeTogY29udGV4dC53b3JraW5nRGlyZWN0b3J5LFxyXG4gICAgICAgIHRpbWVvdXRNczogY29udGV4dC50aW1lb3V0TXMsXHJcbiAgICAgICAgc2lnbmFsOiBjb250ZXh0LnNpZ25hbCxcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcbn1cclxuIiwgImltcG9ydCB7IHJ1blRlbXBGaWxlUHJvY2VzcyB9IGZyb20gXCIuLi9leGVjdXRpb24vcHJvY2Vzc1J1bm5lclwiO1xyXG5pbXBvcnQgdHlwZSB7IGxvb21Db2RlQmxvY2ssIGxvb21QbHVnaW5TZXR0aW5ncywgbG9vbVJ1bkNvbnRleHQsIGxvb21SdW5SZXN1bHQsIGxvb21SdW5uZXIgfSBmcm9tIFwiLi4vdHlwZXNcIjtcclxuXHJcbmV4cG9ydCBjbGFzcyBQeXRob25SdW5uZXIgaW1wbGVtZW50cyBsb29tUnVubmVyIHtcclxuICBpZCA9IFwicHl0aG9uXCI7XHJcbiAgZGlzcGxheU5hbWUgPSBcIlB5dGhvblwiO1xyXG4gIGxhbmd1YWdlcyA9IFtcInB5dGhvblwiXSBhcyBjb25zdDtcclxuXHJcbiAgY2FuUnVuKGJsb2NrOiBsb29tQ29kZUJsb2NrLCBzZXR0aW5nczogbG9vbVBsdWdpblNldHRpbmdzKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gYmxvY2subGFuZ3VhZ2UgPT09IFwicHl0aG9uXCIgJiYgQm9vbGVhbihzZXR0aW5ncy5weXRob25FeGVjdXRhYmxlLnRyaW0oKSk7XHJcbiAgfVxyXG5cclxuICBydW4oYmxvY2s6IGxvb21Db2RlQmxvY2ssIGNvbnRleHQ6IGxvb21SdW5Db250ZXh0LCBzZXR0aW5nczogbG9vbVBsdWdpblNldHRpbmdzKTogUHJvbWlzZTxsb29tUnVuUmVzdWx0PiB7XHJcbiAgICByZXR1cm4gcnVuVGVtcEZpbGVQcm9jZXNzKHtcclxuICAgICAgcnVubmVySWQ6IHRoaXMuaWQsXHJcbiAgICAgIHJ1bm5lck5hbWU6IHRoaXMuZGlzcGxheU5hbWUsXHJcbiAgICAgIGV4ZWN1dGFibGU6IHNldHRpbmdzLnB5dGhvbkV4ZWN1dGFibGUudHJpbSgpLFxyXG4gICAgICBhcmdzOiBbXCJ7ZmlsZX1cIl0sXHJcbiAgICAgIGZpbGVFeHRlbnNpb246IFwiLnB5XCIsXHJcbiAgICAgIHNvdXJjZTogYmxvY2suY29udGVudCxcclxuICAgICAgd29ya2luZ0RpcmVjdG9yeTogY29udGV4dC53b3JraW5nRGlyZWN0b3J5LFxyXG4gICAgICB0aW1lb3V0TXM6IGNvbnRleHQudGltZW91dE1zLFxyXG4gICAgICBzaWduYWw6IGNvbnRleHQuc2lnbmFsLFxyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcbiIsICJpbXBvcnQgeyBleGlzdHNTeW5jIH0gZnJvbSBcImZzXCI7XHJcbmltcG9ydCB7IGpvaW4gfSBmcm9tIFwicGF0aFwiO1xyXG5pbXBvcnQgeyBydW5UZW1wRmlsZVByb2Nlc3MgfSBmcm9tIFwiLi4vZXhlY3V0aW9uL3Byb2Nlc3NSdW5uZXJcIjtcclxuaW1wb3J0IHR5cGUgeyBsb29tQ29kZUJsb2NrLCBsb29tUGx1Z2luU2V0dGluZ3MsIGxvb21SdW5Db250ZXh0LCBsb29tUnVuUmVzdWx0LCBsb29tUnVubmVyIH0gZnJvbSBcIi4uL3R5cGVzXCI7XHJcblxyXG5leHBvcnQgY2xhc3MgUHJvb2ZSdW5uZXIgaW1wbGVtZW50cyBsb29tUnVubmVyIHtcclxuICBpZCA9IFwicHJvb2ZcIjtcclxuICBkaXNwbGF5TmFtZSA9IFwiUHJvb2YgY2hlY2tlclwiO1xyXG4gIGxhbmd1YWdlcyA9IFtcImxlYW5cIiwgXCJjb3FcIiwgXCJzbXRsaWJcIl0gYXMgY29uc3Q7XHJcblxyXG4gIGNhblJ1bihibG9jazogbG9vbUNvZGVCbG9jaywgc2V0dGluZ3M6IGxvb21QbHVnaW5TZXR0aW5ncyk6IGJvb2xlYW4ge1xyXG4gICAgaWYgKGJsb2NrLmxhbmd1YWdlID09PSBcImxlYW5cIikge1xyXG4gICAgICByZXR1cm4gQm9vbGVhbihzZXR0aW5ncy5sZWFuRXhlY3V0YWJsZS50cmltKCkpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChibG9jay5sYW5ndWFnZSA9PT0gXCJjb3FcIikge1xyXG4gICAgICByZXR1cm4gQm9vbGVhbihyZXNvbHZlQ29xRXhlY3V0YWJsZShzZXR0aW5ncykudHJpbSgpKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoYmxvY2subGFuZ3VhZ2UgPT09IFwic210bGliXCIpIHtcclxuICAgICAgcmV0dXJuIEJvb2xlYW4oc2V0dGluZ3Muc210RXhlY3V0YWJsZS50cmltKCkpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBmYWxzZTtcclxuICB9XHJcblxyXG4gIHJ1bihibG9jazogbG9vbUNvZGVCbG9jaywgY29udGV4dDogbG9vbVJ1bkNvbnRleHQsIHNldHRpbmdzOiBsb29tUGx1Z2luU2V0dGluZ3MpOiBQcm9taXNlPGxvb21SdW5SZXN1bHQ+IHtcclxuICAgIGlmIChibG9jay5sYW5ndWFnZSA9PT0gXCJsZWFuXCIpIHtcclxuICAgICAgcmV0dXJuIHJ1blRlbXBGaWxlUHJvY2Vzcyh7XHJcbiAgICAgICAgcnVubmVySWQ6IGAke3RoaXMuaWR9OmxlYW5gLFxyXG4gICAgICAgIHJ1bm5lck5hbWU6IFwiTGVhblwiLFxyXG4gICAgICAgIGV4ZWN1dGFibGU6IHNldHRpbmdzLmxlYW5FeGVjdXRhYmxlLnRyaW0oKSxcclxuICAgICAgICBhcmdzOiBbXCJ7ZmlsZX1cIl0sXHJcbiAgICAgICAgZmlsZUV4dGVuc2lvbjogXCIubGVhblwiLFxyXG4gICAgICAgIHNvdXJjZTogYmxvY2suY29udGVudCxcclxuICAgICAgICB3b3JraW5nRGlyZWN0b3J5OiBjb250ZXh0LndvcmtpbmdEaXJlY3RvcnksXHJcbiAgICAgICAgdGltZW91dE1zOiBNYXRoLm1heChjb250ZXh0LnRpbWVvdXRNcywgMzBfMDAwKSxcclxuICAgICAgICBzaWduYWw6IGNvbnRleHQuc2lnbmFsLFxyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoYmxvY2subGFuZ3VhZ2UgPT09IFwiY29xXCIpIHtcclxuICAgICAgcmV0dXJuIHJ1blRlbXBGaWxlUHJvY2Vzcyh7XHJcbiAgICAgICAgcnVubmVySWQ6IGAke3RoaXMuaWR9OmNvcWAsXHJcbiAgICAgICAgcnVubmVyTmFtZTogXCJDb3FcIixcclxuICAgICAgICBleGVjdXRhYmxlOiByZXNvbHZlQ29xRXhlY3V0YWJsZShzZXR0aW5ncyksXHJcbiAgICAgICAgYXJnczogW1wiLXFcIiwgXCJ7ZmlsZX1cIl0sXHJcbiAgICAgICAgZmlsZUV4dGVuc2lvbjogXCIudlwiLFxyXG4gICAgICAgIHNvdXJjZTogYmxvY2suY29udGVudCxcclxuICAgICAgICB3b3JraW5nRGlyZWN0b3J5OiBjb250ZXh0LndvcmtpbmdEaXJlY3RvcnksXHJcbiAgICAgICAgdGltZW91dE1zOiBNYXRoLm1heChjb250ZXh0LnRpbWVvdXRNcywgMzBfMDAwKSxcclxuICAgICAgICBzaWduYWw6IGNvbnRleHQuc2lnbmFsLFxyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoYmxvY2subGFuZ3VhZ2UgPT09IFwic210bGliXCIpIHtcclxuICAgICAgcmV0dXJuIHJ1blRlbXBGaWxlUHJvY2Vzcyh7XHJcbiAgICAgICAgcnVubmVySWQ6IGAke3RoaXMuaWR9OnNtdGxpYmAsXHJcbiAgICAgICAgcnVubmVyTmFtZTogXCJTTVQtTElCIChaMylcIixcclxuICAgICAgICBleGVjdXRhYmxlOiBzZXR0aW5ncy5zbXRFeGVjdXRhYmxlLnRyaW0oKSxcclxuICAgICAgICBhcmdzOiBbXCJ7ZmlsZX1cIl0sXHJcbiAgICAgICAgZmlsZUV4dGVuc2lvbjogXCIuc210MlwiLFxyXG4gICAgICAgIHNvdXJjZTogYmxvY2suY29udGVudCxcclxuICAgICAgICB3b3JraW5nRGlyZWN0b3J5OiBjb250ZXh0LndvcmtpbmdEaXJlY3RvcnksXHJcbiAgICAgICAgdGltZW91dE1zOiBNYXRoLm1heChjb250ZXh0LnRpbWVvdXRNcywgMzBfMDAwKSxcclxuICAgICAgICBzaWduYWw6IGNvbnRleHQuc2lnbmFsLFxyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIHByb29mIGxhbmd1YWdlOiAke2Jsb2NrLmxhbmd1YWdlfWApO1xyXG4gIH1cclxufVxyXG5cclxuZnVuY3Rpb24gcmVzb2x2ZUNvcUV4ZWN1dGFibGUoc2V0dGluZ3M6IGxvb21QbHVnaW5TZXR0aW5ncyk6IHN0cmluZyB7XHJcbiAgY29uc3QgY29uZmlndXJlZCA9IHNldHRpbmdzLmNvcUV4ZWN1dGFibGUudHJpbSgpO1xyXG4gIGlmIChjb25maWd1cmVkICYmIGNvbmZpZ3VyZWQgIT09IFwiY29xY1wiKSB7XHJcbiAgICByZXR1cm4gY29uZmlndXJlZDtcclxuICB9XHJcblxyXG4gIGNvbnN0IG9wYW1Db3FjID0gam9pbihwcm9jZXNzLmVudi5IT01FID8/IFwiXCIsIFwiLm9wYW1cIiwgXCJkZWZhdWx0XCIsIFwiYmluXCIsIFwiY29xY1wiKTtcclxuICByZXR1cm4gZXhpc3RzU3luYyhvcGFtQ29xYykgPyBvcGFtQ29xYyA6IGNvbmZpZ3VyZWQgfHwgXCJjb3FjXCI7XHJcbn1cclxuIiwgImltcG9ydCB0eXBlIHsgbG9vbUNvZGVCbG9jaywgbG9vbVBsdWdpblNldHRpbmdzLCBsb29tUnVubmVyIH0gZnJvbSBcIi4uL3R5cGVzXCI7XHJcblxyXG5leHBvcnQgY2xhc3MgbG9vbVJ1bm5lclJlZ2lzdHJ5IHtcclxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IHJ1bm5lcnM6IGxvb21SdW5uZXJbXSkge31cclxuXHJcbiAgZ2V0UnVubmVyRm9yQmxvY2soYmxvY2s6IGxvb21Db2RlQmxvY2ssIHNldHRpbmdzOiBsb29tUGx1Z2luU2V0dGluZ3MpOiBsb29tUnVubmVyIHwgbnVsbCB7XHJcbiAgICByZXR1cm4gdGhpcy5ydW5uZXJzLmZpbmQoKHJ1bm5lcikgPT4gcnVubmVyLmxhbmd1YWdlcy5pbmNsdWRlcyhibG9jay5sYW5ndWFnZSkgJiYgcnVubmVyLmNhblJ1bihibG9jaywgc2V0dGluZ3MpKSA/PyBudWxsO1xyXG4gIH1cclxuXHJcbiAgZ2V0U3VwcG9ydGVkTGFuZ3VhZ2VzKCk6IHN0cmluZ1tdIHtcclxuICAgIHJldHVybiBbLi4ubmV3IFNldCh0aGlzLnJ1bm5lcnMuZmxhdE1hcCgocnVubmVyKSA9PiBydW5uZXIubGFuZ3VhZ2VzKSldO1xyXG4gIH1cclxufVxyXG4iLCAiaW1wb3J0IHsgTm90aWNlLCBQbHVnaW5TZXR0aW5nVGFiLCBTZXR0aW5nLCBub3JtYWxpemVQYXRoIH0gZnJvbSBcIm9ic2lkaWFuXCI7XHJcbmltcG9ydCB0eXBlIGxvb21QbHVnaW4gZnJvbSBcIi4vbWFpblwiO1xyXG5pbXBvcnQgdHlwZSB7IGxvb21QbHVnaW5TZXR0aW5ncyB9IGZyb20gXCIuL3R5cGVzXCI7XHJcblxyXG5leHBvcnQgY29uc3QgREVGQVVMVF9TRVRUSU5HUzogbG9vbVBsdWdpblNldHRpbmdzID0ge1xyXG4gIGVuYWJsZUxvY2FsRXhlY3V0aW9uOiBmYWxzZSxcclxuICBoYXNBY2tub3dsZWRnZWRFeGVjdXRpb25SaXNrOiBmYWxzZSxcclxuICBwcmVzZXJ2ZVNvdXJjZU1vZGU6IHRydWUsXHJcbiAgZGVmYXVsdFRpbWVvdXRNczogODAwMCxcclxuICB3b3JraW5nRGlyZWN0b3J5OiBcIlwiLFxyXG4gIHB5dGhvbkV4ZWN1dGFibGU6IFwicHl0aG9uM1wiLFxyXG4gIG5vZGVFeGVjdXRhYmxlOiBcIm5vZGVcIixcclxuICB0eXBlc2NyaXB0TW9kZTogXCJ0cy1ub2RlXCIsXHJcbiAgdHlwZXNjcmlwdFRyYW5zcGlsZXJFeGVjdXRhYmxlOiBcInRzLW5vZGVcIixcclxuICBvY2FtbE1vZGU6IFwib2NhbWxcIixcclxuICBvY2FtbEV4ZWN1dGFibGU6IFwib2NhbWxcIixcclxuICBjRXhlY3V0YWJsZTogXCJnY2NcIixcclxuICBjcHBFeGVjdXRhYmxlOiBcImcrK1wiLFxyXG4gIHNoZWxsRXhlY3V0YWJsZTogXCJiYXNoXCIsXHJcbiAgcnVieUV4ZWN1dGFibGU6IFwicnVieVwiLFxyXG4gIHBlcmxFeGVjdXRhYmxlOiBcInBlcmxcIixcclxuICBsdWFFeGVjdXRhYmxlOiBcImx1YVwiLFxyXG4gIHBocEV4ZWN1dGFibGU6IFwicGhwXCIsXHJcbiAgZ29FeGVjdXRhYmxlOiBcImdvXCIsXHJcbiAgcnVzdEV4ZWN1dGFibGU6IFwicnVzdGNcIixcclxuICBqYXZhQ29tcGlsZXJFeGVjdXRhYmxlOiBcIlwiLFxyXG4gIGphdmFFeGVjdXRhYmxlOiBcImphdmFcIixcclxuICBsbHZtSW50ZXJwcmV0ZXJFeGVjdXRhYmxlOiBcImxsaVwiLFxyXG4gIGxlYW5FeGVjdXRhYmxlOiBcImxlYW5cIixcclxuICBjb3FFeGVjdXRhYmxlOiBcImNvcWNcIixcclxuICBzbXRFeGVjdXRhYmxlOiBcInozXCIsXHJcbiAgd3JpdGVPdXRwdXRUb05vdGU6IGZhbHNlLFxyXG4gIGF1dG9SdW5PbkZpbGVPcGVuOiBmYWxzZSxcclxufTtcclxuXHJcbmV4cG9ydCBjbGFzcyBsb29tU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xyXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgbG9vbVBsdWdpbjogbG9vbVBsdWdpbikge1xyXG4gICAgc3VwZXIobG9vbVBsdWdpbi5hcHAsIGxvb21QbHVnaW4pO1xyXG4gIH1cclxuXHJcbiAgZGlzcGxheSgpOiB2b2lkIHtcclxuICAgIGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XHJcbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xyXG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJoMlwiLCB7IHRleHQ6IFwibG9vbVwiIH0pO1xyXG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJwXCIsIHsgdGV4dDogXCJSdW4gc3VwcG9ydGVkIGNvZGUgZmVuY2VzIGRpcmVjdGx5IGZyb20gbm90ZXMgd2hpbGUgcHJlc2VydmluZyBuYXRpdmUgc3ludGF4IGhpZ2hsaWdodGluZy5cIiB9KTtcclxuXHJcbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcImgzXCIsIHsgdGV4dDogXCJFeGVjdXRpb25cIiB9KTtcclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIkVuYWJsZSBsb2NhbCBleGVjdXRpb25cIilcclxuICAgICAgLnNldERlc2MoXCJEaXNhYmxlZCBieSBkZWZhdWx0LiBsb29tIHJ1bnMgY29kZSBvbiB5b3VyIGxvY2FsIG1hY2hpbmUgYW5kIGRvZXMgbm90IHByb3ZpZGUgc2FuZGJveGluZy5cIilcclxuICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxyXG4gICAgICAgIHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLmxvb21QbHVnaW4uc2V0dGluZ3MuZW5hYmxlTG9jYWxFeGVjdXRpb24pLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgdGhpcy5sb29tUGx1Z2luLnNldHRpbmdzLmVuYWJsZUxvY2FsRXhlY3V0aW9uID0gdmFsdWU7XHJcbiAgICAgICAgICBpZiAodmFsdWUpIHtcclxuICAgICAgICAgICAgdGhpcy5sb29tUGx1Z2luLnNldHRpbmdzLmhhc0Fja25vd2xlZGdlZEV4ZWN1dGlvblJpc2sgPSB0cnVlO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgYXdhaXQgdGhpcy5sb29tUGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgIH0pLFxyXG4gICAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIktlZXAgbG9vbSBub3RlcyBpbiBzb3VyY2UgbW9kZVwiKVxyXG4gICAgICAuc2V0RGVzYyhcIlByZXNlcnZlIHJhdyBmZW5jZWQgY29kZSBpbiB0aGUgZWRpdG9yIGluc3RlYWQgb2YgbGV0dGluZyBsaXZlIHByZXZpZXcgY29sbGFwc2UgcmVzZWFyY2ggc25pcHBldHMuXCIpXHJcbiAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cclxuICAgICAgICB0b2dnbGUuc2V0VmFsdWUodGhpcy5sb29tUGx1Z2luLnNldHRpbmdzLnByZXNlcnZlU291cmNlTW9kZSkub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICB0aGlzLmxvb21QbHVnaW4uc2V0dGluZ3MucHJlc2VydmVTb3VyY2VNb2RlID0gdmFsdWU7XHJcbiAgICAgICAgICBhd2FpdCB0aGlzLmxvb21QbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICB2b2lkIHRoaXMubG9vbVBsdWdpbi5lbmZvcmNlU291cmNlTW9kZUZvckFjdGl2ZVZpZXcoKTtcclxuICAgICAgICB9KSxcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJEZWZhdWx0IHRpbWVvdXRcIilcclxuICAgICAgLnNldERlc2MoXCJNYXhpbXVtIGV4ZWN1dGlvbiB0aW1lIGluIG1pbGxpc2Vjb25kcyBiZWZvcmUgbG9vbSB0ZXJtaW5hdGVzIHRoZSBwcm9jZXNzLlwiKVxyXG4gICAgICAuYWRkVGV4dCgodGV4dCkgPT5cclxuICAgICAgICB0ZXh0LnNldFBsYWNlaG9sZGVyKFwiODAwMFwiKS5zZXRWYWx1ZShTdHJpbmcodGhpcy5sb29tUGx1Z2luLnNldHRpbmdzLmRlZmF1bHRUaW1lb3V0TXMpKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgIGNvbnN0IHBhcnNlZCA9IE51bWJlci5wYXJzZUludCh2YWx1ZSwgMTApO1xyXG4gICAgICAgICAgaWYgKCFOdW1iZXIuaXNOYU4ocGFyc2VkKSAmJiBwYXJzZWQgPiAwKSB7XHJcbiAgICAgICAgICAgIHRoaXMubG9vbVBsdWdpbi5zZXR0aW5ncy5kZWZhdWx0VGltZW91dE1zID0gcGFyc2VkO1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLmxvb21QbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSksXHJcbiAgICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiV29ya2luZyBkaXJlY3RvcnlcIilcclxuICAgICAgLnNldERlc2MoXCJPcHRpb25hbC4gRW1wdHkgdXNlcyB0aGUgY3VycmVudCBub3RlIGZvbGRlciB3aGVuIHBvc3NpYmxlLCBvdGhlcndpc2UgdGhlIHZhdWx0IHJvb3QuXCIpXHJcbiAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxyXG4gICAgICAgIHRleHQuc2V0UGxhY2Vob2xkZXIoXCJWYXVsdCByb290XCIpLnNldFZhbHVlKHRoaXMubG9vbVBsdWdpbi5zZXR0aW5ncy53b3JraW5nRGlyZWN0b3J5KS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgIHRoaXMubG9vbVBsdWdpbi5zZXR0aW5ncy53b3JraW5nRGlyZWN0b3J5ID0gdmFsdWUudHJpbSgpID8gbm9ybWFsaXplUGF0aCh2YWx1ZS50cmltKCkpIDogXCJcIjtcclxuICAgICAgICAgIGF3YWl0IHRoaXMubG9vbVBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICB9KSxcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJXcml0ZSBvdXRwdXQgYmFjayB0byBub3RlXCIpXHJcbiAgICAgIC5zZXREZXNjKFwiSW5zZXJ0IG1hbmFnZWQgbG9vbSBvdXRwdXQgc2VjdGlvbnMgYmVuZWF0aCBjb2RlIGJsb2NrcyBpbnN0ZWFkIG9mIGtlZXBpbmcgcmVzdWx0cyBwdXJlbHkgaW4gdGhlIFVJLlwiKVxyXG4gICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+XHJcbiAgICAgICAgdG9nZ2xlLnNldFZhbHVlKHRoaXMubG9vbVBsdWdpbi5zZXR0aW5ncy53cml0ZU91dHB1dFRvTm90ZSkub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICB0aGlzLmxvb21QbHVnaW4uc2V0dGluZ3Mud3JpdGVPdXRwdXRUb05vdGUgPSB2YWx1ZTtcclxuICAgICAgICAgIGF3YWl0IHRoaXMubG9vbVBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICB9KSxcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJBdXRvLXJ1biBvbiBmaWxlIG9wZW5cIilcclxuICAgICAgLnNldERlc2MoXCJSdW4gYWxsIHN1cHBvcnRlZCBibG9ja3MgaW4gdGhlIGFjdGl2ZSBub3RlIHdoZW4gaXQgb3BlbnMuIERpc2FibGVkIGJ5IGRlZmF1bHQuXCIpXHJcbiAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cclxuICAgICAgICB0b2dnbGUuc2V0VmFsdWUodGhpcy5sb29tUGx1Z2luLnNldHRpbmdzLmF1dG9SdW5PbkZpbGVPcGVuKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgIHRoaXMubG9vbVBsdWdpbi5zZXR0aW5ncy5hdXRvUnVuT25GaWxlT3BlbiA9IHZhbHVlO1xyXG4gICAgICAgICAgYXdhaXQgdGhpcy5sb29tUGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgIH0pLFxyXG4gICAgICApO1xyXG5cclxuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDNcIiwgeyB0ZXh0OiBcIlJ1bnRpbWVzXCIgfSk7XHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJQeXRob24gZXhlY3V0YWJsZVwiKVxyXG4gICAgICAuc2V0RGVzYyhcIlBhdGggb3IgY29tbWFuZCBuYW1lIGZvciBQeXRob24uXCIpXHJcbiAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxyXG4gICAgICAgIHRleHQuc2V0VmFsdWUodGhpcy5sb29tUGx1Z2luLnNldHRpbmdzLnB5dGhvbkV4ZWN1dGFibGUpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgdGhpcy5sb29tUGx1Z2luLnNldHRpbmdzLnB5dGhvbkV4ZWN1dGFibGUgPSB2YWx1ZS50cmltKCk7XHJcbiAgICAgICAgICBhd2FpdCB0aGlzLmxvb21QbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgfSksXHJcbiAgICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiTm9kZSBleGVjdXRhYmxlXCIpXHJcbiAgICAgIC5zZXREZXNjKFwiUGF0aCBvciBjb21tYW5kIG5hbWUgZm9yIEphdmFTY3JpcHQgZXhlY3V0aW9uLlwiKVxyXG4gICAgICAuYWRkVGV4dCgodGV4dCkgPT5cclxuICAgICAgICB0ZXh0LnNldFZhbHVlKHRoaXMubG9vbVBsdWdpbi5zZXR0aW5ncy5ub2RlRXhlY3V0YWJsZSkub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICB0aGlzLmxvb21QbHVnaW4uc2V0dGluZ3Mubm9kZUV4ZWN1dGFibGUgPSB2YWx1ZS50cmltKCk7XHJcbiAgICAgICAgICBhd2FpdCB0aGlzLmxvb21QbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgfSksXHJcbiAgICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiVHlwZVNjcmlwdCBydW5uZXIgbW9kZVwiKVxyXG4gICAgICAuc2V0RGVzYyhcIlVzZSB0cy1ub2RlIG9yIHRzeCBmb3IgVHlwZVNjcmlwdCBibG9ja3MuXCIpXHJcbiAgICAgIC5hZGREcm9wZG93bigoZHJvcGRvd24pID0+XHJcbiAgICAgICAgZHJvcGRvd25cclxuICAgICAgICAgIC5hZGRPcHRpb24oXCJ0cy1ub2RlXCIsIFwidHMtbm9kZVwiKVxyXG4gICAgICAgICAgLmFkZE9wdGlvbihcInRzeFwiLCBcInRzeFwiKVxyXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMubG9vbVBsdWdpbi5zZXR0aW5ncy50eXBlc2NyaXB0TW9kZSlcclxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5sb29tUGx1Z2luLnNldHRpbmdzLnR5cGVzY3JpcHRNb2RlID0gdmFsdWUgYXMgXCJ0cy1ub2RlXCIgfCBcInRzeFwiO1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLmxvb21QbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICB9KSxcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJUeXBlU2NyaXB0IHRyYW5zcGlsZXIgZXhlY3V0YWJsZVwiKVxyXG4gICAgICAuc2V0RGVzYyhcIkNvbW1hbmQgb3IgcGF0aCBmb3IgdHMtbm9kZSBvciB0c3guXCIpXHJcbiAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxyXG4gICAgICAgIHRleHQuc2V0VmFsdWUodGhpcy5sb29tUGx1Z2luLnNldHRpbmdzLnR5cGVzY3JpcHRUcmFuc3BpbGVyRXhlY3V0YWJsZSkub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICB0aGlzLmxvb21QbHVnaW4uc2V0dGluZ3MudHlwZXNjcmlwdFRyYW5zcGlsZXJFeGVjdXRhYmxlID0gdmFsdWUudHJpbSgpO1xyXG4gICAgICAgICAgYXdhaXQgdGhpcy5sb29tUGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgIH0pLFxyXG4gICAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIk9DYW1sIG1vZGVcIilcclxuICAgICAgLnNldERlc2MoXCJDaG9vc2UgYmV0d2VlbiB0aGUgT0NhbWwgdG9wbGV2ZWwsIG9jYW1sYyBjb21waWxhdGlvbiwgb3IgZHVuZSBleGVjLlwiKVxyXG4gICAgICAuYWRkRHJvcGRvd24oKGRyb3Bkb3duKSA9PlxyXG4gICAgICAgIGRyb3Bkb3duXHJcbiAgICAgICAgICAuYWRkT3B0aW9uKFwib2NhbWxcIiwgXCJvY2FtbFwiKVxyXG4gICAgICAgICAgLmFkZE9wdGlvbihcIm9jYW1sY1wiLCBcIm9jYW1sY1wiKVxyXG4gICAgICAgICAgLmFkZE9wdGlvbihcImR1bmVcIiwgXCJkdW5lXCIpXHJcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5sb29tUGx1Z2luLnNldHRpbmdzLm9jYW1sTW9kZSlcclxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5sb29tUGx1Z2luLnNldHRpbmdzLm9jYW1sTW9kZSA9IHZhbHVlIGFzIFwib2NhbWxcIiB8IFwib2NhbWxjXCIgfCBcImR1bmVcIjtcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy5sb29tUGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgfSksXHJcbiAgICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiT0NhbWwgZXhlY3V0YWJsZVwiKVxyXG4gICAgICAuc2V0RGVzYyhcIkNvbW1hbmQgb3IgcGF0aCBmb3Igb2NhbWwsIG9jYW1sYywgb3IgZHVuZSBkZXBlbmRpbmcgb24gdGhlIHNlbGVjdGVkIG1vZGUuXCIpXHJcbiAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxyXG4gICAgICAgIHRleHQuc2V0VmFsdWUodGhpcy5sb29tUGx1Z2luLnNldHRpbmdzLm9jYW1sRXhlY3V0YWJsZSkub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICB0aGlzLmxvb21QbHVnaW4uc2V0dGluZ3Mub2NhbWxFeGVjdXRhYmxlID0gdmFsdWUudHJpbSgpO1xyXG4gICAgICAgICAgYXdhaXQgdGhpcy5sb29tUGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgIH0pLFxyXG4gICAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIkMgY29tcGlsZXJcIilcclxuICAgICAgLnNldERlc2MoXCJDb21tYW5kIG9yIHBhdGggZm9yIGNvbXBpbGluZyBDIGJsb2Nrcy5cIilcclxuICAgICAgLmFkZFRleHQoKHRleHQpID0+XHJcbiAgICAgICAgdGV4dC5zZXRWYWx1ZSh0aGlzLmxvb21QbHVnaW4uc2V0dGluZ3MuY0V4ZWN1dGFibGUpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgdGhpcy5sb29tUGx1Z2luLnNldHRpbmdzLmNFeGVjdXRhYmxlID0gdmFsdWUudHJpbSgpO1xyXG4gICAgICAgICAgYXdhaXQgdGhpcy5sb29tUGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgIH0pLFxyXG4gICAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIkMrKyBjb21waWxlclwiKVxyXG4gICAgICAuc2V0RGVzYyhcIkNvbW1hbmQgb3IgcGF0aCBmb3IgY29tcGlsaW5nIEMrKyBibG9ja3MuXCIpXHJcbiAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxyXG4gICAgICAgIHRleHQuc2V0VmFsdWUodGhpcy5sb29tUGx1Z2luLnNldHRpbmdzLmNwcEV4ZWN1dGFibGUpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgdGhpcy5sb29tUGx1Z2luLnNldHRpbmdzLmNwcEV4ZWN1dGFibGUgPSB2YWx1ZS50cmltKCk7XHJcbiAgICAgICAgICBhd2FpdCB0aGlzLmxvb21QbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgfSksXHJcbiAgICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiU2hlbGwgZXhlY3V0YWJsZVwiKVxyXG4gICAgICAuc2V0RGVzYyhcIkNvbW1hbmQgb3IgcGF0aCBmb3IgU2hlbGwsIEJhc2gsIGFuZCBzaCBibG9ja3MuXCIpXHJcbiAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxyXG4gICAgICAgIHRleHQuc2V0VmFsdWUodGhpcy5sb29tUGx1Z2luLnNldHRpbmdzLnNoZWxsRXhlY3V0YWJsZSkub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICB0aGlzLmxvb21QbHVnaW4uc2V0dGluZ3Muc2hlbGxFeGVjdXRhYmxlID0gdmFsdWUudHJpbSgpO1xyXG4gICAgICAgICAgYXdhaXQgdGhpcy5sb29tUGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgIH0pLFxyXG4gICAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIlJ1YnkgZXhlY3V0YWJsZVwiKVxyXG4gICAgICAuc2V0RGVzYyhcIkNvbW1hbmQgb3IgcGF0aCBmb3IgUnVieSBibG9ja3MuXCIpXHJcbiAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxyXG4gICAgICAgIHRleHQuc2V0VmFsdWUodGhpcy5sb29tUGx1Z2luLnNldHRpbmdzLnJ1YnlFeGVjdXRhYmxlKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgIHRoaXMubG9vbVBsdWdpbi5zZXR0aW5ncy5ydWJ5RXhlY3V0YWJsZSA9IHZhbHVlLnRyaW0oKTtcclxuICAgICAgICAgIGF3YWl0IHRoaXMubG9vbVBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICB9KSxcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJQZXJsIGV4ZWN1dGFibGVcIilcclxuICAgICAgLnNldERlc2MoXCJDb21tYW5kIG9yIHBhdGggZm9yIFBlcmwgYmxvY2tzLlwiKVxyXG4gICAgICAuYWRkVGV4dCgodGV4dCkgPT5cclxuICAgICAgICB0ZXh0LnNldFZhbHVlKHRoaXMubG9vbVBsdWdpbi5zZXR0aW5ncy5wZXJsRXhlY3V0YWJsZSkub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICB0aGlzLmxvb21QbHVnaW4uc2V0dGluZ3MucGVybEV4ZWN1dGFibGUgPSB2YWx1ZS50cmltKCk7XHJcbiAgICAgICAgICBhd2FpdCB0aGlzLmxvb21QbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgfSksXHJcbiAgICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiTHVhIGV4ZWN1dGFibGVcIilcclxuICAgICAgLnNldERlc2MoXCJDb21tYW5kIG9yIHBhdGggZm9yIEx1YSBibG9ja3MuXCIpXHJcbiAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxyXG4gICAgICAgIHRleHQuc2V0VmFsdWUodGhpcy5sb29tUGx1Z2luLnNldHRpbmdzLmx1YUV4ZWN1dGFibGUpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgdGhpcy5sb29tUGx1Z2luLnNldHRpbmdzLmx1YUV4ZWN1dGFibGUgPSB2YWx1ZS50cmltKCk7XHJcbiAgICAgICAgICBhd2FpdCB0aGlzLmxvb21QbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgfSksXHJcbiAgICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiUEhQIGV4ZWN1dGFibGVcIilcclxuICAgICAgLnNldERlc2MoXCJDb21tYW5kIG9yIHBhdGggZm9yIFBIUCBibG9ja3MuXCIpXHJcbiAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxyXG4gICAgICAgIHRleHQuc2V0VmFsdWUodGhpcy5sb29tUGx1Z2luLnNldHRpbmdzLnBocEV4ZWN1dGFibGUpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgdGhpcy5sb29tUGx1Z2luLnNldHRpbmdzLnBocEV4ZWN1dGFibGUgPSB2YWx1ZS50cmltKCk7XHJcbiAgICAgICAgICBhd2FpdCB0aGlzLmxvb21QbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgfSksXHJcbiAgICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiR28gZXhlY3V0YWJsZVwiKVxyXG4gICAgICAuc2V0RGVzYyhcIkNvbW1hbmQgb3IgcGF0aCBmb3IgR28gYmxvY2tzLlwiKVxyXG4gICAgICAuYWRkVGV4dCgodGV4dCkgPT5cclxuICAgICAgICB0ZXh0LnNldFZhbHVlKHRoaXMubG9vbVBsdWdpbi5zZXR0aW5ncy5nb0V4ZWN1dGFibGUpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgdGhpcy5sb29tUGx1Z2luLnNldHRpbmdzLmdvRXhlY3V0YWJsZSA9IHZhbHVlLnRyaW0oKTtcclxuICAgICAgICAgIGF3YWl0IHRoaXMubG9vbVBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICB9KSxcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJSdXN0IGNvbXBpbGVyXCIpXHJcbiAgICAgIC5zZXREZXNjKFwiQ29tbWFuZCBvciBwYXRoIGZvciBjb21waWxpbmcgUnVzdCBibG9ja3MuXCIpXHJcbiAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxyXG4gICAgICAgIHRleHQuc2V0VmFsdWUodGhpcy5sb29tUGx1Z2luLnNldHRpbmdzLnJ1c3RFeGVjdXRhYmxlKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgIHRoaXMubG9vbVBsdWdpbi5zZXR0aW5ncy5ydXN0RXhlY3V0YWJsZSA9IHZhbHVlLnRyaW0oKTtcclxuICAgICAgICAgIGF3YWl0IHRoaXMubG9vbVBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICB9KSxcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJKYXZhIGNvbXBpbGVyXCIpXHJcbiAgICAgIC5zZXREZXNjKFwiT3B0aW9uYWwgY29tbWFuZCBvciBwYXRoIGZvciBqYXZhYy4gTGVhdmUgZW1wdHkgdG8gdXNlIEphdmEgc291cmNlLWZpbGUgbW9kZS5cIilcclxuICAgICAgLmFkZFRleHQoKHRleHQpID0+XHJcbiAgICAgICAgdGV4dC5zZXRWYWx1ZSh0aGlzLmxvb21QbHVnaW4uc2V0dGluZ3MuamF2YUNvbXBpbGVyRXhlY3V0YWJsZSkub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICB0aGlzLmxvb21QbHVnaW4uc2V0dGluZ3MuamF2YUNvbXBpbGVyRXhlY3V0YWJsZSA9IHZhbHVlLnRyaW0oKTtcclxuICAgICAgICAgIGF3YWl0IHRoaXMubG9vbVBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICB9KSxcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJMTFZNIElSIGludGVycHJldGVyXCIpXHJcbiAgICAgIC5zZXREZXNjKFwiQ29tbWFuZCBvciBwYXRoIGZvciBydW5uaW5nIExMVk0gSVIgYmxvY2tzIHdpdGggbGxpLlwiKVxyXG4gICAgICAuYWRkVGV4dCgodGV4dCkgPT5cclxuICAgICAgICB0ZXh0LnNldFZhbHVlKHRoaXMubG9vbVBsdWdpbi5zZXR0aW5ncy5sbHZtSW50ZXJwcmV0ZXJFeGVjdXRhYmxlKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgIHRoaXMubG9vbVBsdWdpbi5zZXR0aW5ncy5sbHZtSW50ZXJwcmV0ZXJFeGVjdXRhYmxlID0gdmFsdWUudHJpbSgpO1xyXG4gICAgICAgICAgYXdhaXQgdGhpcy5sb29tUGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgIH0pLFxyXG4gICAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIkxlYW4gZXhlY3V0YWJsZVwiKVxyXG4gICAgICAuc2V0RGVzYyhcIkNvbW1hbmQgb3IgcGF0aCBmb3IgY2hlY2tpbmcgTGVhbiBibG9ja3MuXCIpXHJcbiAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxyXG4gICAgICAgIHRleHQuc2V0VmFsdWUodGhpcy5sb29tUGx1Z2luLnNldHRpbmdzLmxlYW5FeGVjdXRhYmxlKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgIHRoaXMubG9vbVBsdWdpbi5zZXR0aW5ncy5sZWFuRXhlY3V0YWJsZSA9IHZhbHVlLnRyaW0oKTtcclxuICAgICAgICAgIGF3YWl0IHRoaXMubG9vbVBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICB9KSxcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJDb3EgZXhlY3V0YWJsZVwiKVxyXG4gICAgICAuc2V0RGVzYyhcIkNvbW1hbmQgb3IgcGF0aCBmb3IgY2hlY2tpbmcgQ29xIGJsb2NrcyB3aXRoIGNvcWMuXCIpXHJcbiAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxyXG4gICAgICAgIHRleHQuc2V0VmFsdWUodGhpcy5sb29tUGx1Z2luLnNldHRpbmdzLmNvcUV4ZWN1dGFibGUpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgdGhpcy5sb29tUGx1Z2luLnNldHRpbmdzLmNvcUV4ZWN1dGFibGUgPSB2YWx1ZS50cmltKCk7XHJcbiAgICAgICAgICBhd2FpdCB0aGlzLmxvb21QbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgfSksXHJcbiAgICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiU01UIHNvbHZlclwiKVxyXG4gICAgICAuc2V0RGVzYyhcIkNvbW1hbmQgb3IgcGF0aCBmb3IgU01ULUxJQiBibG9ja3MuIERlZmF1bHRzIHRvIHozLlwiKVxyXG4gICAgICAuYWRkVGV4dCgodGV4dCkgPT5cclxuICAgICAgICB0ZXh0LnNldFZhbHVlKHRoaXMubG9vbVBsdWdpbi5zZXR0aW5ncy5zbXRFeGVjdXRhYmxlKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgIHRoaXMubG9vbVBsdWdpbi5zZXR0aW5ncy5zbXRFeGVjdXRhYmxlID0gdmFsdWUudHJpbSgpO1xyXG4gICAgICAgICAgYXdhaXQgdGhpcy5sb29tUGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgIH0pLFxyXG4gICAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIkphdmEgZXhlY3V0YWJsZVwiKVxyXG4gICAgICAuc2V0RGVzYyhcIkNvbW1hbmQgb3IgcGF0aCBmb3IgcnVubmluZyBjb21waWxlZCBKYXZhIGJsb2Nrcy5cIilcclxuICAgICAgLmFkZFRleHQoKHRleHQpID0+XHJcbiAgICAgICAgdGV4dC5zZXRWYWx1ZSh0aGlzLmxvb21QbHVnaW4uc2V0dGluZ3MuamF2YUV4ZWN1dGFibGUpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgdGhpcy5sb29tUGx1Z2luLnNldHRpbmdzLmphdmFFeGVjdXRhYmxlID0gdmFsdWUudHJpbSgpO1xyXG4gICAgICAgICAgYXdhaXQgdGhpcy5sb29tUGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgIH0pLFxyXG4gICAgICApO1xyXG5cclxuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwicFwiLCB7XHJcbiAgICAgIHRleHQ6IFwiTWlzc2luZyBydW50aW1lIGV4ZWN1dGFibGVzIHdpbGwgc3VyZmFjZSBhcyBydW4gZXJyb3JzLiBsb29tIG5ldmVyIGNsYWltcyBzYW5kYm94aW5nIGFuZCBleGVjdXRlcyBjb2RlIHdpdGggeW91ciBjb25maWd1cmVkIGNvbW1hbmRzLlwiLFxyXG4gICAgICBjbHM6IFwic2V0dGluZy1pdGVtLWRlc2NyaXB0aW9uXCIsXHJcbiAgICB9KTtcclxuICB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBzaG93RXhlY3V0aW9uRGlzYWJsZWROb3RpY2UoKTogdm9pZCB7XHJcbiAgbmV3IE5vdGljZShcImxvb20gbG9jYWwgZXhlY3V0aW9uIGlzIGRpc2FibGVkLiBFbmFibGUgaXQgaW4gc2V0dGluZ3Mgb3IgY29uZmlybSB0aGUgZXhlY3V0aW9uIHdhcm5pbmcgZmlyc3QuXCIpO1xyXG59XHJcbiIsICJpbXBvcnQgeyBzZXRJY29uIH0gZnJvbSBcIm9ic2lkaWFuXCI7XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIGxvb21Ub29sYmFySGFuZGxlcnMge1xyXG4gIG9uUnVuOiAoKSA9PiB2b2lkO1xyXG4gIG9uQ29weTogKCkgPT4gdm9pZDtcclxuICBvbkNsZWFyOiAoKSA9PiB2b2lkO1xyXG4gIG9uVG9nZ2xlT3V0cHV0OiAoKSA9PiB2b2lkO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ29kZUJsb2NrVG9vbGJhcihcclxuICBibG9ja0lkOiBzdHJpbmcsXHJcbiAgaXNSdW5uaW5nOiBib29sZWFuLFxyXG4gIGhhbmRsZXJzOiBsb29tVG9vbGJhckhhbmRsZXJzLFxyXG4pOiBIVE1MRGl2RWxlbWVudCB7XHJcbiAgY29uc3QgdG9vbGJhciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgdG9vbGJhci5jbGFzc05hbWUgPSBcImxvb20tY29kZS10b29sYmFyXCI7XHJcbiAgdG9vbGJhci5kYXRhc2V0Lmxvb21CbG9ja0lkID0gYmxvY2tJZDtcclxuXHJcbiAgdG9vbGJhci5hcHBlbmRDaGlsZChjcmVhdGVCdXR0b24oXCJSdW4gYmxvY2tcIiwgaXNSdW5uaW5nID8gXCJsb2FkZXItY2lyY2xlXCIgOiBcInBsYXlcIiwgaGFuZGxlcnMub25SdW4sIGlzUnVubmluZykpO1xyXG4gIHRvb2xiYXIuYXBwZW5kQ2hpbGQoY3JlYXRlQnV0dG9uKFwiQ29weSBjb2RlXCIsIFwiY29weVwiLCBoYW5kbGVycy5vbkNvcHksIGZhbHNlKSk7XHJcbiAgdG9vbGJhci5hcHBlbmRDaGlsZChjcmVhdGVCdXR0b24oXCJDbGVhciBvdXRwdXRcIiwgXCJ0cmFzaC0yXCIsIGhhbmRsZXJzLm9uQ2xlYXIsIGZhbHNlKSk7XHJcbiAgdG9vbGJhci5hcHBlbmRDaGlsZChjcmVhdGVCdXR0b24oXCJUb2dnbGUgb3V0cHV0XCIsIFwicGFuZWwtYm90dG9tLW9wZW5cIiwgaGFuZGxlcnMub25Ub2dnbGVPdXRwdXQsIGZhbHNlKSk7XHJcblxyXG4gIHJldHVybiB0b29sYmFyO1xyXG59XHJcblxyXG5mdW5jdGlvbiBjcmVhdGVCdXR0b24obGFiZWw6IHN0cmluZywgaWNvbk5hbWU6IHN0cmluZywgb25DbGljazogKCkgPT4gdm9pZCwgc3Bpbm5pbmc6IGJvb2xlYW4pOiBIVE1MQnV0dG9uRWxlbWVudCB7XHJcbiAgY29uc3QgYnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImJ1dHRvblwiKTtcclxuICBidXR0b24uY2xhc3NOYW1lID0gYGxvb20tdG9vbGJhci1idXR0b24ke3NwaW5uaW5nID8gXCIgaXMtcnVubmluZ1wiIDogXCJcIn1gO1xyXG4gIGJ1dHRvbi50eXBlID0gXCJidXR0b25cIjtcclxuICBidXR0b24uc2V0QXR0cmlidXRlKFwiYXJpYS1sYWJlbFwiLCBsYWJlbCk7XHJcbiAgYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZXZlbnQpID0+IHtcclxuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgIG9uQ2xpY2soKTtcclxuICB9KTtcclxuICBzZXRJY29uKGJ1dHRvbiwgaWNvbk5hbWUpO1xyXG4gIHJldHVybiBidXR0b247XHJcbn1cclxuIiwgImltcG9ydCB7IHNldEljb24gfSBmcm9tIFwib2JzaWRpYW5cIjtcclxuaW1wb3J0IHR5cGUgeyBsb29tU3RvcmVkT3V0cHV0IH0gZnJvbSBcIi4uL3R5cGVzXCI7XHJcblxyXG5mdW5jdGlvbiBnZXRTdGF0dXNLaW5kKG91dHB1dDogbG9vbVN0b3JlZE91dHB1dCk6IFwic3VjY2Vzc1wiIHwgXCJ3YXJuaW5nXCIgfCBcImZhaWx1cmVcIiB7XHJcbiAgaWYgKG91dHB1dC5yZXN1bHQuc3VjY2Vzcykge1xyXG4gICAgcmV0dXJuIG91dHB1dC5yZXN1bHQuc3RkZXJyLnRyaW0oKSA/IFwid2FybmluZ1wiIDogXCJzdWNjZXNzXCI7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gXCJmYWlsdXJlXCI7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVPdXRwdXRQYW5lbChvdXRwdXQ6IGxvb21TdG9yZWRPdXRwdXQpOiBIVE1MRGl2RWxlbWVudCB7XHJcbiAgY29uc3QgcGFuZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gIHBhbmVsLmNsYXNzTmFtZSA9IGBsb29tLW91dHB1dC1wYW5lbCBpcy0ke2dldFN0YXR1c0tpbmQob3V0cHV0KX0ke291dHB1dC52aXNpYmxlID8gXCJcIiA6IFwiIGlzLWhpZGRlblwifWA7XHJcbiAgcGFuZWwuZGF0YXNldC5sb29tQmxvY2tJZCA9IG91dHB1dC5ibG9ja0lkO1xyXG4gIHJlbmRlck91dHB1dFBhbmVsKHBhbmVsLCBvdXRwdXQpO1xyXG4gIHJldHVybiBwYW5lbDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlck91dHB1dFBhbmVsKHBhbmVsOiBIVE1MRWxlbWVudCwgb3V0cHV0OiBsb29tU3RvcmVkT3V0cHV0KTogdm9pZCB7XHJcbiAgY29uc3Qga2luZCA9IGdldFN0YXR1c0tpbmQob3V0cHV0KTtcclxuICBwYW5lbC5jbGFzc05hbWUgPSBgbG9vbS1vdXRwdXQtcGFuZWwgaXMtJHtraW5kfSR7b3V0cHV0LnZpc2libGUgPyBcIlwiIDogXCIgaXMtaGlkZGVuXCJ9JHtvdXRwdXQuY29sbGFwc2VkID8gXCIgaXMtY29sbGFwc2VkXCIgOiBcIlwifWA7XHJcbiAgcGFuZWwuZW1wdHkoKTtcclxuXHJcbiAgY29uc3QgaGVhZGVyID0gcGFuZWwuY3JlYXRlRGl2KHsgY2xzOiBcImxvb20tb3V0cHV0LWhlYWRlclwiIH0pO1xyXG4gIGNvbnN0IGJhZGdlID0gaGVhZGVyLmNyZWF0ZURpdih7IGNsczogXCJsb29tLW91dHB1dC1iYWRnZVwiIH0pO1xyXG4gIHNldEljb24oYmFkZ2UsIGtpbmQgPT09IFwic3VjY2Vzc1wiID8gXCJjaGVjay1jaXJjbGUtMlwiIDoga2luZCA9PT0gXCJ3YXJuaW5nXCIgPyBcImFsZXJ0LXRyaWFuZ2xlXCIgOiBcIngtY2lyY2xlXCIpO1xyXG5cclxuICBjb25zdCB0aXRsZSA9IGhlYWRlci5jcmVhdGVEaXYoeyBjbHM6IFwibG9vbS1vdXRwdXQtdGl0bGVcIiB9KTtcclxuICB0aXRsZS5zZXRUZXh0KGAke291dHB1dC5yZXN1bHQucnVubmVyTmFtZX0gXHUwMEI3IGV4aXQgJHtvdXRwdXQucmVzdWx0LmV4aXRDb2RlID8/IFwiP1wifWApO1xyXG5cclxuICBjb25zdCBtZXRhID0gaGVhZGVyLmNyZWF0ZURpdih7IGNsczogXCJsb29tLW91dHB1dC1tZXRhXCIgfSk7XHJcbiAgbWV0YS5zZXRUZXh0KGAke291dHB1dC5yZXN1bHQuZHVyYXRpb25Nc30gbXMgXHUwMEI3ICR7bmV3IERhdGUob3V0cHV0LnJlc3VsdC5maW5pc2hlZEF0KS50b0xvY2FsZVRpbWVTdHJpbmcoKX1gKTtcclxuXHJcbiAgY29uc3QgYm9keSA9IHBhbmVsLmNyZWF0ZURpdih7IGNsczogXCJsb29tLW91dHB1dC1ib2R5XCIgfSk7XHJcbiAgaWYgKG91dHB1dC5yZXN1bHQuc3Rkb3V0LnRyaW0oKSkge1xyXG4gICAgY3JlYXRlU3RyZWFtKGJvZHksIFwiU3Rkb3V0XCIsIG91dHB1dC5yZXN1bHQuc3Rkb3V0KTtcclxuICB9XHJcbiAgaWYgKG91dHB1dC5yZXN1bHQuc3RkZXJyLnRyaW0oKSkge1xyXG4gICAgY3JlYXRlU3RyZWFtKGJvZHksIFwiU3RkZXJyXCIsIG91dHB1dC5yZXN1bHQuc3RkZXJyKTtcclxuICB9XHJcbiAgaWYgKCFvdXRwdXQucmVzdWx0LnN0ZG91dC50cmltKCkgJiYgIW91dHB1dC5yZXN1bHQuc3RkZXJyLnRyaW0oKSkge1xyXG4gICAgY29uc3QgZW1wdHkgPSBib2R5LmNyZWF0ZURpdih7IGNsczogXCJsb29tLW91dHB1dC1lbXB0eVwiIH0pO1xyXG4gICAgZW1wdHkuc2V0VGV4dChcIk5vIG91dHB1dFwiKTtcclxuICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNyZWF0ZVN0cmVhbShjb250YWluZXI6IEhUTUxFbGVtZW50LCBsYWJlbDogc3RyaW5nLCBjb250ZW50OiBzdHJpbmcpOiB2b2lkIHtcclxuICBjb25zdCBzZWN0aW9uID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogXCJsb29tLW91dHB1dC1zdHJlYW1cIiB9KTtcclxuICBzZWN0aW9uLmNyZWF0ZURpdih7IGNsczogXCJsb29tLW91dHB1dC1zdHJlYW0tbGFiZWxcIiwgdGV4dDogbGFiZWwgfSk7XHJcbiAgc2VjdGlvbi5jcmVhdGVFbChcInByZVwiLCB7IGNsczogXCJsb29tLW91dHB1dC1wcmVcIiwgdGV4dDogY29udGVudCB9KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVJ1bm5pbmdQYW5lbCgpOiBIVE1MRGl2RWxlbWVudCB7XHJcbiAgY29uc3QgcGFuZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gIHBhbmVsLmNsYXNzTmFtZSA9IFwibG9vbS1vdXRwdXQtcGFuZWwgaXMtcnVubmluZ1wiO1xyXG5cclxuICBjb25zdCBoZWFkZXIgPSBwYW5lbC5jcmVhdGVEaXYoeyBjbHM6IFwibG9vbS1vdXRwdXQtaGVhZGVyXCIgfSk7XHJcbiAgY29uc3Qgc3Bpbm5lciA9IGhlYWRlci5jcmVhdGVEaXYoeyBjbHM6IFwibG9vbS1zcGlubmVyXCIgfSk7XHJcbiAgc2V0SWNvbihzcGlubmVyLCBcImxvYWRlci1jaXJjbGVcIik7XHJcbiAgY29uc3QgdGl0bGUgPSBoZWFkZXIuY3JlYXRlRGl2KHsgY2xzOiBcImxvb20tb3V0cHV0LXRpdGxlXCIgfSk7XHJcbiAgdGl0bGUuc2V0VGV4dChcIlJ1bm5pbmdcIik7XHJcbiAgY29uc3QgbWV0YSA9IGhlYWRlci5jcmVhdGVEaXYoeyBjbHM6IFwibG9vbS1vdXRwdXQtbWV0YVwiIH0pO1xyXG4gIG1ldGEuc2V0VGV4dChcIkV4ZWN1dGluZy4uLlwiKTtcclxuICBzcGlubmVyLnNldEF0dHJpYnV0ZShcImFyaWEtaGlkZGVuXCIsIFwidHJ1ZVwiKTtcclxuXHJcbiAgcmV0dXJuIHBhbmVsO1xyXG59XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBQUFBLG1CQVFP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TUFBTSxRQUFRLE1BQU0sQ0FBQyxZQUFZO0FBQzlDLFlBQU0sUUFBUSxRQUFRLE1BQU0sT0FBTztBQUNuQyxZQUFNLFFBQVEsS0FBSyx1QkFBdUIsT0FBTyxPQUFPO0FBQ3hELFVBQUksQ0FBQyxPQUFPO0FBQ1YsZUFBTztBQUFBLE1BQ1Q7QUFDQSxZQUFNLE9BQU8sTUFBTSxPQUFPLE1BQU0sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUNyRCxhQUFPLE1BQU0sS0FBSyxJQUFJO0FBQUEsSUFDeEIsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUVRLDRCQUE0QixTQUFpQixRQUE4QztBQUNqRyxVQUFNLE9BQU87QUFBQSxNQUNYLFVBQVUsT0FBTyxVQUFVO0FBQUEsTUFDM0IsUUFBUSxPQUFPLFlBQVksR0FBRztBQUFBLE1BQzlCLFlBQVksT0FBTyxVQUFVO0FBQUEsTUFDN0IsYUFBYSxPQUFPLFVBQVU7QUFBQSxNQUM5QixPQUFPLFNBQVM7QUFBQSxFQUFZLE9BQU8sTUFBTSxLQUFLO0FBQUEsTUFDOUMsT0FBTyxTQUFTO0FBQUEsRUFBWSxPQUFPLE1BQU0sS0FBSztBQUFBLElBQ2hELEVBQ0csT0FBTyxPQUFPLEVBQ2QsS0FBSyxNQUFNO0FBRWQsV0FBTztBQUFBLE1BQ0wsNkJBQTZCLE9BQU87QUFBQSxNQUNwQztBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFFUSx1QkFBdUIsT0FBaUIsU0FBd0Q7QUFDdEcsVUFBTSxjQUFjLDZCQUE2QixPQUFPO0FBQ3hELGFBQVMsSUFBSSxHQUFHLElBQUksTUFBTSxRQUFRLEtBQUssR0FBRztBQUN4QyxVQUFJLE1BQU0sQ0FBQyxFQUFFLEtBQUssTUFBTSxhQUFhO0FBQ25DO0FBQUEsTUFDRjtBQUVBLGVBQVMsSUFBSSxJQUFJLEdBQUcsSUFBSSxNQUFNLFFBQVEsS0FBSyxHQUFHO0FBQzVDLFlBQUksTUFBTSxDQUFDLEVBQUUsS0FBSyxNQUFNLDRCQUE0QjtBQUNsRCxpQkFBTyxFQUFFLE9BQU8sR0FBRyxLQUFLLEVBQUU7QUFBQSxRQUM1QjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQ0EsV0FBTztBQUFBLEVBQ1Q7QUFDRjsiLAogICJuYW1lcyI6IFsiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9wYXRoIiwgImdldExlYWRpbmdXaGl0ZXNwYWNlIiwgImltcG9ydF9wYXRoIiwgImltcG9ydF9wYXRoIiwgImltcG9ydF9wYXRoIiwgImltcG9ydF9wYXRoIiwgImxvb21QbHVnaW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiJdCn0K
