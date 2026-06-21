"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => loomPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian5 = require("obsidian");
var import_state = require("@codemirror/state");
var import_view2 = require("@codemirror/view");
var import_path7 = require("path");

// src/execution/containerRunner.ts
var import_obsidian = require("obsidian");
var import_fs = require("fs");
var import_promises2 = require("fs/promises");
var import_path2 = require("path");

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
  let sharedIndent = getLeadingWhitespace(nonEmptyLines[0]);
  for (const line of nonEmptyLines.slice(1)) {
    sharedIndent = sharedWhitespacePrefix(sharedIndent, getLeadingWhitespace(line));
    if (!sharedIndent) {
      return source;
    }
  }
  if (!sharedIndent) {
    return source;
  }
  return lines.map((line) => line.trim().length === 0 ? line : line.startsWith(sharedIndent) ? line.slice(sharedIndent.length) : line).join("\n");
}
function getLeadingWhitespace(line) {
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
  let executable = spec.executable;
  let args = spec.args;
  if (globalThis.loomRunOnWsl && process.platform === "win32") {
    if (spec.executable !== "wsl") {
      const wslArgs = spec.args.map((arg) => {
        const match = arg.match(/^([A-Za-z]):\\(.*)/);
        if (match) {
          const drive = match[1].toLowerCase();
          const rest = match[2].replace(/\\/g, "/");
          return `/mnt/${drive}/${rest}`;
        }
        if (arg.includes("\\")) {
          return arg.replace(/\\/g, "/");
        }
        return arg;
      });
      const escapedArgs = [spec.executable, ...wslArgs].map((arg) => '"' + arg.replace(/"/g, '\\"') + '"').join(" ");
      executable = "wsl";
      args = ["bash", "-l", "-c", escapedArgs];
    }
  }
  try {
    await new Promise((resolve, reject) => {
      child = (0, import_child_process.spawn)(executable, args, {
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

// src/utils/command.ts
function splitCommandLine(input) {
  const parts = [];
  let current = "";
  let quote = null;
  let escaping = false;
  for (const char of input.trim()) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }
    if (char === "\\") {
      escaping = true;
      continue;
    }
    if ((char === "'" || char === '"') && !quote) {
      quote = char;
      continue;
    }
    if (char === quote) {
      quote = null;
      continue;
    }
    if (/\s/.test(char) && !quote) {
      if (current) {
        parts.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (current) {
    parts.push(current);
  }
  return parts;
}

// src/execution/containerRunner.ts
var loomContainerRunner = class {
  constructor(app, pluginDir) {
    this.app = app;
    this.pluginDir = pluginDir;
    this.builtImages = /* @__PURE__ */ new Set();
  }
  getContainerGroupName(file) {
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    const value = frontmatter?.["loom-container"];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }
  async getGroupSummaries() {
    const containersPath = this.getContainersPath();
    if (!(0, import_fs.existsSync)(containersPath)) {
      return [];
    }
    const { readdir } = await import("fs/promises");
    const entries = await readdir(containersPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => {
      const groupPath = (0, import_path2.join)(containersPath, entry.name);
      const hasConfig = (0, import_fs.existsSync)((0, import_path2.join)(groupPath, "config.json"));
      const hasDockerfile = (0, import_fs.existsSync)((0, import_path2.join)(groupPath, "Dockerfile"));
      return {
        name: entry.name,
        status: hasConfig ? hasDockerfile ? "config + Dockerfile" : "config only" : "missing config.json"
      };
    });
  }
  async run(block, context, settings, groupName) {
    const groupPath = this.resolveGroupPath(groupName);
    const config = await this.readConfig(groupPath);
    const language = config.languages[block.language] ?? config.languages[block.languageAlias];
    if (!language) {
      throw new Error(`Container group ${groupName} has no command for ${block.language}.`);
    }
    await (0, import_promises2.mkdir)(groupPath, { recursive: true });
    const image = await this.resolveImage(groupName, groupPath, config, context, settings);
    const tempFileName = `temp_${Date.now()}_${Math.random().toString(16).slice(2)}${normalizeExtension(language.extension)}`;
    const tempFilePath = (0, import_path2.join)(groupPath, tempFileName);
    try {
      await (0, import_promises2.writeFile)(tempFilePath, block.content, "utf8");
      const command = splitCommandLine(language.command.replaceAll("{file}", tempFileName));
      if (!command.length) {
        throw new Error(`Container command for ${block.language} is empty.`);
      }
      return await runProcess({
        runnerId: `container:${groupName}:${block.language}`,
        runnerName: `Container ${groupName}`,
        executable: "docker",
        args: [
          "run",
          "--rm",
          "-v",
          `${groupPath}:/workspace`,
          "-w",
          "/workspace",
          image,
          ...command
        ],
        workingDirectory: groupPath,
        timeoutMs: context.timeoutMs,
        signal: context.signal
      });
    } finally {
      await (0, import_promises2.rm)(tempFilePath, { force: true });
    }
  }
  async buildGroup(groupName, timeoutMs, signal) {
    const groupPath = this.resolveGroupPath(groupName);
    const config = await this.readConfig(groupPath);
    return this.buildImage(groupName, groupPath, config, timeoutMs, signal);
  }
  async resolveImage(groupName, groupPath, config, context, settings) {
    const dockerfile = (0, import_path2.join)(groupPath, "Dockerfile");
    if (!(0, import_fs.existsSync)(dockerfile)) {
      return config.image || "ubuntu:latest";
    }
    const image = this.imageNameForGroup(groupName);
    if (this.builtImages.has(image)) {
      return image;
    }
    const result = await this.buildImage(groupName, groupPath, config, Math.max(context.timeoutMs, settings.defaultTimeoutMs, 12e4), context.signal);
    if (!result.success) {
      throw new Error(result.stderr || result.stdout || `Docker build failed for ${groupName}.`);
    }
    this.builtImages.add(image);
    return image;
  }
  async buildImage(groupName, groupPath, _config, timeoutMs, signal) {
    const image = this.imageNameForGroup(groupName);
    return runProcess({
      runnerId: `container:${groupName}:build`,
      runnerName: `Container ${groupName} build`,
      executable: "docker",
      args: ["build", "-t", image, groupPath],
      workingDirectory: groupPath,
      timeoutMs,
      signal
    });
  }
  async readConfig(groupPath) {
    const configPath = (0, import_path2.join)(groupPath, "config.json");
    let raw;
    try {
      raw = JSON.parse(await (0, import_promises2.readFile)(configPath, "utf8"));
    } catch (error) {
      throw new Error(`Unable to read container config ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error("Container config must be an object.");
    }
    const data = raw;
    if (data.image != null && typeof data.image !== "string") {
      throw new Error("Container config image must be a string.");
    }
    if (!data.languages || typeof data.languages !== "object" || Array.isArray(data.languages)) {
      throw new Error("Container config languages must be an object.");
    }
    const languages = {};
    for (const [language, value] of Object.entries(data.languages)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`Container language ${language} must be an object.`);
      }
      const languageConfig = value;
      if (typeof languageConfig.command !== "string" || !languageConfig.command.trim()) {
        throw new Error(`Container language ${language} must define command.`);
      }
      languages[language] = {
        command: languageConfig.command,
        extension: typeof languageConfig.extension === "string" ? languageConfig.extension : `.${language}`
      };
    }
    return {
      image: typeof data.image === "string" ? data.image : void 0,
      languages
    };
  }
  getContainersPath() {
    const adapterBasePath = this.app.vault.adapter.basePath ?? "";
    return (0, import_path2.normalize)((0, import_path2.join)(adapterBasePath, this.pluginDir, "containers"));
  }
  resolveGroupPath(groupName) {
    const safeName = (0, import_path2.basename)(groupName);
    if (!safeName || safeName !== groupName) {
      throw new Error(`Invalid container group name: ${groupName}`);
    }
    return (0, import_path2.normalize)((0, import_path2.join)(this.getContainersPath(), safeName));
  }
  imageNameForGroup(groupName) {
    return `loom-container-${groupName.toLowerCase().replace(/[^a-z0-9_.-]/g, "-")}`;
  }
};
function normalizeExtension(extension) {
  const trimmed = extension.trim();
  return trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
}

// src/llvmHighlight.ts
var import_view = require("@codemirror/view");
var LLVM_KEYWORDS = new Map([
  ...mapWords("loom-llvm-keyword-control", [
    "ret",
    "br",
    "switch",
    "indirectbr",
    "invoke",
    "callbr",
    "resume",
    "unreachable",
    "cleanupret",
    "catchret",
    "catchswitch"
  ]),
  ...mapWords("loom-llvm-keyword-declaration", [
    "define",
    "declare",
    "type",
    "global",
    "constant",
    "alias",
    "ifunc",
    "comdat",
    "attributes",
    "section",
    "gc",
    "prefix",
    "prologue",
    "personality",
    "uselistorder",
    "uselistorder_bb",
    "module",
    "asm",
    "source_filename",
    "target"
  ]),
  ...mapWords("loom-llvm-keyword-memory", [
    "alloca",
    "load",
    "store",
    "getelementptr",
    "fence",
    "cmpxchg",
    "atomicrmw",
    "extractvalue",
    "insertvalue",
    "extractelement",
    "insertelement",
    "shufflevector"
  ]),
  ...mapWords("loom-llvm-keyword-arithmetic", [
    "add",
    "sub",
    "mul",
    "udiv",
    "sdiv",
    "urem",
    "srem",
    "shl",
    "lshr",
    "ashr",
    "and",
    "or",
    "xor",
    "fneg",
    "fadd",
    "fsub",
    "fmul",
    "fdiv",
    "frem"
  ]),
  ...mapWords("loom-llvm-keyword-comparison", ["icmp", "fcmp"]),
  ...mapWords("loom-llvm-keyword-cast", [
    "trunc",
    "zext",
    "sext",
    "fptrunc",
    "fpext",
    "fptoui",
    "fptosi",
    "uitofp",
    "sitofp",
    "ptrtoint",
    "inttoptr",
    "bitcast",
    "addrspacecast"
  ]),
  ...mapWords("loom-llvm-keyword-other", ["phi", "select", "freeze", "call", "landingpad", "catchpad", "cleanuppad", "va_arg"]),
  ...mapWords("loom-llvm-keyword-modifier", [
    "private",
    "internal",
    "available_externally",
    "linkonce",
    "weak",
    "common",
    "appending",
    "extern_weak",
    "linkonce_odr",
    "weak_odr",
    "external",
    "default",
    "hidden",
    "protected",
    "dllimport",
    "dllexport",
    "dso_local",
    "dso_preemptable",
    "externally_initialized",
    "thread_local",
    "localdynamic",
    "initialexec",
    "localexec",
    "unnamed_addr",
    "local_unnamed_addr",
    "atomic",
    "unordered",
    "monotonic",
    "acquire",
    "release",
    "acq_rel",
    "seq_cst",
    "syncscope",
    "volatile",
    "singlethread",
    "ccc",
    "fastcc",
    "coldcc",
    "webkit_jscc",
    "anyregcc",
    "preserve_mostcc",
    "preserve_allcc",
    "cxx_fast_tlscc",
    "swiftcc",
    "tailcc",
    "cfguard_checkcc",
    "tail",
    "musttail",
    "notail",
    "fast",
    "nnan",
    "ninf",
    "nsz",
    "arcp",
    "contract",
    "afn",
    "reassoc",
    "nuw",
    "nsw",
    "exact",
    "inbounds",
    "to",
    "x"
  ]),
  ...mapWords("loom-llvm-predicate", [
    "eq",
    "ne",
    "ugt",
    "uge",
    "ult",
    "ule",
    "sgt",
    "sge",
    "slt",
    "sle",
    "oeq",
    "ogt",
    "oge",
    "olt",
    "ole",
    "one",
    "ord",
    "ueq",
    "une",
    "uno"
  ]),
  ...mapWords("loom-llvm-attribute", [
    "alwaysinline",
    "argmemonly",
    "builtin",
    "byref",
    "byval",
    "cold",
    "convergent",
    "dereferenceable",
    "dereferenceable_or_null",
    "distinct",
    "immarg",
    "inalloca",
    "inreg",
    "mustprogress",
    "nest",
    "noalias",
    "nocallback",
    "nocapture",
    "nofree",
    "noinline",
    "nonlazybind",
    "nonnull",
    "norecurse",
    "noredzone",
    "noreturn",
    "nosync",
    "nounwind",
    "null_pointer_is_valid",
    "opaque",
    "optnone",
    "optsize",
    "preallocated",
    "readnone",
    "readonly",
    "returned",
    "returns_twice",
    "sanitize_address",
    "sanitize_hwaddress",
    "sanitize_memory",
    "sanitize_thread",
    "signext",
    "speculatable",
    "sret",
    "ssp",
    "sspreq",
    "sspstrong",
    "swiftasync",
    "swiftself",
    "swifterror",
    "uwtable",
    "willreturn",
    "writeonly",
    "zeroext"
  ]),
  ...mapWords("loom-llvm-constant", ["true", "false", "null", "none", "undef", "poison", "zeroinitializer"])
]);
var LLVM_PRIMITIVE_TYPES = /* @__PURE__ */ new Set([
  "void",
  "label",
  "token",
  "metadata",
  "x86_mmx",
  "x86_amx",
  "half",
  "bfloat",
  "float",
  "double",
  "fp128",
  "x86_fp80",
  "ppc_fp128",
  "ptr"
]);
var PUNCTUATION_CLASS = "loom-llvm-punctuation";
function highlightLlvmElement(codeElement, source) {
  codeElement.empty();
  codeElement.addClass("loom-llvm-code");
  const lines = source.split("\n");
  lines.forEach((line, index) => {
    appendHighlightedLine(codeElement, line);
    if (index < lines.length - 1) {
      codeElement.appendText("\n");
    }
  });
}
function addLlvmDecorations(builder, view, block) {
  const contentLineCount = getContentLineCount(block);
  if (!contentLineCount) {
    return;
  }
  const lines = block.content.split("\n");
  for (let index = 0; index < contentLineCount; index += 1) {
    const line = lines[index] ?? "";
    const tokens = tokenizeLlvmLine(line);
    if (!tokens.length) {
      continue;
    }
    const docLine = view.state.doc.line(block.startLine + 2 + index);
    for (const token of tokens) {
      if (token.from === token.to) {
        continue;
      }
      builder.add(
        docLine.from + token.from,
        docLine.from + token.to,
        import_view.Decoration.mark({ class: token.className })
      );
    }
  }
}
function appendHighlightedLine(container, line) {
  let cursor = 0;
  for (const token of tokenizeLlvmLine(line)) {
    if (token.from > cursor) {
      container.appendText(line.slice(cursor, token.from));
    }
    const span = container.createSpan({ cls: token.className });
    span.setText(line.slice(token.from, token.to));
    cursor = token.to;
  }
  if (cursor < line.length) {
    container.appendText(line.slice(cursor));
  }
}
function tokenizeLlvmLine(line) {
  const tokens = [];
  let index = 0;
  addLabelToken(line, tokens);
  while (index < line.length) {
    const current = line[index];
    if (current === ";") {
      tokens.push({ from: index, to: line.length, className: "loom-llvm-comment" });
      break;
    }
    if (/\s/.test(current)) {
      index += 1;
      continue;
    }
    const stringToken = readStringToken(line, index);
    if (stringToken) {
      if (stringToken.prefixEnd > index) {
        tokens.push({ from: index, to: stringToken.prefixEnd, className: "loom-llvm-string-prefix" });
      }
      tokens.push({ from: stringToken.valueStart, to: stringToken.valueEnd, className: "loom-llvm-string" });
      index = stringToken.valueEnd;
      continue;
    }
    const matched = matchRegexToken(line, index, /@llvm\.[A-Za-z$._0-9]+/y, "loom-llvm-intrinsic", tokens) || matchRegexToken(line, index, /@[A-Za-z$._-][A-Za-z$._0-9-]*|@\d+\b/y, "loom-llvm-global", tokens) || matchRegexToken(line, index, /%[A-Za-z$._-][A-Za-z$._0-9-]*|%\d+\b/y, "loom-llvm-local", tokens) || matchRegexToken(line, index, /![A-Za-z$._-][A-Za-z$._0-9-]*|!\d+\b/y, "loom-llvm-metadata", tokens) || matchRegexToken(line, index, /\$[A-Za-z$._-][A-Za-z$._0-9-]*/y, "loom-llvm-comdat", tokens) || matchRegexToken(line, index, /#\d+\b/y, "loom-llvm-attribute-group", tokens) || matchRegexToken(line, index, /\baddrspace\s*\(\s*\d+\s*\)/y, "loom-llvm-type", tokens) || matchRegexToken(line, index, /[-+]?0x[0-9A-Fa-f]+\b/y, "loom-llvm-number", tokens) || matchRegexToken(line, index, /[-+]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][-+]?\d+)\b/y, "loom-llvm-number", tokens) || matchRegexToken(line, index, /[-+]?(?:\d+\.\d*|\.\d+)\b/y, "loom-llvm-number", tokens) || matchRegexToken(line, index, /[-+]?\d+\b/y, "loom-llvm-number", tokens) || matchRegexToken(line, index, /\.\.\./y, "loom-llvm-punctuation", tokens);
    if (matched) {
      index = matched;
      continue;
    }
    const word = readWord(line, index);
    if (word) {
      tokens.push({
        from: index,
        to: word.end,
        className: classifyWord(word.value)
      });
      index = word.end;
      continue;
    }
    if ("()[]{}<>,:=*".includes(current)) {
      tokens.push({ from: index, to: index + 1, className: PUNCTUATION_CLASS });
      index += 1;
      continue;
    }
    index += 1;
  }
  return normalizeTokens(tokens);
}
function addLabelToken(line, tokens) {
  const match = line.match(/^(\s*)(?:([A-Za-z$._-][A-Za-z$._0-9-]*|\d+)|(%[A-Za-z$._-][A-Za-z$._0-9-]*|%\d+))(:)/);
  if (!match || match.index == null) {
    return;
  }
  const labelStart = match[1].length;
  const labelText = match[2] ?? match[3];
  if (!labelText) {
    return;
  }
  tokens.push({
    from: labelStart,
    to: labelStart + labelText.length,
    className: "loom-llvm-label"
  });
  tokens.push({
    from: labelStart + labelText.length,
    to: labelStart + labelText.length + 1,
    className: PUNCTUATION_CLASS
  });
}
function classifyWord(word) {
  if (/^i\d+$/.test(word) || LLVM_PRIMITIVE_TYPES.has(word)) {
    return "loom-llvm-type";
  }
  return LLVM_KEYWORDS.get(word) ?? "loom-llvm-plain";
}
function readWord(line, index) {
  const match = /[A-Za-z_][A-Za-z0-9_.-]*/y;
  match.lastIndex = index;
  const result = match.exec(line);
  if (!result) {
    return null;
  }
  return {
    value: result[0],
    end: match.lastIndex
  };
}
function readStringToken(line, index) {
  let cursor = index;
  if (line[cursor] === "c" && line[cursor + 1] === '"') {
    cursor += 1;
  }
  if (line[cursor] !== '"') {
    return null;
  }
  const valueStart = cursor;
  cursor += 1;
  while (cursor < line.length) {
    if (line[cursor] === "\\") {
      cursor += 2;
      continue;
    }
    if (line[cursor] === '"') {
      cursor += 1;
      break;
    }
    cursor += 1;
  }
  return {
    prefixEnd: valueStart,
    valueStart,
    valueEnd: cursor
  };
}
function matchRegexToken(line, index, regex, className, tokens) {
  regex.lastIndex = index;
  const match = regex.exec(line);
  if (!match) {
    return null;
  }
  tokens.push({ from: index, to: regex.lastIndex, className });
  return regex.lastIndex;
}
function normalizeTokens(tokens) {
  tokens.sort((left, right) => left.from - right.from || left.to - right.to);
  const normalized = [];
  let cursor = 0;
  for (const token of tokens) {
    if (token.to <= cursor) {
      continue;
    }
    const from = Math.max(token.from, cursor);
    normalized.push({ ...token, from });
    cursor = token.to;
  }
  return normalized;
}
function getContentLineCount(block) {
  if (block.endLine === block.startLine) {
    return 0;
  }
  if (block.content.length === 0) {
    return block.endLine > block.startLine + 1 ? 1 : 0;
  }
  return block.content.split("\n").length;
}
function mapWords(className, words) {
  return words.map((word) => [word, className]);
}

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
  haskell: "haskell",
  hs: "haskell",
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
function normalizeLanguage(rawLanguage, settings) {
  const normalized = rawLanguage.trim().toLowerCase();
  for (const language of settings?.customLanguages ?? []) {
    const name = language.name.trim().toLowerCase();
    const aliases = parseAliasList(language.aliases);
    if (name && (name === normalized || aliases.includes(normalized))) {
      return language.name.trim();
    }
  }
  return LANGUAGE_ALIASES[normalized] ?? null;
}
function getSupportedLanguageAliases(settings) {
  return [
    ...Object.keys(LANGUAGE_ALIASES),
    ...(settings?.customLanguages ?? []).flatMap((language) => [language.name, ...parseAliasList(language.aliases)])
  ].map((alias) => alias.toLowerCase());
}
function parseMarkdownCodeBlocks(filePath, source, settings) {
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
    const fenceIndent = getLeadingWhitespace2(line);
    const fenceToken = fenceMatch[1];
    const sourceLanguage = (fenceMatch[2] ?? "").trim();
    const language = normalizeLanguage(sourceLanguage, settings);
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
function parseAliasList(value) {
  return value.split(",").map((alias) => alias.trim().toLowerCase()).filter(Boolean);
}
function findBlockAtLine(blocks, line) {
  return blocks.find((block) => line >= block.startLine && line <= block.endLine) ?? null;
}
function getLeadingWhitespace2(line) {
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

// src/runners/custom.ts
var CustomLanguageRunner = class {
  constructor() {
    this.id = "custom";
    this.displayName = "Custom language";
    this.languages = [];
  }
  canRun(block, settings) {
    return Boolean(this.getCustomLanguage(block, settings)?.executable.trim());
  }
  run(block, context, settings) {
    const language = this.getCustomLanguage(block, settings);
    if (!language) {
      throw new Error(`Unsupported custom language: ${block.language}`);
    }
    return runTempFileProcess({
      runnerId: `${this.id}:${language.name}`,
      runnerName: language.name,
      executable: language.executable.trim(),
      args: splitCommandLine(language.args || "{file}"),
      fileExtension: normalizeExtension2(language.extension, language.name),
      source: block.content,
      workingDirectory: context.workingDirectory,
      timeoutMs: context.timeoutMs,
      signal: context.signal
    });
  }
  getCustomLanguage(block, settings) {
    const normalized = block.language.trim().toLowerCase();
    return settings.customLanguages.find((language) => {
      const name = language.name.trim().toLowerCase();
      const aliases = language.aliases.split(",").map((alias) => alias.trim().toLowerCase()).filter(Boolean);
      return name === normalized || aliases.includes(normalized);
    });
  }
};
function normalizeExtension2(extension, name) {
  const trimmed = extension.trim();
  if (!trimmed) {
    return `.${name}`;
  }
  return trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
}

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
  },
  {
    language: "haskell",
    displayName: "Haskell",
    executable: (settings) => settings.haskellExecutable,
    fileExtension: ".hs",
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
  async run(block, context, settings) {
    const result = await runTempFileProcess({
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
    if (!result.timedOut && !result.cancelled && result.exitCode != null && !result.stderr.trim()) {
      if (result.exitCode !== 0) {
        result.success = true;
        result.warning = `Program returned i32 ${result.exitCode}. Under lli, that becomes the process exit status.`;
      }
      if (!result.stdout.trim()) {
        result.stdout = result.exitCode === 0 ? "LLVM program exited with code 0." : `LLVM program returned i32 ${result.exitCode}.
Use stdout in the IR itself if you want printable program output.`;
      }
    }
    return result;
  }
};

// src/runners/managedCompiled.ts
var import_path3 = require("path");
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
      const binaryPath = (0, import_path3.join)(tempDir, "snippet.out");
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
var import_path4 = require("path");
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
      const binaryPath = (0, import_path4.join)(tempDir, "snippet.out");
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
var import_path5 = require("path");
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
      const binaryPath = (0, import_path5.join)(tempDir, "snippet.out");
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
var import_fs2 = require("fs");
var import_path6 = require("path");
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
  const opamCoqc = (0, import_path6.join)(process.env.HOME ?? "", ".opam", "default", "bin", "coqc");
  return (0, import_fs2.existsSync)(opamCoqc) ? opamCoqc : configured || "coqc";
}

// src/runners/registry.ts
var loomRunnerRegistry = class {
  constructor(runners) {
    this.runners = runners;
  }
  getRunnerForBlock(block, settings) {
    return this.runners.find((runner) => (!runner.languages.length || runner.languages.includes(block.language)) && runner.canRun(block, settings)) ?? null;
  }
  getSupportedLanguages() {
    return [...new Set(this.runners.flatMap((runner) => runner.languages))];
  }
};

// src/settings.ts
var import_obsidian2 = require("obsidian");
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
  haskellExecutable: "runghc",
  javaCompilerExecutable: "",
  javaExecutable: "java",
  llvmInterpreterExecutable: "lli",
  leanExecutable: "lean",
  coqExecutable: "coqc",
  smtExecutable: "z3",
  writeOutputToNote: false,
  autoRunOnFileOpen: false,
  customLanguages: [],
  pdfExportMode: "both",
  runOnWsl: false
};
var loomSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(loomPlugin2) {
    super(loomPlugin2.app, loomPlugin2);
    this.loomPlugin = loomPlugin2;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "loom" });
    containerEl.createEl("p", { text: "Run supported code fences directly from notes while preserving native syntax highlighting." });
    this.renderGeneralSettings(this.createSection(containerEl, "General Settings", true));
    this.renderBuiltInRuntimes(this.createSection(containerEl, "Built-in Runtimes"));
    this.renderCustomLanguages(this.createSection(containerEl, "Custom Languages"));
    void this.renderContainerGroups(this.createSection(containerEl, "Containerization Groups"));
  }
  createSection(containerEl, title, open = false) {
    const details = containerEl.createEl("details", { cls: "loom-settings-section" });
    details.open = open;
    details.createEl("summary", { text: title, cls: "loom-settings-summary" });
    return details.createDiv({ cls: "loom-settings-section-body" });
  }
  renderGeneralSettings(containerEl) {
    new import_obsidian2.Setting(containerEl).setName("Enable local execution").setDesc("Disabled by default. loom runs code on your local machine and does not provide sandboxing.").addToggle(
      (toggle) => toggle.setValue(this.loomPlugin.settings.enableLocalExecution).onChange(async (value) => {
        this.loomPlugin.settings.enableLocalExecution = value;
        if (value) {
          this.loomPlugin.settings.hasAcknowledgedExecutionRisk = true;
        }
        await this.loomPlugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Keep loom notes in source mode").setDesc("Preserve raw fenced code in the editor instead of letting live preview collapse research snippets.").addToggle(
      (toggle) => toggle.setValue(this.loomPlugin.settings.preserveSourceMode).onChange(async (value) => {
        this.loomPlugin.settings.preserveSourceMode = value;
        await this.loomPlugin.saveSettings();
        void this.loomPlugin.enforceSourceModeForActiveView();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Default timeout").setDesc("Maximum execution time in milliseconds before loom terminates the process.").addText(
      (text) => text.setPlaceholder("8000").setValue(String(this.loomPlugin.settings.defaultTimeoutMs)).onChange(async (value) => {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isNaN(parsed) && parsed > 0) {
          this.loomPlugin.settings.defaultTimeoutMs = parsed;
          await this.loomPlugin.saveSettings();
        }
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Working directory").setDesc("Optional. Empty uses the current note folder when possible, otherwise the vault root.").addText(
      (text) => text.setPlaceholder("Vault root").setValue(this.loomPlugin.settings.workingDirectory).onChange(async (value) => {
        this.loomPlugin.settings.workingDirectory = value.trim() ? (0, import_obsidian2.normalizePath)(value.trim()) : "";
        await this.loomPlugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Write output back to note").setDesc("Insert managed loom output sections beneath code blocks instead of keeping results purely in the UI.").addToggle(
      (toggle) => toggle.setValue(this.loomPlugin.settings.writeOutputToNote).onChange(async (value) => {
        this.loomPlugin.settings.writeOutputToNote = value;
        await this.loomPlugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Auto-run on file open").setDesc("Run all supported blocks in the active note when it opens. Disabled by default.").addToggle(
      (toggle) => toggle.setValue(this.loomPlugin.settings.autoRunOnFileOpen).onChange(async (value) => {
        this.loomPlugin.settings.autoRunOnFileOpen = value;
        await this.loomPlugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("PDF export mode").setDesc("Choose what to include when exporting notes containing loom code blocks to PDF.").addDropdown(
      (dropdown) => dropdown.addOption("both", "Both Code and Output").addOption("code", "Code Block Only").addOption("output", "Output Only").setValue(this.loomPlugin.settings.pdfExportMode || "both").onChange(async (value) => {
        this.loomPlugin.settings.pdfExportMode = value;
        await this.loomPlugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Run on WSL").setDesc("On Windows, execute local commands inside WSL (Windows Subsystem for Linux) instead of natively on Windows.").addToggle(
      (toggle) => toggle.setValue(this.loomPlugin.settings.runOnWsl).onChange(async (value) => {
        this.loomPlugin.settings.runOnWsl = value;
        await this.loomPlugin.saveSettings();
      })
    );
  }
  renderBuiltInRuntimes(containerEl) {
    this.addTextSetting(containerEl, "Python executable", "Path or command name for Python.", "pythonExecutable");
    this.addTextSetting(containerEl, "Node executable", "Path or command name for JavaScript execution.", "nodeExecutable");
    new import_obsidian2.Setting(containerEl).setName("TypeScript runner mode").setDesc("Use ts-node or tsx for TypeScript blocks.").addDropdown(
      (dropdown) => dropdown.addOption("ts-node", "ts-node").addOption("tsx", "tsx").setValue(this.loomPlugin.settings.typescriptMode).onChange(async (value) => {
        this.loomPlugin.settings.typescriptMode = value;
        await this.loomPlugin.saveSettings();
      })
    );
    this.addTextSetting(containerEl, "TypeScript transpiler executable", "Command or path for ts-node or tsx.", "typescriptTranspilerExecutable");
    new import_obsidian2.Setting(containerEl).setName("OCaml mode").setDesc("Choose between the OCaml toplevel, ocamlc compilation, or dune exec.").addDropdown(
      (dropdown) => dropdown.addOption("ocaml", "ocaml").addOption("ocamlc", "ocamlc").addOption("dune", "dune").setValue(this.loomPlugin.settings.ocamlMode).onChange(async (value) => {
        this.loomPlugin.settings.ocamlMode = value;
        await this.loomPlugin.saveSettings();
      })
    );
    this.addTextSetting(containerEl, "OCaml executable", "Command or path for ocaml, ocamlc, or dune depending on the selected mode.", "ocamlExecutable");
    this.addTextSetting(containerEl, "C compiler", "Command or path for compiling C blocks.", "cExecutable");
    this.addTextSetting(containerEl, "C++ compiler", "Command or path for compiling C++ blocks.", "cppExecutable");
    this.addTextSetting(containerEl, "Shell executable", "Command or path for Shell, Bash, and sh blocks.", "shellExecutable");
    this.addTextSetting(containerEl, "Ruby executable", "Command or path for Ruby blocks.", "rubyExecutable");
    this.addTextSetting(containerEl, "Perl executable", "Command or path for Perl blocks.", "perlExecutable");
    this.addTextSetting(containerEl, "Lua executable", "Command or path for Lua blocks.", "luaExecutable");
    this.addTextSetting(containerEl, "PHP executable", "Command or path for PHP blocks.", "phpExecutable");
    this.addTextSetting(containerEl, "Go executable", "Command or path for Go blocks.", "goExecutable");
    this.addTextSetting(containerEl, "Rust compiler", "Command or path for compiling Rust blocks.", "rustExecutable");
    this.addTextSetting(containerEl, "Haskell executable", "Command or path for Haskell blocks. Defaults to runghc.", "haskellExecutable");
    this.addTextSetting(containerEl, "Java compiler", "Optional command or path for javac. Leave empty to use Java source-file mode.", "javaCompilerExecutable");
    this.addTextSetting(containerEl, "Java executable", "Command or path for running compiled Java blocks.", "javaExecutable");
    this.addTextSetting(containerEl, "LLVM IR interpreter", "Command or path for running LLVM IR blocks with lli.", "llvmInterpreterExecutable");
    this.addTextSetting(containerEl, "Lean executable", "Command or path for checking Lean blocks.", "leanExecutable");
    this.addTextSetting(containerEl, "Coq executable", "Command or path for checking Coq blocks with coqc.", "coqExecutable");
    this.addTextSetting(containerEl, "SMT solver", "Command or path for SMT-LIB blocks. Defaults to z3.", "smtExecutable");
  }
  renderCustomLanguages(containerEl) {
    const listEl = containerEl.createDiv({ cls: "loom-custom-language-list" });
    this.renderCustomLanguageList(listEl);
    new import_obsidian2.Setting(containerEl).setName("Add custom language").setDesc("Create a new local command-backed language.").addButton(
      (button) => button.setButtonText("+").onClick(async () => {
        this.loomPlugin.settings.customLanguages.push({
          name: "custom-language",
          aliases: "",
          executable: "",
          args: "{file}",
          extension: ".txt"
        });
        await this.loomPlugin.saveSettings();
        this.display();
      })
    );
  }
  renderCustomLanguageList(containerEl) {
    containerEl.empty();
    if (!this.loomPlugin.settings.customLanguages.length) {
      containerEl.createEl("p", {
        text: "No custom languages configured.",
        cls: "setting-item-description"
      });
      return;
    }
    this.loomPlugin.settings.customLanguages.forEach((language, index) => {
      const details = containerEl.createEl("details", { cls: "loom-custom-language" });
      details.open = true;
      details.createEl("summary", { text: language.name || `Custom language ${index + 1}` });
      const body = details.createDiv({ cls: "loom-custom-language-body" });
      this.addCustomLanguageTextSetting(body, language, "Name", "Normalized language id used by loom.", "name");
      this.addCustomLanguageTextSetting(body, language, "Aliases", "Comma-separated fence aliases.", "aliases");
      this.addCustomLanguageTextSetting(body, language, "Executable", "Local command or absolute executable path.", "executable");
      this.addCustomLanguageTextSetting(body, language, "Arguments", "Space-separated arguments. Use {file} for the temp source file.", "args");
      this.addCustomLanguageTextSetting(body, language, "Extension", "Temp source file extension, for example .py.", "extension");
      new import_obsidian2.Setting(body).setName("Delete language").setDesc("Remove this custom language.").addButton(
        (button) => button.setButtonText("Delete").setWarning().onClick(async () => {
          this.loomPlugin.settings.customLanguages.splice(index, 1);
          await this.loomPlugin.saveSettings();
          this.display();
        })
      );
    });
  }
  async renderContainerGroups(containerEl) {
    const listEl = containerEl.createDiv({ cls: "loom-container-group-list" });
    listEl.setText("Scanning container groups...");
    const groups = await this.loomPlugin.getContainerGroupSummaries();
    listEl.empty();
    if (!groups.length) {
      listEl.createEl("p", {
        text: "No container groups found in .obsidian/plugins/loom/containers.",
        cls: "setting-item-description"
      });
      return;
    }
    for (const group of groups) {
      new import_obsidian2.Setting(listEl).setName(group.name).setDesc(group.status).addButton(
        (button) => button.setButtonText("Build / rebuild").onClick(async () => {
          await this.loomPlugin.buildContainerGroup(group.name);
        })
      );
    }
  }
  addTextSetting(containerEl, name, description, key) {
    new import_obsidian2.Setting(containerEl).setName(name).setDesc(description).addText(
      (text) => text.setValue(String(this.loomPlugin.settings[key] ?? "")).onChange(async (value) => {
        this.loomPlugin.settings[key] = value.trim();
        await this.loomPlugin.saveSettings();
      })
    );
  }
  addCustomLanguageTextSetting(containerEl, language, name, description, key) {
    new import_obsidian2.Setting(containerEl).setName(name).setDesc(description).addText(
      (text) => text.setValue(language[key]).onChange(async (value) => {
        language[key] = value.trim();
        await this.loomPlugin.saveSettings();
      })
    );
  }
};
function showExecutionDisabledNotice() {
  new import_obsidian2.Notice("loom local execution is disabled. Enable it in settings or confirm the execution warning first.");
}

// src/ui/codeBlockToolbar.ts
var import_obsidian3 = require("obsidian");
function createCodeBlockToolbar(blockId, isRunning, handlers) {
  const toolbar = document.createElement("div");
  toolbar.className = "loom-code-toolbar";
  toolbar.dataset.loomBlockId = blockId;
  toolbar.appendChild(createButton("Run block", isRunning ? "loader-circle" : "play", handlers.onRun, isRunning));
  toolbar.appendChild(createButton("Copy code", "copy", handlers.onCopy, false));
  toolbar.appendChild(createButton("Remove snippet", "trash-2", handlers.onRemove, false));
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
  (0, import_obsidian3.setIcon)(button, iconName);
  return button;
}

// src/ui/outputPanel.ts
var import_obsidian4 = require("obsidian");
function getStatusKind(output) {
  if (output.result.success) {
    return output.result.stderr.trim() || output.result.warning?.trim() ? "warning" : "success";
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
  (0, import_obsidian4.setIcon)(badge, kind === "success" ? "check-circle-2" : kind === "warning" ? "alert-triangle" : "x-circle");
  const title = header.createDiv({ cls: "loom-output-title" });
  title.setText(`${output.result.runnerName} \xB7 exit ${output.result.exitCode ?? "?"}`);
  const meta = header.createDiv({ cls: "loom-output-meta" });
  meta.setText(`${output.result.durationMs} ms \xB7 ${new Date(output.result.finishedAt).toLocaleTimeString()}`);
  const body = panel.createDiv({ cls: "loom-output-body" });
  if (output.result.stdout.trim()) {
    createStream(body, "Stdout", output.result.stdout);
  }
  if (output.result.warning?.trim()) {
    createStream(body, "Warning", output.result.warning);
  }
  if (output.result.stderr.trim()) {
    createStream(body, "Stderr", output.result.stderr);
  }
  if (!output.result.stdout.trim() && !output.result.warning?.trim() && !output.result.stderr.trim()) {
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
  (0, import_obsidian4.setIcon)(spinner, "loader-circle");
  const title = header.createDiv({ cls: "loom-output-title" });
  title.setText("Running");
  const meta = header.createDiv({ cls: "loom-output-meta" });
  meta.setText("Executing...");
  spinner.setAttribute("aria-hidden", "true");
  return panel;
}

// src/main.ts
var loomRefreshEffect = import_state.StateEffect.define();
var ExecutionConsentModal = class extends import_obsidian5.Modal {
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
var loomToolbarRenderChild = class extends import_obsidian5.MarkdownRenderChild {
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
    if (this.plugin.settings.pdfExportMode === "output") {
      this.codeElement.classList.add("loom-print-hide-code");
    }
    const hostClasses = ["loom-inline-output-host"];
    if (this.plugin.settings.pdfExportMode === "code") {
      hostClasses.push("loom-print-hide-output");
    }
    this.panelContainer = this.containerEl.createDiv({ cls: hostClasses.join(" ") });
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
var loomToolbarWidget = class extends import_view2.WidgetType {
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
var loomOutputWidget = class extends import_view2.WidgetType {
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
var loomPlugin = class extends import_obsidian5.Plugin {
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
      new ProofRunner(),
      new CustomLanguageRunner()
    ]);
    this.containerRunner = new loomContainerRunner(this.app, this.manifest.dir ?? ".obsidian/plugins/loom");
    this.registeredCodeBlockAliases = /* @__PURE__ */ new Set();
    this.outputs = /* @__PURE__ */ new Map();
    this.running = /* @__PURE__ */ new Map();
    this.outputListeners = /* @__PURE__ */ new Map();
    this.editorViews = /* @__PURE__ */ new Set();
    this.lastMarkdownFilePath = null;
  }
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new loomSettingTab(this));
    this.statusBarItemEl = this.addStatusBarItem();
    this.updateStatusBar();
    this.app.workspace.onLayoutReady(() => {
      this.lastMarkdownFilePath = this.getActiveMarkdownFile()?.path ?? this.lastMarkdownFilePath;
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
        const blocks = parseMarkdownCodeBlocks(file.path, editor.getValue(), this.settings);
        const block = findBlockAtLine(blocks, editor.getCursor().line);
        if (!block) {
          new import_obsidian5.Notice("No supported loom block at the current cursor.");
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
    this.registerCodeBlockProcessors();
    this.registerEditorExtension(this.createLivePreviewExtension());
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        this.lastMarkdownFilePath = file?.path ?? this.lastMarkdownFilePath;
        this.refreshAllViews();
        void this.enforceSourceModeForActiveView();
        if (file && this.settings.autoRunOnFileOpen) {
          void this.runAllBlocksInFile(file);
        }
      })
    );
    this.addCommand({
      id: "loom-validate-container-groups",
      name: "loom: Validate Container Groups",
      callback: async () => {
        const groups = await this.getContainerGroupSummaries();
        new import_obsidian5.Notice(groups.length ? groups.map((group) => `${group.name}: ${group.status}`).join("\n") : "No loom container groups found.", 8e3);
      }
    });
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.lastMarkdownFilePath = this.getActiveMarkdownFile()?.path ?? this.lastMarkdownFilePath;
        void this.enforceSourceModeForActiveView();
      })
    );
    this.registerEvent(
      this.app.workspace.on("editor-change", (_editor, ctx) => {
        if (ctx instanceof import_obsidian5.MarkdownView) {
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
    globalThis.loomRunOnWsl = this.settings.runOnWsl;
  }
  async saveSettings() {
    globalThis.loomRunOnWsl = this.settings.runOnWsl;
    await this.saveData(this.settings);
    this.registerCodeBlockProcessors();
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
          new import_obsidian5.Notice("Code copied");
        } catch {
          new import_obsidian5.Notice("Clipboard write failed.");
        }
      },
      onRemove: () => void this.removeSnippetById(block.id),
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
  async removeSnippetById(blockId) {
    const block = this.findActiveBlockById(blockId);
    if (!block) {
      return;
    }
    const file = this.app.vault.getAbstractFileByPath(block.filePath);
    if (!(file instanceof import_obsidian5.TFile)) {
      return;
    }
    this.running.get(blockId)?.abort();
    this.running.delete(blockId);
    this.outputs.delete(blockId);
    await this.app.vault.process(file, (content) => {
      const lines = content.split(/\r?\n/);
      const blocks = parseMarkdownCodeBlocks(file.path, content, this.settings);
      const currentBlock = blocks.find((candidate) => candidate.id === blockId);
      if (!currentBlock) {
        return content;
      }
      const managedRange = this.findManagedOutputRange(lines, blockId);
      const removalStart = currentBlock.startLine;
      const removalEnd = managedRange ? managedRange.end : currentBlock.endLine;
      lines.splice(removalStart, removalEnd - removalStart + 1);
      while (removalStart < lines.length - 1 && lines[removalStart] === "" && lines[removalStart + 1] === "") {
        lines.splice(removalStart, 1);
      }
      return lines.join("\n");
    });
    this.notifyOutputChanged(blockId);
    this.updateStatusBar();
    new import_obsidian5.Notice("loom snippet removed.");
  }
  async runAllBlocksInFile(file) {
    const source = await this.app.vault.cachedRead(file);
    const blocks = parseMarkdownCodeBlocks(file.path, source, this.settings);
    const containerGroup = this.containerRunner.getContainerGroupName(file);
    const supportedBlocks = containerGroup ? blocks : blocks.filter((block) => this.registry.getRunnerForBlock(block, this.settings));
    if (!supportedBlocks.length) {
      new import_obsidian5.Notice("No supported loom blocks found in the current note.");
      return;
    }
    for (const block of supportedBlocks) {
      await this.runBlock(file, block);
    }
  }
  async clearOutputsForFile(file) {
    const source = await this.app.vault.cachedRead(file);
    const blocks = parseMarkdownCodeBlocks(file.path, source, this.settings);
    for (const block of blocks) {
      this.outputs.delete(block.id);
      this.notifyOutputChanged(block.id);
      await this.removeManagedOutputBlock(file.path, block.id);
    }
    new import_obsidian5.Notice("loom outputs cleared.");
  }
  async runBlock(file, block) {
    this.lastMarkdownFilePath = file.path;
    if (this.running.has(block.id)) {
      new import_obsidian5.Notice("This loom block is already running.");
      return;
    }
    if (!await this.ensureExecutionEnabled()) {
      showExecutionDisabledNotice();
      return;
    }
    const workingDirectory = this.resolveWorkingDirectory(file);
    const containerGroup = this.containerRunner.getContainerGroupName(file);
    const runner = containerGroup ? null : this.registry.getRunnerForBlock(block, this.settings);
    if (!runner) {
      if (!containerGroup) {
        new import_obsidian5.Notice(`No configured runner for ${block.language}.`);
        return;
      }
    }
    const controller = new AbortController();
    const runContext = {
      file,
      workingDirectory,
      timeoutMs: this.settings.defaultTimeoutMs,
      signal: controller.signal
    };
    this.running.set(block.id, controller);
    this.notifyOutputChanged(block.id);
    this.updateStatusBar();
    try {
      const result = containerGroup ? await this.containerRunner.run(block, runContext, this.settings, containerGroup) : await runner.run(block, runContext, this.settings);
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
      const runnerName = containerGroup ? `container ${containerGroup}` : runner.displayName;
      new import_obsidian5.Notice(result.success ? `loom ran ${runnerName} block.` : `loom run failed for ${runnerName}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.outputs.set(block.id, {
        blockId: block.id,
        block,
        collapsed: false,
        visible: true,
        result: {
          runnerId: containerGroup ? `container:${containerGroup}` : runner?.id ?? "unknown",
          runnerName: containerGroup ? `Container ${containerGroup}` : runner?.displayName ?? "Unknown",
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
      new import_obsidian5.Notice(`loom error: ${message}`);
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
    const fileFolder = (0, import_path7.dirname)(file.path);
    const resolved = fileFolder === "." ? adapterBasePath : `${adapterBasePath}/${fileFolder}`;
    return resolved || process.cwd();
  }
  async getContainerGroupSummaries() {
    return this.containerRunner.getGroupSummaries();
  }
  async buildContainerGroup(name) {
    const controller = new AbortController();
    const result = await this.containerRunner.buildGroup(name, Math.max(this.settings.defaultTimeoutMs, 12e4), controller.signal);
    new import_obsidian5.Notice(result.success ? `loom built container group ${name}.` : `loom container build failed for ${name}.`, 8e3);
  }
  registerCodeBlockProcessors() {
    for (const alias of getSupportedLanguageAliases(this.settings)) {
      const normalizedAlias = alias.toLowerCase();
      if (this.registeredCodeBlockAliases.has(normalizedAlias)) {
        continue;
      }
      if (/[^a-zA-Z0-9_-]/.test(normalizedAlias)) {
        continue;
      }
      this.registeredCodeBlockAliases.add(normalizedAlias);
      this.registerMarkdownCodeBlockProcessor(normalizedAlias, async (source, el, ctx) => {
        const filePath = ctx.sourcePath;
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (!(file instanceof import_obsidian5.TFile)) {
          return;
        }
        const fullText = await this.app.vault.cachedRead(file);
        const blocks = parseMarkdownCodeBlocks(filePath, fullText, this.settings);
        const section = ctx && typeof ctx.getSectionInfo === "function" ? ctx.getSectionInfo(el) : null;
        let block;
        if (section) {
          const lineStart = section.lineStart;
          block = blocks.find((candidate) => candidate.startLine === lineStart && candidate.content === source);
        } else {
          block = blocks.find((candidate) => candidate.content === source);
        }
        if (!block) {
          return;
        }
        let pre = el.querySelector("pre");
        if (!pre) {
          pre = el.createEl("pre");
          pre.addClass(`language-${normalizedAlias}`);
          const code = pre.createEl("code");
          code.addClass(`language-${normalizedAlias}`);
          code.setText(source);
        }
        if (block.language === "llvm-ir") {
          const code = pre.querySelector("code") ?? pre;
          highlightLlvmElement(code, source);
        }
        ctx.addChild(new loomToolbarRenderChild(el, this, block, pre));
      });
    }
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
    const view = this.app.workspace.getActiveViewOfType(import_obsidian5.MarkdownView);
    return view?.file ?? null;
  }
  getCurrentEditorFilePath() {
    return this.getActiveMarkdownFile()?.path ?? this.lastMarkdownFilePath;
  }
  async enforceSourceModeForActiveView() {
    const view = this.app.workspace.getActiveViewOfType(import_obsidian5.MarkdownView);
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
    if (!(view instanceof import_obsidian5.MarkdownView) || !view.file) {
      return;
    }
    const source = view.editor?.getValue?.() ?? await this.app.vault.cachedRead(view.file);
    const blocks = parseMarkdownCodeBlocks(view.file.path, source, this.settings);
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
    const view = this.app.workspace.getActiveViewOfType(import_obsidian5.MarkdownView);
    const file = view?.file;
    const editor = view?.editor;
    if (!file || !editor) {
      return this.outputs.get(blockId)?.block ?? null;
    }
    const blocks = parseMarkdownCodeBlocks(file.path, editor.getValue(), this.settings);
    return blocks.find((block) => block.id === blockId) ?? this.outputs.get(blockId)?.block ?? null;
  }
  createLivePreviewExtension() {
    const plugin = this;
    return import_view2.ViewPlugin.fromClass(
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
          const filePath = plugin.getCurrentEditorFilePath();
          if (!filePath) {
            return import_view2.Decoration.none;
          }
          const source = this.view.state.doc.toString();
          const blocks = parseMarkdownCodeBlocks(filePath, source, plugin.settings);
          const builder = new import_state.RangeSetBuilder();
          for (const block of blocks) {
            const startLine = this.view.state.doc.line(block.startLine + 1);
            builder.add(
              startLine.from,
              startLine.from,
              import_view2.Decoration.widget({
                widget: new loomToolbarWidget(plugin, block),
                side: -1
              })
            );
            if (plugin.outputs.has(block.id) || plugin.running.has(block.id)) {
              const endLine = this.view.state.doc.line(block.endLine + 1);
              builder.add(
                endLine.to,
                endLine.to,
                import_view2.Decoration.widget({
                  widget: new loomOutputWidget(plugin, block.id),
                  side: 1
                })
              );
            }
            if (block.language === "llvm-ir") {
              addLlvmDecorations(builder, this.view, block);
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
      const blocks = parseMarkdownCodeBlocks(file.path, content, this.settings);
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
    if (!(file instanceof import_obsidian5.TFile)) {
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
      result.warning ? `warning:
${result.warning}` : "",
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL2V4ZWN1dGlvbi9jb250YWluZXJSdW5uZXIudHMiLCAic3JjL2V4ZWN1dGlvbi9wcm9jZXNzUnVubmVyLnRzIiwgInNyYy91dGlscy9jb21tYW5kLnRzIiwgInNyYy9sbHZtSGlnaGxpZ2h0LnRzIiwgInNyYy91dGlscy9oYXNoLnRzIiwgInNyYy9wYXJzZXIudHMiLCAic3JjL3J1bm5lcnMvbm9kZS50cyIsICJzcmMvcnVubmVycy9jdXN0b20udHMiLCAic3JjL3J1bm5lcnMvaW50ZXJwcmV0ZWQudHMiLCAic3JjL3J1bm5lcnMvbGx2bS50cyIsICJzcmMvcnVubmVycy9tYW5hZ2VkQ29tcGlsZWQudHMiLCAic3JjL3J1bm5lcnMvbmF0aXZlQ29tcGlsZWQudHMiLCAic3JjL3J1bm5lcnMvb2NhbWwudHMiLCAic3JjL3J1bm5lcnMvcHl0aG9uLnRzIiwgInNyYy9ydW5uZXJzL3Byb29mLnRzIiwgInNyYy9ydW5uZXJzL3JlZ2lzdHJ5LnRzIiwgInNyYy9zZXR0aW5ncy50cyIsICJzcmMvdWkvY29kZUJsb2NrVG9vbGJhci50cyIsICJzcmMvdWkvb3V0cHV0UGFuZWwudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7XHJcbiAgTWFya2Rvd25SZW5kZXJDaGlsZCxcclxuICBNYXJrZG93blZpZXcsXHJcbiAgTW9kYWwsXHJcbiAgTm90aWNlLFxyXG4gIFBsdWdpbixcclxuICBURmlsZSxcclxuICBXb3Jrc3BhY2VMZWFmLFxyXG59IGZyb20gXCJvYnNpZGlhblwiO1xyXG5pbXBvcnQgeyBSYW5nZVNldEJ1aWxkZXIsIFN0YXRlRWZmZWN0IH0gZnJvbSBcIkBjb2RlbWlycm9yL3N0YXRlXCI7XHJcbmltcG9ydCB7IERlY29yYXRpb24sIEVkaXRvclZpZXcsIFZpZXdQbHVnaW4sIFZpZXdVcGRhdGUsIFdpZGdldFR5cGUgfSBmcm9tIFwiQGNvZGVtaXJyb3Ivdmlld1wiO1xyXG5pbXBvcnQgeyBkaXJuYW1lIH0gZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IHsgbG9vbUNvbnRhaW5lclJ1bm5lciB9IGZyb20gXCIuL2V4ZWN1dGlvbi9jb250YWluZXJSdW5uZXJcIjtcclxuaW1wb3J0IHsgYWRkTGx2bURlY29yYXRpb25zLCBoaWdobGlnaHRMbHZtRWxlbWVudCB9IGZyb20gXCIuL2xsdm1IaWdobGlnaHRcIjtcclxuaW1wb3J0IHsgZmluZEJsb2NrQXRMaW5lLCBnZXRTdXBwb3J0ZWRMYW5ndWFnZUFsaWFzZXMsIHBhcnNlTWFya2Rvd25Db2RlQmxvY2tzIH0gZnJvbSBcIi4vcGFyc2VyXCI7XHJcbmltcG9ydCB7IE5vZGVSdW5uZXIgfSBmcm9tIFwiLi9ydW5uZXJzL25vZGVcIjtcclxuaW1wb3J0IHsgQ3VzdG9tTGFuZ3VhZ2VSdW5uZXIgfSBmcm9tIFwiLi9ydW5uZXJzL2N1c3RvbVwiO1xyXG5pbXBvcnQgeyBJbnRlcnByZXRlZFJ1bm5lciB9IGZyb20gXCIuL3J1bm5lcnMvaW50ZXJwcmV0ZWRcIjtcclxuaW1wb3J0IHsgTGx2bVJ1bm5lciB9IGZyb20gXCIuL3J1bm5lcnMvbGx2bVwiO1xyXG5pbXBvcnQgeyBNYW5hZ2VkQ29tcGlsZWRSdW5uZXIgfSBmcm9tIFwiLi9ydW5uZXJzL21hbmFnZWRDb21waWxlZFwiO1xyXG5pbXBvcnQgeyBOYXRpdmVDb21waWxlZFJ1bm5lciB9IGZyb20gXCIuL3J1bm5lcnMvbmF0aXZlQ29tcGlsZWRcIjtcclxuaW1wb3J0IHsgT2NhbWxSdW5uZXIgfSBmcm9tIFwiLi9ydW5uZXJzL29jYW1sXCI7XHJcbmltcG9ydCB7IFB5dGhvblJ1bm5lciB9IGZyb20gXCIuL3J1bm5lcnMvcHl0aG9uXCI7XHJcbmltcG9ydCB7IFByb29mUnVubmVyIH0gZnJvbSBcIi4vcnVubmVycy9wcm9vZlwiO1xyXG5pbXBvcnQgeyBsb29tUnVubmVyUmVnaXN0cnkgfSBmcm9tIFwiLi9ydW5uZXJzL3JlZ2lzdHJ5XCI7XHJcbmltcG9ydCB7IERFRkFVTFRfU0VUVElOR1MsIGxvb21TZXR0aW5nVGFiLCBzaG93RXhlY3V0aW9uRGlzYWJsZWROb3RpY2UgfSBmcm9tIFwiLi9zZXR0aW5nc1wiO1xyXG5pbXBvcnQgeyBjcmVhdGVDb2RlQmxvY2tUb29sYmFyIH0gZnJvbSBcIi4vdWkvY29kZUJsb2NrVG9vbGJhclwiO1xyXG5pbXBvcnQgeyBjcmVhdGVPdXRwdXRQYW5lbCwgY3JlYXRlUnVubmluZ1BhbmVsIH0gZnJvbSBcIi4vdWkvb3V0cHV0UGFuZWxcIjtcclxuaW1wb3J0IHR5cGUgeyBsb29tQ29kZUJsb2NrLCBsb29tUGx1Z2luU2V0dGluZ3MsIGxvb21TdG9yZWRPdXRwdXQgfSBmcm9tIFwiLi90eXBlc1wiO1xyXG5cclxuY29uc3QgbG9vbVJlZnJlc2hFZmZlY3QgPSBTdGF0ZUVmZmVjdC5kZWZpbmU8dm9pZD4oKTtcclxuXHJcbmNsYXNzIEV4ZWN1dGlvbkNvbnNlbnRNb2RhbCBleHRlbmRzIE1vZGFsIHtcclxuICBjb25zdHJ1Y3RvcihcclxuICAgIGFwcDogUGx1Z2luW1wiYXBwXCJdLFxyXG4gICAgcHJpdmF0ZSByZWFkb25seSBvbkNvbmZpcm06ICgpID0+IFByb21pc2U8dm9pZD4sXHJcbiAgKSB7XHJcbiAgICBzdXBlcihhcHApO1xyXG4gIH1cclxuXHJcbiAgb25PcGVuKCk6IHZvaWQge1xyXG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XHJcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcclxuICAgIGNvbnRlbnRFbC5jcmVhdGVFbChcImgyXCIsIHsgdGV4dDogXCJFbmFibGUgbG9vbSBsb2NhbCBleGVjdXRpb24/XCIgfSk7XHJcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoXCJwXCIsIHtcclxuICAgICAgdGV4dDogXCJsb29tIHJ1bnMgY29kZSBmcm9tIHlvdXIgbm90ZXMgb24geW91ciBsb2NhbCBtYWNoaW5lIHVzaW5nIHRoZSBjb25maWd1cmVkIGV4ZWN1dGFibGVzLiBJdCBkb2VzIG5vdCBzYW5kYm94IG9yIGlzb2xhdGUgdGhlIHByb2Nlc3MuXCIsXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBhY3Rpb25zID0gY29udGVudEVsLmNyZWF0ZURpdih7IGNsczogXCJsb29tLW1vZGFsLWFjdGlvbnNcIiB9KTtcclxuICAgIGNvbnN0IGNhbmNlbEJ1dHRvbiA9IGFjdGlvbnMuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIkNhbmNlbFwiIH0pO1xyXG4gICAgY29uc3QgZW5hYmxlQnV0dG9uID0gYWN0aW9ucy5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiRW5hYmxlIGFuZCBydW5cIiwgY2xzOiBcIm1vZC1jdGFcIiB9KTtcclxuXHJcbiAgICBjYW5jZWxCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHRoaXMuY2xvc2UoKSk7XHJcbiAgICBlbmFibGVCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGFzeW5jICgpID0+IHtcclxuICAgICAgYXdhaXQgdGhpcy5vbkNvbmZpcm0oKTtcclxuICAgICAgdGhpcy5jbG9zZSgpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcblxyXG5jbGFzcyBsb29tVG9vbGJhclJlbmRlckNoaWxkIGV4dGVuZHMgTWFya2Rvd25SZW5kZXJDaGlsZCB7XHJcbiAgcHJpdmF0ZSBwYW5lbENvbnRhaW5lcjogSFRNTERpdkVsZW1lbnQgfCBudWxsID0gbnVsbDtcclxuICBwcml2YXRlIHVucmVnaXN0ZXJPdXRwdXRMaXN0ZW5lcjogKCgpID0+IHZvaWQpIHwgbnVsbCA9IG51bGw7XHJcblxyXG4gIGNvbnN0cnVjdG9yKFxyXG4gICAgY29udGFpbmVyRWw6IEhUTUxFbGVtZW50LFxyXG4gICAgcHJpdmF0ZSByZWFkb25seSBwbHVnaW46IGxvb21QbHVnaW4sXHJcbiAgICBwcml2YXRlIHJlYWRvbmx5IGJsb2NrOiBsb29tQ29kZUJsb2NrLFxyXG4gICAgcHJpdmF0ZSByZWFkb25seSBjb2RlRWxlbWVudDogSFRNTEVsZW1lbnQsXHJcbiAgKSB7XHJcbiAgICBzdXBlcihjb250YWluZXJFbCk7XHJcbiAgfVxyXG5cclxuICBvbmxvYWQoKTogdm9pZCB7XHJcbiAgICB0aGlzLmNvZGVFbGVtZW50LnBhcmVudEVsZW1lbnQ/LmFkZENsYXNzKFwibG9vbS1jb2RlYmxvY2stc2hlbGxcIik7XHJcbiAgICB0aGlzLmNvZGVFbGVtZW50LnBhcmVudEVsZW1lbnQ/LmFwcGVuZENoaWxkKHRoaXMucGx1Z2luLmNyZWF0ZVRvb2xiYXJFbGVtZW50KHRoaXMuYmxvY2spKTtcclxuXHJcbiAgICBpZiAodGhpcy5wbHVnaW4uc2V0dGluZ3MucGRmRXhwb3J0TW9kZSA9PT0gXCJvdXRwdXRcIikge1xyXG4gICAgICB0aGlzLmNvZGVFbGVtZW50LmNsYXNzTGlzdC5hZGQoXCJsb29tLXByaW50LWhpZGUtY29kZVwiKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBob3N0Q2xhc3NlcyA9IFtcImxvb20taW5saW5lLW91dHB1dC1ob3N0XCJdO1xyXG4gICAgaWYgKHRoaXMucGx1Z2luLnNldHRpbmdzLnBkZkV4cG9ydE1vZGUgPT09IFwiY29kZVwiKSB7XHJcbiAgICAgIGhvc3RDbGFzc2VzLnB1c2goXCJsb29tLXByaW50LWhpZGUtb3V0cHV0XCIpO1xyXG4gICAgfVxyXG4gICAgdGhpcy5wYW5lbENvbnRhaW5lciA9IHRoaXMuY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiBob3N0Q2xhc3Nlcy5qb2luKFwiIFwiKSB9KTtcclxuXHJcbiAgICB0aGlzLnBsdWdpbi5yZW5kZXJPdXRwdXRJbnRvKHRoaXMuYmxvY2suaWQsIHRoaXMucGFuZWxDb250YWluZXIpO1xyXG4gICAgdGhpcy51bnJlZ2lzdGVyT3V0cHV0TGlzdGVuZXIgPSB0aGlzLnBsdWdpbi5yZWdpc3Rlck91dHB1dExpc3RlbmVyKHRoaXMuYmxvY2suaWQsICgpID0+IHtcclxuICAgICAgaWYgKHRoaXMucGFuZWxDb250YWluZXIpIHtcclxuICAgICAgICB0aGlzLnBsdWdpbi5yZW5kZXJPdXRwdXRJbnRvKHRoaXMuYmxvY2suaWQsIHRoaXMucGFuZWxDb250YWluZXIpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIG9udW5sb2FkKCk6IHZvaWQge1xyXG4gICAgdGhpcy51bnJlZ2lzdGVyT3V0cHV0TGlzdGVuZXI/LigpO1xyXG4gIH1cclxufVxyXG5cclxuY2xhc3MgbG9vbVRvb2xiYXJXaWRnZXQgZXh0ZW5kcyBXaWRnZXRUeXBlIHtcclxuICBjb25zdHJ1Y3RvcihcclxuICAgIHByaXZhdGUgcmVhZG9ubHkgcGx1Z2luOiBsb29tUGx1Z2luLFxyXG4gICAgcHJpdmF0ZSByZWFkb25seSBibG9jazogbG9vbUNvZGVCbG9jayxcclxuICApIHtcclxuICAgIHN1cGVyKCk7XHJcbiAgfVxyXG5cclxuICBlcShvdGhlcjogbG9vbVRvb2xiYXJXaWRnZXQpOiBib29sZWFuIHtcclxuICAgIHJldHVybiBvdGhlci5ibG9jay5pZCA9PT0gdGhpcy5ibG9jay5pZCAmJiBvdGhlci5wbHVnaW4uaXNCbG9ja1J1bm5pbmcodGhpcy5ibG9jay5pZCkgPT09IHRoaXMucGx1Z2luLmlzQmxvY2tSdW5uaW5nKHRoaXMuYmxvY2suaWQpO1xyXG4gIH1cclxuXHJcbiAgdG9ET00oKTogSFRNTEVsZW1lbnQge1xyXG4gICAgcmV0dXJuIHRoaXMucGx1Z2luLmNyZWF0ZVRvb2xiYXJFbGVtZW50KHRoaXMuYmxvY2spO1xyXG4gIH1cclxufVxyXG5cclxuY2xhc3MgbG9vbU91dHB1dFdpZGdldCBleHRlbmRzIFdpZGdldFR5cGUge1xyXG4gIGNvbnN0cnVjdG9yKFxyXG4gICAgcHJpdmF0ZSByZWFkb25seSBwbHVnaW46IGxvb21QbHVnaW4sXHJcbiAgICBwcml2YXRlIHJlYWRvbmx5IGJsb2NrSWQ6IHN0cmluZyxcclxuICApIHtcclxuICAgIHN1cGVyKCk7XHJcbiAgfVxyXG5cclxuICBlcShvdGhlcjogbG9vbU91dHB1dFdpZGdldCk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG4gIH1cclxuXHJcbiAgdG9ET00oKTogSFRNTEVsZW1lbnQge1xyXG4gICAgY29uc3Qgd3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgICB3cmFwcGVyLmNsYXNzTmFtZSA9IFwibG9vbS1pbmxpbmUtb3V0cHV0LWhvc3RcIjtcclxuICAgIHRoaXMucGx1Z2luLnJlbmRlck91dHB1dEludG8odGhpcy5ibG9ja0lkLCB3cmFwcGVyKTtcclxuICAgIHJldHVybiB3cmFwcGVyO1xyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgbG9vbVBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XHJcbiAgc2V0dGluZ3M6IGxvb21QbHVnaW5TZXR0aW5ncyA9IERFRkFVTFRfU0VUVElOR1M7XHJcbiAgcmVhZG9ubHkgcmVnaXN0cnkgPSBuZXcgbG9vbVJ1bm5lclJlZ2lzdHJ5KFtcclxuICAgIG5ldyBQeXRob25SdW5uZXIoKSxcclxuICAgIG5ldyBOb2RlUnVubmVyKCksXHJcbiAgICBuZXcgT2NhbWxSdW5uZXIoKSxcclxuICAgIG5ldyBOYXRpdmVDb21waWxlZFJ1bm5lcigpLFxyXG4gICAgbmV3IEludGVycHJldGVkUnVubmVyKCksXHJcbiAgICBuZXcgTWFuYWdlZENvbXBpbGVkUnVubmVyKCksXHJcbiAgICBuZXcgTGx2bVJ1bm5lcigpLFxyXG4gICAgbmV3IFByb29mUnVubmVyKCksXHJcbiAgICBuZXcgQ3VzdG9tTGFuZ3VhZ2VSdW5uZXIoKSxcclxuICBdKTtcclxuICBwcml2YXRlIHJlYWRvbmx5IGNvbnRhaW5lclJ1bm5lciA9IG5ldyBsb29tQ29udGFpbmVyUnVubmVyKHRoaXMuYXBwLCB0aGlzLm1hbmlmZXN0LmRpciA/PyBcIi5vYnNpZGlhbi9wbHVnaW5zL2xvb21cIik7XHJcbiAgcHJpdmF0ZSByZWFkb25seSByZWdpc3RlcmVkQ29kZUJsb2NrQWxpYXNlcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgb3V0cHV0cyA9IG5ldyBNYXA8c3RyaW5nLCBsb29tU3RvcmVkT3V0cHV0PigpO1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgcnVubmluZyA9IG5ldyBNYXA8c3RyaW5nLCBBYm9ydENvbnRyb2xsZXI+KCk7XHJcbiAgcHJpdmF0ZSByZWFkb25seSBvdXRwdXRMaXN0ZW5lcnMgPSBuZXcgTWFwPHN0cmluZywgU2V0PCgpID0+IHZvaWQ+PigpO1xyXG4gIHByaXZhdGUgc3RhdHVzQmFySXRlbUVsITogSFRNTEVsZW1lbnQ7XHJcbiAgcHJpdmF0ZSBlZGl0b3JWaWV3cyA9IG5ldyBTZXQ8RWRpdG9yVmlldz4oKTtcclxuICBwcml2YXRlIGxhc3RNYXJrZG93bkZpbGVQYXRoOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcclxuXHJcbiAgYXN5bmMgb25sb2FkKCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcclxuICAgIHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgbG9vbVNldHRpbmdUYWIodGhpcykpO1xyXG4gICAgdGhpcy5zdGF0dXNCYXJJdGVtRWwgPSB0aGlzLmFkZFN0YXR1c0Jhckl0ZW0oKTtcclxuICAgIHRoaXMudXBkYXRlU3RhdHVzQmFyKCk7XHJcbiAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub25MYXlvdXRSZWFkeSgoKSA9PiB7XHJcbiAgICAgIHRoaXMubGFzdE1hcmtkb3duRmlsZVBhdGggPSB0aGlzLmdldEFjdGl2ZU1hcmtkb3duRmlsZSgpPy5wYXRoID8/IHRoaXMubGFzdE1hcmtkb3duRmlsZVBhdGg7XHJcbiAgICAgIHZvaWQgdGhpcy5lbmZvcmNlU291cmNlTW9kZUZvckFjdGl2ZVZpZXcoKTtcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XHJcbiAgICAgIGlkOiBcImxvb20tcnVuLWN1cnJlbnQtY29kZS1ibG9ja1wiLFxyXG4gICAgICBuYW1lOiBcImxvb206IFJ1biBDdXJyZW50IENvZGUgQmxvY2tcIixcclxuICAgICAgZWRpdG9yQ2FsbGJhY2s6IGFzeW5jIChlZGl0b3IsIHZpZXcpID0+IHtcclxuICAgICAgICBjb25zdCBmaWxlID0gdmlldy5maWxlO1xyXG4gICAgICAgIGlmICghZmlsZSkge1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgYmxvY2tzID0gcGFyc2VNYXJrZG93bkNvZGVCbG9ja3MoZmlsZS5wYXRoLCBlZGl0b3IuZ2V0VmFsdWUoKSwgdGhpcy5zZXR0aW5ncyk7XHJcbiAgICAgICAgY29uc3QgYmxvY2sgPSBmaW5kQmxvY2tBdExpbmUoYmxvY2tzLCBlZGl0b3IuZ2V0Q3Vyc29yKCkubGluZSk7XHJcbiAgICAgICAgaWYgKCFibG9jaykge1xyXG4gICAgICAgICAgbmV3IE5vdGljZShcIk5vIHN1cHBvcnRlZCBsb29tIGJsb2NrIGF0IHRoZSBjdXJyZW50IGN1cnNvci5cIik7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGF3YWl0IHRoaXMucnVuQmxvY2soZmlsZSwgYmxvY2spO1xyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcclxuICAgICAgaWQ6IFwibG9vbS1ydW4tYWxsLWNvZGUtYmxvY2tzXCIsXHJcbiAgICAgIG5hbWU6IFwibG9vbTogUnVuIEFsbCBTdXBwb3J0ZWQgQ29kZSBCbG9ja3MgaW4gQ3VycmVudCBOb3RlXCIsXHJcbiAgICAgIGNoZWNrQ2FsbGJhY2s6IChjaGVja2luZykgPT4ge1xyXG4gICAgICAgIGNvbnN0IGZpbGUgPSB0aGlzLmdldEFjdGl2ZU1hcmtkb3duRmlsZSgpO1xyXG4gICAgICAgIGlmICghZmlsZSkge1xyXG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoIWNoZWNraW5nKSB7XHJcbiAgICAgICAgICB2b2lkIHRoaXMucnVuQWxsQmxvY2tzSW5GaWxlKGZpbGUpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XHJcbiAgICAgIGlkOiBcImxvb20tY2xlYXItbm90ZS1vdXRwdXRzXCIsXHJcbiAgICAgIG5hbWU6IFwibG9vbTogQ2xlYXIgbG9vbSBPdXRwdXRzIGluIEN1cnJlbnQgTm90ZVwiLFxyXG4gICAgICBjaGVja0NhbGxiYWNrOiAoY2hlY2tpbmcpID0+IHtcclxuICAgICAgICBjb25zdCBmaWxlID0gdGhpcy5nZXRBY3RpdmVNYXJrZG93bkZpbGUoKTtcclxuICAgICAgICBpZiAoIWZpbGUpIHtcclxuICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKCFjaGVja2luZykge1xyXG4gICAgICAgICAgdm9pZCB0aGlzLmNsZWFyT3V0cHV0c0ZvckZpbGUoZmlsZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5yZWdpc3RlckNvZGVCbG9ja1Byb2Nlc3NvcnMoKTtcclxuXHJcbiAgICB0aGlzLnJlZ2lzdGVyRWRpdG9yRXh0ZW5zaW9uKHRoaXMuY3JlYXRlTGl2ZVByZXZpZXdFeHRlbnNpb24oKSk7XHJcblxyXG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KFxyXG4gICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub24oXCJmaWxlLW9wZW5cIiwgKGZpbGUpID0+IHtcclxuICAgICAgICB0aGlzLmxhc3RNYXJrZG93bkZpbGVQYXRoID0gZmlsZT8ucGF0aCA/PyB0aGlzLmxhc3RNYXJrZG93bkZpbGVQYXRoO1xyXG4gICAgICAgIHRoaXMucmVmcmVzaEFsbFZpZXdzKCk7XHJcbiAgICAgICAgdm9pZCB0aGlzLmVuZm9yY2VTb3VyY2VNb2RlRm9yQWN0aXZlVmlldygpO1xyXG4gICAgICAgIGlmIChmaWxlICYmIHRoaXMuc2V0dGluZ3MuYXV0b1J1bk9uRmlsZU9wZW4pIHtcclxuICAgICAgICAgIHZvaWQgdGhpcy5ydW5BbGxCbG9ja3NJbkZpbGUoZmlsZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KSxcclxuICAgICk7XHJcblxyXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcclxuICAgICAgaWQ6IFwibG9vbS12YWxpZGF0ZS1jb250YWluZXItZ3JvdXBzXCIsXHJcbiAgICAgIG5hbWU6IFwibG9vbTogVmFsaWRhdGUgQ29udGFpbmVyIEdyb3Vwc1wiLFxyXG4gICAgICBjYWxsYmFjazogYXN5bmMgKCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IGdyb3VwcyA9IGF3YWl0IHRoaXMuZ2V0Q29udGFpbmVyR3JvdXBTdW1tYXJpZXMoKTtcclxuICAgICAgICBuZXcgTm90aWNlKGdyb3Vwcy5sZW5ndGggPyBncm91cHMubWFwKChncm91cCkgPT4gYCR7Z3JvdXAubmFtZX06ICR7Z3JvdXAuc3RhdHVzfWApLmpvaW4oXCJcXG5cIikgOiBcIk5vIGxvb20gY29udGFpbmVyIGdyb3VwcyBmb3VuZC5cIiwgODAwMCk7XHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQoXHJcbiAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbihcImFjdGl2ZS1sZWFmLWNoYW5nZVwiLCAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5sYXN0TWFya2Rvd25GaWxlUGF0aCA9IHRoaXMuZ2V0QWN0aXZlTWFya2Rvd25GaWxlKCk/LnBhdGggPz8gdGhpcy5sYXN0TWFya2Rvd25GaWxlUGF0aDtcclxuICAgICAgICB2b2lkIHRoaXMuZW5mb3JjZVNvdXJjZU1vZGVGb3JBY3RpdmVWaWV3KCk7XHJcbiAgICAgIH0pLFxyXG4gICAgKTtcclxuXHJcbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQoXHJcbiAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbihcImVkaXRvci1jaGFuZ2VcIiwgKF9lZGl0b3IsIGN0eCkgPT4ge1xyXG4gICAgICAgIGlmIChjdHggaW5zdGFuY2VvZiBNYXJrZG93blZpZXcpIHtcclxuICAgICAgICAgIHZvaWQgdGhpcy5lbmZvcmNlU291cmNlTW9kZUZvckxlYWYoY3R4LmxlYWYpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSksXHJcbiAgICApO1xyXG4gIH1cclxuXHJcbiAgb251bmxvYWQoKTogdm9pZCB7XHJcbiAgICBmb3IgKGNvbnN0IGNvbnRyb2xsZXIgb2YgdGhpcy5ydW5uaW5nLnZhbHVlcygpKSB7XHJcbiAgICAgIGNvbnRyb2xsZXIuYWJvcnQoKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGFzeW5jIGxvYWRTZXR0aW5ncygpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIHRoaXMuc2V0dGluZ3MgPSB7XHJcbiAgICAgIC4uLkRFRkFVTFRfU0VUVElOR1MsXHJcbiAgICAgIC4uLihhd2FpdCB0aGlzLmxvYWREYXRhKCkpLFxyXG4gICAgfTtcclxuICAgIChnbG9iYWxUaGlzIGFzIGFueSkubG9vbVJ1bk9uV3NsID0gdGhpcy5zZXR0aW5ncy5ydW5PbldzbDtcclxuICB9XHJcblxyXG4gIGFzeW5jIHNhdmVTZXR0aW5ncygpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIChnbG9iYWxUaGlzIGFzIGFueSkubG9vbVJ1bk9uV3NsID0gdGhpcy5zZXR0aW5ncy5ydW5PbldzbDtcclxuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XHJcbiAgICB0aGlzLnJlZ2lzdGVyQ29kZUJsb2NrUHJvY2Vzc29ycygpO1xyXG4gICAgdGhpcy5yZWZyZXNoQWxsVmlld3MoKTtcclxuICB9XHJcblxyXG4gIGlzQmxvY2tSdW5uaW5nKGJsb2NrSWQ6IHN0cmluZyk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIHRoaXMucnVubmluZy5oYXMoYmxvY2tJZCk7XHJcbiAgfVxyXG5cclxuICByZWdpc3Rlck91dHB1dExpc3RlbmVyKGJsb2NrSWQ6IHN0cmluZywgbGlzdGVuZXI6ICgpID0+IHZvaWQpOiAoKSA9PiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5vdXRwdXRMaXN0ZW5lcnMuaGFzKGJsb2NrSWQpKSB7XHJcbiAgICAgIHRoaXMub3V0cHV0TGlzdGVuZXJzLnNldChibG9ja0lkLCBuZXcgU2V0KCkpO1xyXG4gICAgfVxyXG4gICAgdGhpcy5vdXRwdXRMaXN0ZW5lcnMuZ2V0KGJsb2NrSWQpPy5hZGQobGlzdGVuZXIpO1xyXG4gICAgcmV0dXJuICgpID0+IHtcclxuICAgICAgdGhpcy5vdXRwdXRMaXN0ZW5lcnMuZ2V0KGJsb2NrSWQpPy5kZWxldGUobGlzdGVuZXIpO1xyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIGNyZWF0ZVRvb2xiYXJFbGVtZW50KGJsb2NrOiBsb29tQ29kZUJsb2NrKTogSFRNTEVsZW1lbnQge1xyXG4gICAgcmV0dXJuIGNyZWF0ZUNvZGVCbG9ja1Rvb2xiYXIoYmxvY2suaWQsIHRoaXMuaXNCbG9ja1J1bm5pbmcoYmxvY2suaWQpLCB7XHJcbiAgICAgIG9uUnVuOiAoKSA9PiB2b2lkIHRoaXMucnVuQWN0aXZlQmxvY2tCeUlkKGJsb2NrLmlkKSxcclxuICAgICAgb25Db3B5OiBhc3luYyAoKSA9PiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIGF3YWl0IG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KGJsb2NrLmNvbnRlbnQpO1xyXG4gICAgICAgICAgbmV3IE5vdGljZShcIkNvZGUgY29waWVkXCIpO1xyXG4gICAgICAgIH0gY2F0Y2gge1xyXG4gICAgICAgICAgbmV3IE5vdGljZShcIkNsaXBib2FyZCB3cml0ZSBmYWlsZWQuXCIpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSxcclxuICAgICAgb25SZW1vdmU6ICgpID0+IHZvaWQgdGhpcy5yZW1vdmVTbmlwcGV0QnlJZChibG9jay5pZCksXHJcbiAgICAgIG9uVG9nZ2xlT3V0cHV0OiAoKSA9PiB7XHJcbiAgICAgICAgY29uc3Qgb3V0cHV0ID0gdGhpcy5vdXRwdXRzLmdldChibG9jay5pZCk7XHJcbiAgICAgICAgaWYgKCFvdXRwdXQpIHtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgb3V0cHV0LnZpc2libGUgPSAhb3V0cHV0LnZpc2libGU7XHJcbiAgICAgICAgdGhpcy5ub3RpZnlPdXRwdXRDaGFuZ2VkKGJsb2NrLmlkKTtcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcmVuZGVyT3V0cHV0SW50byhibG9ja0lkOiBzdHJpbmcsIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcclxuICAgIGNvbnRhaW5lci5lbXB0eSgpO1xyXG5cclxuICAgIGNvbnN0IG91dHB1dCA9IHRoaXMub3V0cHV0cy5nZXQoYmxvY2tJZCk7XHJcbiAgICBpZiAodGhpcy5ydW5uaW5nLmhhcyhibG9ja0lkKSkge1xyXG4gICAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQoY3JlYXRlUnVubmluZ1BhbmVsKCkpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCFvdXRwdXQgfHwgIW91dHB1dC52aXNpYmxlKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQoY3JlYXRlT3V0cHV0UGFuZWwob3V0cHV0KSk7XHJcbiAgfVxyXG5cclxuICBhc3luYyBydW5BY3RpdmVCbG9ja0J5SWQoYmxvY2tJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBibG9jayA9IHRoaXMuZmluZEFjdGl2ZUJsb2NrQnlJZChibG9ja0lkKTtcclxuICAgIGNvbnN0IGZpbGUgPSB0aGlzLmdldEFjdGl2ZU1hcmtkb3duRmlsZSgpO1xyXG4gICAgaWYgKCFibG9jayB8fCAhZmlsZSkge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBhd2FpdCB0aGlzLnJ1bkJsb2NrKGZpbGUsIGJsb2NrKTtcclxuICB9XHJcblxyXG4gIGFzeW5jIHJlbW92ZVNuaXBwZXRCeUlkKGJsb2NrSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgYmxvY2sgPSB0aGlzLmZpbmRBY3RpdmVCbG9ja0J5SWQoYmxvY2tJZCk7XHJcbiAgICBpZiAoIWJsb2NrKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGJsb2NrLmZpbGVQYXRoKTtcclxuICAgIGlmICghKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMucnVubmluZy5nZXQoYmxvY2tJZCk/LmFib3J0KCk7XHJcbiAgICB0aGlzLnJ1bm5pbmcuZGVsZXRlKGJsb2NrSWQpO1xyXG4gICAgdGhpcy5vdXRwdXRzLmRlbGV0ZShibG9ja0lkKTtcclxuXHJcbiAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5wcm9jZXNzKGZpbGUsIChjb250ZW50KSA9PiB7XHJcbiAgICAgIGNvbnN0IGxpbmVzID0gY29udGVudC5zcGxpdCgvXFxyP1xcbi8pO1xyXG4gICAgICBjb25zdCBibG9ja3MgPSBwYXJzZU1hcmtkb3duQ29kZUJsb2NrcyhmaWxlLnBhdGgsIGNvbnRlbnQsIHRoaXMuc2V0dGluZ3MpO1xyXG4gICAgICBjb25zdCBjdXJyZW50QmxvY2sgPSBibG9ja3MuZmluZCgoY2FuZGlkYXRlKSA9PiBjYW5kaWRhdGUuaWQgPT09IGJsb2NrSWQpO1xyXG4gICAgICBpZiAoIWN1cnJlbnRCbG9jaykge1xyXG4gICAgICAgIHJldHVybiBjb250ZW50O1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCBtYW5hZ2VkUmFuZ2UgPSB0aGlzLmZpbmRNYW5hZ2VkT3V0cHV0UmFuZ2UobGluZXMsIGJsb2NrSWQpO1xyXG4gICAgICBjb25zdCByZW1vdmFsU3RhcnQgPSBjdXJyZW50QmxvY2suc3RhcnRMaW5lO1xyXG4gICAgICBjb25zdCByZW1vdmFsRW5kID0gbWFuYWdlZFJhbmdlID8gbWFuYWdlZFJhbmdlLmVuZCA6IGN1cnJlbnRCbG9jay5lbmRMaW5lO1xyXG4gICAgICBsaW5lcy5zcGxpY2UocmVtb3ZhbFN0YXJ0LCByZW1vdmFsRW5kIC0gcmVtb3ZhbFN0YXJ0ICsgMSk7XHJcblxyXG4gICAgICB3aGlsZSAocmVtb3ZhbFN0YXJ0IDwgbGluZXMubGVuZ3RoIC0gMSAmJiBsaW5lc1tyZW1vdmFsU3RhcnRdID09PSBcIlwiICYmIGxpbmVzW3JlbW92YWxTdGFydCArIDFdID09PSBcIlwiKSB7XHJcbiAgICAgICAgbGluZXMuc3BsaWNlKHJlbW92YWxTdGFydCwgMSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHJldHVybiBsaW5lcy5qb2luKFwiXFxuXCIpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5ub3RpZnlPdXRwdXRDaGFuZ2VkKGJsb2NrSWQpO1xyXG4gICAgdGhpcy51cGRhdGVTdGF0dXNCYXIoKTtcclxuICAgIG5ldyBOb3RpY2UoXCJsb29tIHNuaXBwZXQgcmVtb3ZlZC5cIik7XHJcbiAgfVxyXG5cclxuICBhc3luYyBydW5BbGxCbG9ja3NJbkZpbGUoZmlsZTogVEZpbGUpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IHNvdXJjZSA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNhY2hlZFJlYWQoZmlsZSk7XHJcbiAgICBjb25zdCBibG9ja3MgPSBwYXJzZU1hcmtkb3duQ29kZUJsb2NrcyhmaWxlLnBhdGgsIHNvdXJjZSwgdGhpcy5zZXR0aW5ncyk7XHJcbiAgICBjb25zdCBjb250YWluZXJHcm91cCA9IHRoaXMuY29udGFpbmVyUnVubmVyLmdldENvbnRhaW5lckdyb3VwTmFtZShmaWxlKTtcclxuICAgIGNvbnN0IHN1cHBvcnRlZEJsb2NrcyA9IGNvbnRhaW5lckdyb3VwID8gYmxvY2tzIDogYmxvY2tzLmZpbHRlcigoYmxvY2spID0+IHRoaXMucmVnaXN0cnkuZ2V0UnVubmVyRm9yQmxvY2soYmxvY2ssIHRoaXMuc2V0dGluZ3MpKTtcclxuXHJcbiAgICBpZiAoIXN1cHBvcnRlZEJsb2Nrcy5sZW5ndGgpIHtcclxuICAgICAgbmV3IE5vdGljZShcIk5vIHN1cHBvcnRlZCBsb29tIGJsb2NrcyBmb3VuZCBpbiB0aGUgY3VycmVudCBub3RlLlwiKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGZvciAoY29uc3QgYmxvY2sgb2Ygc3VwcG9ydGVkQmxvY2tzKSB7XHJcbiAgICAgIGF3YWl0IHRoaXMucnVuQmxvY2soZmlsZSwgYmxvY2spO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgYXN5bmMgY2xlYXJPdXRwdXRzRm9yRmlsZShmaWxlOiBURmlsZSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3Qgc291cmNlID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuY2FjaGVkUmVhZChmaWxlKTtcclxuICAgIGNvbnN0IGJsb2NrcyA9IHBhcnNlTWFya2Rvd25Db2RlQmxvY2tzKGZpbGUucGF0aCwgc291cmNlLCB0aGlzLnNldHRpbmdzKTtcclxuICAgIGZvciAoY29uc3QgYmxvY2sgb2YgYmxvY2tzKSB7XHJcbiAgICAgIHRoaXMub3V0cHV0cy5kZWxldGUoYmxvY2suaWQpO1xyXG4gICAgICB0aGlzLm5vdGlmeU91dHB1dENoYW5nZWQoYmxvY2suaWQpO1xyXG4gICAgICBhd2FpdCB0aGlzLnJlbW92ZU1hbmFnZWRPdXRwdXRCbG9jayhmaWxlLnBhdGgsIGJsb2NrLmlkKTtcclxuICAgIH1cclxuICAgIG5ldyBOb3RpY2UoXCJsb29tIG91dHB1dHMgY2xlYXJlZC5cIik7XHJcbiAgfVxyXG5cclxuICBhc3luYyBydW5CbG9jayhmaWxlOiBURmlsZSwgYmxvY2s6IGxvb21Db2RlQmxvY2spOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIHRoaXMubGFzdE1hcmtkb3duRmlsZVBhdGggPSBmaWxlLnBhdGg7XHJcbiAgICBpZiAodGhpcy5ydW5uaW5nLmhhcyhibG9jay5pZCkpIHtcclxuICAgICAgbmV3IE5vdGljZShcIlRoaXMgbG9vbSBibG9jayBpcyBhbHJlYWR5IHJ1bm5pbmcuXCIpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCEoYXdhaXQgdGhpcy5lbnN1cmVFeGVjdXRpb25FbmFibGVkKCkpKSB7XHJcbiAgICAgIHNob3dFeGVjdXRpb25EaXNhYmxlZE5vdGljZSgpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3Qgd29ya2luZ0RpcmVjdG9yeSA9IHRoaXMucmVzb2x2ZVdvcmtpbmdEaXJlY3RvcnkoZmlsZSk7XHJcbiAgICBjb25zdCBjb250YWluZXJHcm91cCA9IHRoaXMuY29udGFpbmVyUnVubmVyLmdldENvbnRhaW5lckdyb3VwTmFtZShmaWxlKTtcclxuICAgIGNvbnN0IHJ1bm5lciA9IGNvbnRhaW5lckdyb3VwID8gbnVsbCA6IHRoaXMucmVnaXN0cnkuZ2V0UnVubmVyRm9yQmxvY2soYmxvY2ssIHRoaXMuc2V0dGluZ3MpO1xyXG4gICAgaWYgKCFydW5uZXIpIHtcclxuICAgICAgaWYgKCFjb250YWluZXJHcm91cCkge1xyXG4gICAgICAgIG5ldyBOb3RpY2UoYE5vIGNvbmZpZ3VyZWQgcnVubmVyIGZvciAke2Jsb2NrLmxhbmd1YWdlfS5gKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xyXG4gICAgY29uc3QgcnVuQ29udGV4dCA9IHtcclxuICAgICAgZmlsZSxcclxuICAgICAgd29ya2luZ0RpcmVjdG9yeSxcclxuICAgICAgdGltZW91dE1zOiB0aGlzLnNldHRpbmdzLmRlZmF1bHRUaW1lb3V0TXMsXHJcbiAgICAgIHNpZ25hbDogY29udHJvbGxlci5zaWduYWwsXHJcbiAgICB9O1xyXG4gICAgdGhpcy5ydW5uaW5nLnNldChibG9jay5pZCwgY29udHJvbGxlcik7XHJcbiAgICB0aGlzLm5vdGlmeU91dHB1dENoYW5nZWQoYmxvY2suaWQpO1xyXG4gICAgdGhpcy51cGRhdGVTdGF0dXNCYXIoKTtcclxuXHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCByZXN1bHQgPSBjb250YWluZXJHcm91cFxyXG4gICAgICAgID8gYXdhaXQgdGhpcy5jb250YWluZXJSdW5uZXIucnVuKGJsb2NrLCBydW5Db250ZXh0LCB0aGlzLnNldHRpbmdzLCBjb250YWluZXJHcm91cClcclxuICAgICAgICA6IGF3YWl0IHJ1bm5lciEucnVuKGJsb2NrLCBydW5Db250ZXh0LCB0aGlzLnNldHRpbmdzKTtcclxuXHJcbiAgICAgIGlmIChyZXN1bHQudGltZWRPdXQpIHtcclxuICAgICAgICByZXN1bHQuc3RkZXJyID0gcmVzdWx0LnN0ZGVyciB8fCBgRXhlY3V0aW9uIHRpbWVkIG91dCBhZnRlciAke3RoaXMuc2V0dGluZ3MuZGVmYXVsdFRpbWVvdXRNc30gbXMuYDtcclxuICAgICAgfSBlbHNlIGlmIChyZXN1bHQuY2FuY2VsbGVkKSB7XHJcbiAgICAgICAgcmVzdWx0LnN0ZGVyciA9IHJlc3VsdC5zdGRlcnIgfHwgXCJFeGVjdXRpb24gY2FuY2VsbGVkLlwiO1xyXG4gICAgICB9IGVsc2UgaWYgKCFyZXN1bHQuc3VjY2VzcyAmJiAhcmVzdWx0LnN0ZGVyci50cmltKCkpIHtcclxuICAgICAgICByZXN1bHQuc3RkZXJyID0gXCJQcm9jZXNzIGV4aXRlZCB1bnN1Y2Nlc3NmdWxseS5cIjtcclxuICAgICAgfVxyXG5cclxuICAgICAgdGhpcy5vdXRwdXRzLnNldChibG9jay5pZCwge1xyXG4gICAgICAgIGJsb2NrSWQ6IGJsb2NrLmlkLFxyXG4gICAgICAgIGJsb2NrLFxyXG4gICAgICAgIHJlc3VsdCxcclxuICAgICAgICBjb2xsYXBzZWQ6IGZhbHNlLFxyXG4gICAgICAgIHZpc2libGU6IHRydWUsXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgaWYgKHRoaXMuc2V0dGluZ3Mud3JpdGVPdXRwdXRUb05vdGUpIHtcclxuICAgICAgICBhd2FpdCB0aGlzLndyaXRlTWFuYWdlZE91dHB1dEJsb2NrKGZpbGUsIGJsb2NrLCByZXN1bHQpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCBydW5uZXJOYW1lID0gY29udGFpbmVyR3JvdXAgPyBgY29udGFpbmVyICR7Y29udGFpbmVyR3JvdXB9YCA6IHJ1bm5lciEuZGlzcGxheU5hbWU7XHJcbiAgICAgIG5ldyBOb3RpY2UocmVzdWx0LnN1Y2Nlc3MgPyBgbG9vbSByYW4gJHtydW5uZXJOYW1lfSBibG9jay5gIDogYGxvb20gcnVuIGZhaWxlZCBmb3IgJHtydW5uZXJOYW1lfS5gKTtcclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIGNvbnN0IG1lc3NhZ2UgPSBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcik7XHJcbiAgICAgIHRoaXMub3V0cHV0cy5zZXQoYmxvY2suaWQsIHtcclxuICAgICAgICBibG9ja0lkOiBibG9jay5pZCxcclxuICAgICAgICBibG9jayxcclxuICAgICAgICBjb2xsYXBzZWQ6IGZhbHNlLFxyXG4gICAgICAgIHZpc2libGU6IHRydWUsXHJcbiAgICAgICAgcmVzdWx0OiB7XHJcbiAgICAgICAgICBydW5uZXJJZDogY29udGFpbmVyR3JvdXAgPyBgY29udGFpbmVyOiR7Y29udGFpbmVyR3JvdXB9YCA6IHJ1bm5lcj8uaWQgPz8gXCJ1bmtub3duXCIsXHJcbiAgICAgICAgICBydW5uZXJOYW1lOiBjb250YWluZXJHcm91cCA/IGBDb250YWluZXIgJHtjb250YWluZXJHcm91cH1gIDogcnVubmVyPy5kaXNwbGF5TmFtZSA/PyBcIlVua25vd25cIixcclxuICAgICAgICAgIHN0YXJ0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxyXG4gICAgICAgICAgZmluaXNoZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxyXG4gICAgICAgICAgZHVyYXRpb25NczogMCxcclxuICAgICAgICAgIGV4aXRDb2RlOiAtMSxcclxuICAgICAgICAgIHN0ZG91dDogXCJcIixcclxuICAgICAgICAgIHN0ZGVycjogbWVzc2FnZSxcclxuICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgICAgICAgdGltZWRPdXQ6IGZhbHNlLFxyXG4gICAgICAgICAgY2FuY2VsbGVkOiBmYWxzZSxcclxuICAgICAgICB9LFxyXG4gICAgICB9KTtcclxuICAgICAgbmV3IE5vdGljZShgbG9vbSBlcnJvcjogJHttZXNzYWdlfWApO1xyXG4gICAgfSBmaW5hbGx5IHtcclxuICAgICAgdGhpcy5ydW5uaW5nLmRlbGV0ZShibG9jay5pZCk7XHJcbiAgICAgIHRoaXMubm90aWZ5T3V0cHV0Q2hhbmdlZChibG9jay5pZCk7XHJcbiAgICAgIHRoaXMudXBkYXRlU3RhdHVzQmFyKCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFzeW5jIGVuc3VyZUV4ZWN1dGlvbkVuYWJsZWQoKTogUHJvbWlzZTxib29sZWFuPiB7XHJcbiAgICBpZiAodGhpcy5zZXR0aW5ncy5lbmFibGVMb2NhbEV4ZWN1dGlvbiAmJiB0aGlzLnNldHRpbmdzLmhhc0Fja25vd2xlZGdlZEV4ZWN1dGlvblJpc2spIHtcclxuICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGF3YWl0IG5ldyBQcm9taXNlPGJvb2xlYW4+KChyZXNvbHZlKSA9PiB7XHJcbiAgICAgIGxldCBzZXR0bGVkID0gZmFsc2U7XHJcbiAgICAgIGNvbnN0IHNldHRsZSA9ICh2YWx1ZTogYm9vbGVhbikgPT4ge1xyXG4gICAgICAgIGlmICghc2V0dGxlZCkge1xyXG4gICAgICAgICAgc2V0dGxlZCA9IHRydWU7XHJcbiAgICAgICAgICByZXNvbHZlKHZhbHVlKTtcclxuICAgICAgICB9XHJcbiAgICAgIH07XHJcblxyXG4gICAgICBjb25zdCBtb2RhbCA9IG5ldyBFeGVjdXRpb25Db25zZW50TW9kYWwodGhpcy5hcHAsIGFzeW5jICgpID0+IHtcclxuICAgICAgICB0aGlzLnNldHRpbmdzLmVuYWJsZUxvY2FsRXhlY3V0aW9uID0gdHJ1ZTtcclxuICAgICAgICB0aGlzLnNldHRpbmdzLmhhc0Fja25vd2xlZGdlZEV4ZWN1dGlvblJpc2sgPSB0cnVlO1xyXG4gICAgICAgIGF3YWl0IHRoaXMuc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgc2V0dGxlKHRydWUpO1xyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGNvbnN0IG9yaWdpbmFsQ2xvc2UgPSBtb2RhbC5jbG9zZS5iaW5kKG1vZGFsKTtcclxuICAgICAgbW9kYWwuY2xvc2UgPSAoKSA9PiB7XHJcbiAgICAgICAgb3JpZ2luYWxDbG9zZSgpO1xyXG4gICAgICAgIHNldHRsZSh0aGlzLnNldHRpbmdzLmVuYWJsZUxvY2FsRXhlY3V0aW9uICYmIHRoaXMuc2V0dGluZ3MuaGFzQWNrbm93bGVkZ2VkRXhlY3V0aW9uUmlzayk7XHJcbiAgICAgIH07XHJcbiAgICAgIG1vZGFsLm9wZW4oKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZXNvbHZlV29ya2luZ0RpcmVjdG9yeShmaWxlOiBURmlsZSk6IHN0cmluZyB7XHJcbiAgICBpZiAodGhpcy5zZXR0aW5ncy53b3JraW5nRGlyZWN0b3J5LnRyaW0oKSkge1xyXG4gICAgICByZXR1cm4gdGhpcy5zZXR0aW5ncy53b3JraW5nRGlyZWN0b3J5LnRyaW0oKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBhZGFwdGVyQmFzZVBhdGggPSAodGhpcy5hcHAudmF1bHQuYWRhcHRlciBhcyB7IGJhc2VQYXRoPzogc3RyaW5nIH0pLmJhc2VQYXRoID8/IFwiXCI7XHJcbiAgICBjb25zdCBmaWxlRm9sZGVyID0gZGlybmFtZShmaWxlLnBhdGgpO1xyXG4gICAgY29uc3QgcmVzb2x2ZWQgPSBmaWxlRm9sZGVyID09PSBcIi5cIiA/IGFkYXB0ZXJCYXNlUGF0aCA6IGAke2FkYXB0ZXJCYXNlUGF0aH0vJHtmaWxlRm9sZGVyfWA7XHJcbiAgICByZXR1cm4gcmVzb2x2ZWQgfHwgcHJvY2Vzcy5jd2QoKTtcclxuICB9XHJcblxyXG4gIGFzeW5jIGdldENvbnRhaW5lckdyb3VwU3VtbWFyaWVzKCk6IFByb21pc2U8QXJyYXk8eyBuYW1lOiBzdHJpbmc7IHN0YXR1czogc3RyaW5nIH0+PiB7XHJcbiAgICByZXR1cm4gdGhpcy5jb250YWluZXJSdW5uZXIuZ2V0R3JvdXBTdW1tYXJpZXMoKTtcclxuICB9XHJcblxyXG4gIGFzeW5jIGJ1aWxkQ29udGFpbmVyR3JvdXAobmFtZTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xyXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5jb250YWluZXJSdW5uZXIuYnVpbGRHcm91cChuYW1lLCBNYXRoLm1heCh0aGlzLnNldHRpbmdzLmRlZmF1bHRUaW1lb3V0TXMsIDEyMF8wMDApLCBjb250cm9sbGVyLnNpZ25hbCk7XHJcbiAgICBuZXcgTm90aWNlKHJlc3VsdC5zdWNjZXNzID8gYGxvb20gYnVpbHQgY29udGFpbmVyIGdyb3VwICR7bmFtZX0uYCA6IGBsb29tIGNvbnRhaW5lciBidWlsZCBmYWlsZWQgZm9yICR7bmFtZX0uYCwgODAwMCk7XHJcbiAgfVxyXG5cclxuICByZWdpc3RlckNvZGVCbG9ja1Byb2Nlc3NvcnMoKTogdm9pZCB7XHJcbiAgICBmb3IgKGNvbnN0IGFsaWFzIG9mIGdldFN1cHBvcnRlZExhbmd1YWdlQWxpYXNlcyh0aGlzLnNldHRpbmdzKSkge1xyXG4gICAgICBjb25zdCBub3JtYWxpemVkQWxpYXMgPSBhbGlhcy50b0xvd2VyQ2FzZSgpO1xyXG4gICAgICBpZiAodGhpcy5yZWdpc3RlcmVkQ29kZUJsb2NrQWxpYXNlcy5oYXMobm9ybWFsaXplZEFsaWFzKSkge1xyXG4gICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAoL1teYS16QS1aMC05Xy1dLy50ZXN0KG5vcm1hbGl6ZWRBbGlhcykpIHtcclxuICAgICAgICBjb250aW51ZTtcclxuICAgICAgfVxyXG5cclxuICAgICAgdGhpcy5yZWdpc3RlcmVkQ29kZUJsb2NrQWxpYXNlcy5hZGQobm9ybWFsaXplZEFsaWFzKTtcclxuICAgICAgdGhpcy5yZWdpc3Rlck1hcmtkb3duQ29kZUJsb2NrUHJvY2Vzc29yKG5vcm1hbGl6ZWRBbGlhcywgYXN5bmMgKHNvdXJjZSwgZWwsIGN0eCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IGZpbGVQYXRoID0gY3R4LnNvdXJjZVBhdGg7XHJcbiAgICAgICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChmaWxlUGF0aCk7XHJcbiAgICAgICAgaWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkge1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgZnVsbFRleHQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5jYWNoZWRSZWFkKGZpbGUpO1xyXG4gICAgICAgIGNvbnN0IGJsb2NrcyA9IHBhcnNlTWFya2Rvd25Db2RlQmxvY2tzKGZpbGVQYXRoLCBmdWxsVGV4dCwgdGhpcy5zZXR0aW5ncyk7XHJcbiAgICAgICAgY29uc3Qgc2VjdGlvbiA9IChjdHggJiYgdHlwZW9mIGN0eC5nZXRTZWN0aW9uSW5mbyA9PT0gXCJmdW5jdGlvblwiKSA/IGN0eC5nZXRTZWN0aW9uSW5mbyhlbCkgOiBudWxsO1xyXG4gICAgICAgIGxldCBibG9jazogbG9vbUNvZGVCbG9jayB8IHVuZGVmaW5lZDtcclxuICAgICAgICBpZiAoc2VjdGlvbikge1xyXG4gICAgICAgICAgY29uc3QgbGluZVN0YXJ0ID0gc2VjdGlvbi5saW5lU3RhcnQ7XHJcbiAgICAgICAgICBibG9jayA9IGJsb2Nrcy5maW5kKChjYW5kaWRhdGUpID0+IGNhbmRpZGF0ZS5zdGFydExpbmUgPT09IGxpbmVTdGFydCAmJiBjYW5kaWRhdGUuY29udGVudCA9PT0gc291cmNlKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgYmxvY2sgPSBibG9ja3MuZmluZCgoY2FuZGlkYXRlKSA9PiBjYW5kaWRhdGUuY29udGVudCA9PT0gc291cmNlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKCFibG9jaykge1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IHByZSA9IGVsLnF1ZXJ5U2VsZWN0b3IoXCJwcmVcIikgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xyXG4gICAgICAgIGlmICghcHJlKSB7XHJcbiAgICAgICAgICBwcmUgPSBlbC5jcmVhdGVFbChcInByZVwiKTtcclxuICAgICAgICAgIHByZS5hZGRDbGFzcyhgbGFuZ3VhZ2UtJHtub3JtYWxpemVkQWxpYXN9YCk7XHJcbiAgICAgICAgICBjb25zdCBjb2RlID0gcHJlLmNyZWF0ZUVsKFwiY29kZVwiKTtcclxuICAgICAgICAgIGNvZGUuYWRkQ2xhc3MoYGxhbmd1YWdlLSR7bm9ybWFsaXplZEFsaWFzfWApO1xyXG4gICAgICAgICAgY29kZS5zZXRUZXh0KHNvdXJjZSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoYmxvY2subGFuZ3VhZ2UgPT09IFwibGx2bS1pclwiKSB7XHJcbiAgICAgICAgICBjb25zdCBjb2RlID0gKHByZS5xdWVyeVNlbGVjdG9yKFwiY29kZVwiKSBhcyBIVE1MRWxlbWVudCB8IG51bGwpID8/IHByZTtcclxuICAgICAgICAgIGhpZ2hsaWdodExsdm1FbGVtZW50KGNvZGUsIHNvdXJjZSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjdHguYWRkQ2hpbGQobmV3IGxvb21Ub29sYmFyUmVuZGVyQ2hpbGQoZWwsIHRoaXMsIGJsb2NrLCBwcmUpKTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHVwZGF0ZVN0YXR1c0JhcigpOiB2b2lkIHtcclxuICAgIGNvbnN0IGFjdGl2ZVJ1bnMgPSB0aGlzLnJ1bm5pbmcuc2l6ZTtcclxuICAgIHRoaXMuc3RhdHVzQmFySXRlbUVsLnNldFRleHQoYWN0aXZlUnVucyA/IGBsb29tOiAke2FjdGl2ZVJ1bnN9IEFjdGl2ZSBSdW4ke2FjdGl2ZVJ1bnMgPT09IDEgPyBcIlwiIDogXCJzXCJ9YCA6IFwibG9vbTogSWRsZVwiKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgbm90aWZ5T3V0cHV0Q2hhbmdlZChibG9ja0lkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIHRoaXMub3V0cHV0TGlzdGVuZXJzLmdldChibG9ja0lkKT8uZm9yRWFjaCgobGlzdGVuZXIpID0+IGxpc3RlbmVyKCkpO1xyXG4gICAgdGhpcy5yZWZyZXNoQWxsVmlld3MoKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVmcmVzaEFsbFZpZXdzKCk6IHZvaWQge1xyXG4gICAgdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShcIm1hcmtkb3duXCIpLmZvckVhY2goKGxlYWYpID0+IHtcclxuICAgICAgY29uc3QgdmlldyA9IGxlYWYudmlldyBhcyBNYXJrZG93blZpZXc7XHJcbiAgICAgIGNvbnN0IHByZXZpZXdNb2RlID0gKHZpZXcgYXMgeyBwcmV2aWV3TW9kZT86IHsgcmVyZW5kZXI/OiAoZm9yY2U/OiBib29sZWFuKSA9PiB2b2lkIH0gfSkucHJldmlld01vZGU7XHJcbiAgICAgIHByZXZpZXdNb2RlPy5yZXJlbmRlcj8uKHRydWUpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgZm9yIChjb25zdCBlZGl0b3JWaWV3IG9mIHRoaXMuZWRpdG9yVmlld3MpIHtcclxuICAgICAgZWRpdG9yVmlldy5kaXNwYXRjaCh7IGVmZmVjdHM6IGxvb21SZWZyZXNoRWZmZWN0Lm9mKHVuZGVmaW5lZCkgfSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldEFjdGl2ZU1hcmtkb3duRmlsZSgpOiBURmlsZSB8IG51bGwge1xyXG4gICAgY29uc3QgdmlldyA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVWaWV3T2ZUeXBlKE1hcmtkb3duVmlldyk7XHJcbiAgICByZXR1cm4gdmlldz8uZmlsZSA/PyBudWxsO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRDdXJyZW50RWRpdG9yRmlsZVBhdGgoKTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgICByZXR1cm4gdGhpcy5nZXRBY3RpdmVNYXJrZG93bkZpbGUoKT8ucGF0aCA/PyB0aGlzLmxhc3RNYXJrZG93bkZpbGVQYXRoO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgZW5mb3JjZVNvdXJjZU1vZGVGb3JBY3RpdmVWaWV3KCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgdmlldyA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVWaWV3T2ZUeXBlKE1hcmtkb3duVmlldyk7XHJcbiAgICBpZiAoIXZpZXcpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGF3YWl0IHRoaXMuZW5mb3JjZVNvdXJjZU1vZGVGb3JMZWFmKHZpZXcubGVhZik7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFzeW5jIGVuZm9yY2VTb3VyY2VNb2RlRm9yTGVhZihsZWFmOiBXb3Jrc3BhY2VMZWFmKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBpZiAoIXRoaXMuc2V0dGluZ3MucHJlc2VydmVTb3VyY2VNb2RlKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBpZiAobGVhZi5pc0RlZmVycmVkKSB7XHJcbiAgICAgIGF3YWl0IGxlYWYubG9hZElmRGVmZXJyZWQoKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCB2aWV3ID0gbGVhZi52aWV3O1xyXG4gICAgaWYgKCEodmlldyBpbnN0YW5jZW9mIE1hcmtkb3duVmlldykgfHwgIXZpZXcuZmlsZSkge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3Qgc291cmNlID0gdmlldy5lZGl0b3I/LmdldFZhbHVlPy4oKSA/PyAoYXdhaXQgdGhpcy5hcHAudmF1bHQuY2FjaGVkUmVhZCh2aWV3LmZpbGUpKTtcclxuICAgIGNvbnN0IGJsb2NrcyA9IHBhcnNlTWFya2Rvd25Db2RlQmxvY2tzKHZpZXcuZmlsZS5wYXRoLCBzb3VyY2UsIHRoaXMuc2V0dGluZ3MpO1xyXG4gICAgaWYgKCFibG9ja3MubGVuZ3RoKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCB2aWV3U3RhdGUgPSBsZWFmLmdldFZpZXdTdGF0ZSgpO1xyXG4gICAgY29uc3Qgc3RhdGUgPSB7IC4uLih2aWV3U3RhdGUuc3RhdGUgPz8ge30pIH0gYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XHJcbiAgICBpZiAoc3RhdGUubW9kZSA9PT0gXCJzb3VyY2VcIiAmJiBzdGF0ZS5zb3VyY2UgPT09IHRydWUpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHN0YXRlLm1vZGUgPSBcInNvdXJjZVwiO1xyXG4gICAgc3RhdGUuc291cmNlID0gdHJ1ZTtcclxuXHJcbiAgICBhd2FpdCBsZWFmLnNldFZpZXdTdGF0ZSh7XHJcbiAgICAgIC4uLnZpZXdTdGF0ZSxcclxuICAgICAgc3RhdGUsXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZmluZEFjdGl2ZUJsb2NrQnlJZChibG9ja0lkOiBzdHJpbmcpOiBsb29tQ29kZUJsb2NrIHwgbnVsbCB7XHJcbiAgICBjb25zdCB2aWV3ID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcclxuICAgIGNvbnN0IGZpbGUgPSB2aWV3Py5maWxlO1xyXG4gICAgY29uc3QgZWRpdG9yID0gdmlldz8uZWRpdG9yO1xyXG4gICAgaWYgKCFmaWxlIHx8ICFlZGl0b3IpIHtcclxuICAgICAgcmV0dXJuIHRoaXMub3V0cHV0cy5nZXQoYmxvY2tJZCk/LmJsb2NrID8/IG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgYmxvY2tzID0gcGFyc2VNYXJrZG93bkNvZGVCbG9ja3MoZmlsZS5wYXRoLCBlZGl0b3IuZ2V0VmFsdWUoKSwgdGhpcy5zZXR0aW5ncyk7XHJcbiAgICByZXR1cm4gYmxvY2tzLmZpbmQoKGJsb2NrKSA9PiBibG9jay5pZCA9PT0gYmxvY2tJZCkgPz8gdGhpcy5vdXRwdXRzLmdldChibG9ja0lkKT8uYmxvY2sgPz8gbnVsbDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgY3JlYXRlTGl2ZVByZXZpZXdFeHRlbnNpb24oKSB7XHJcbiAgICBjb25zdCBwbHVnaW4gPSB0aGlzO1xyXG5cclxuICAgIHJldHVybiBWaWV3UGx1Z2luLmZyb21DbGFzcyhcclxuICAgICAgY2xhc3Mge1xyXG4gICAgICAgIGRlY29yYXRpb25zO1xyXG5cclxuICAgICAgICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IHZpZXc6IEVkaXRvclZpZXcpIHtcclxuICAgICAgICAgIHBsdWdpbi5lZGl0b3JWaWV3cy5hZGQodmlldyk7XHJcbiAgICAgICAgICB0aGlzLmRlY29yYXRpb25zID0gdGhpcy5idWlsZERlY29yYXRpb25zKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB1cGRhdGUodXBkYXRlOiBWaWV3VXBkYXRlKTogdm9pZCB7XHJcbiAgICAgICAgICBpZiAodXBkYXRlLmRvY0NoYW5nZWQgfHwgdXBkYXRlLnZpZXdwb3J0Q2hhbmdlZCB8fCB1cGRhdGUudHJhbnNhY3Rpb25zLnNvbWUoKHRyKSA9PiB0ci5lZmZlY3RzLnNvbWUoKGVmZmVjdCkgPT4gZWZmZWN0LmlzKGxvb21SZWZyZXNoRWZmZWN0KSkpKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZGVjb3JhdGlvbnMgPSB0aGlzLmJ1aWxkRGVjb3JhdGlvbnMoKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGRlc3Ryb3koKTogdm9pZCB7XHJcbiAgICAgICAgICBwbHVnaW4uZWRpdG9yVmlld3MuZGVsZXRlKHRoaXMudmlldyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBwcml2YXRlIGJ1aWxkRGVjb3JhdGlvbnMoKSB7XHJcbiAgICAgICAgICBjb25zdCBmaWxlUGF0aCA9IHBsdWdpbi5nZXRDdXJyZW50RWRpdG9yRmlsZVBhdGgoKTtcclxuICAgICAgICAgIGlmICghZmlsZVBhdGgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIERlY29yYXRpb24ubm9uZTtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICBjb25zdCBzb3VyY2UgPSB0aGlzLnZpZXcuc3RhdGUuZG9jLnRvU3RyaW5nKCk7XHJcbiAgICAgICAgICBjb25zdCBibG9ja3MgPSBwYXJzZU1hcmtkb3duQ29kZUJsb2NrcyhmaWxlUGF0aCwgc291cmNlLCBwbHVnaW4uc2V0dGluZ3MpO1xyXG4gICAgICAgICAgY29uc3QgYnVpbGRlciA9IG5ldyBSYW5nZVNldEJ1aWxkZXI8RGVjb3JhdGlvbj4oKTtcclxuXHJcbiAgICAgICAgICBmb3IgKGNvbnN0IGJsb2NrIG9mIGJsb2Nrcykge1xyXG4gICAgICAgICAgICBjb25zdCBzdGFydExpbmUgPSB0aGlzLnZpZXcuc3RhdGUuZG9jLmxpbmUoYmxvY2suc3RhcnRMaW5lICsgMSk7XHJcbiAgICAgICAgICAgIGJ1aWxkZXIuYWRkKFxyXG4gICAgICAgICAgICAgIHN0YXJ0TGluZS5mcm9tLFxyXG4gICAgICAgICAgICAgIHN0YXJ0TGluZS5mcm9tLFxyXG4gICAgICAgICAgICAgIERlY29yYXRpb24ud2lkZ2V0KHtcclxuICAgICAgICAgICAgICAgIHdpZGdldDogbmV3IGxvb21Ub29sYmFyV2lkZ2V0KHBsdWdpbiwgYmxvY2spLFxyXG4gICAgICAgICAgICAgICAgc2lkZTogLTEsXHJcbiAgICAgICAgICAgICAgfSksXHJcbiAgICAgICAgICAgICk7XHJcblxyXG4gICAgICAgICAgICBpZiAocGx1Z2luLm91dHB1dHMuaGFzKGJsb2NrLmlkKSB8fCBwbHVnaW4ucnVubmluZy5oYXMoYmxvY2suaWQpKSB7XHJcbiAgICAgICAgICAgICAgY29uc3QgZW5kTGluZSA9IHRoaXMudmlldy5zdGF0ZS5kb2MubGluZShibG9jay5lbmRMaW5lICsgMSk7XHJcbiAgICAgICAgICAgICAgYnVpbGRlci5hZGQoXHJcbiAgICAgICAgICAgICAgICBlbmRMaW5lLnRvLFxyXG4gICAgICAgICAgICAgICAgZW5kTGluZS50byxcclxuICAgICAgICAgICAgICAgIERlY29yYXRpb24ud2lkZ2V0KHtcclxuICAgICAgICAgICAgICAgICAgd2lkZ2V0OiBuZXcgbG9vbU91dHB1dFdpZGdldChwbHVnaW4sIGJsb2NrLmlkKSxcclxuICAgICAgICAgICAgICAgICAgc2lkZTogMSxcclxuICAgICAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmIChibG9jay5sYW5ndWFnZSA9PT0gXCJsbHZtLWlyXCIpIHtcclxuICAgICAgICAgICAgICBhZGRMbHZtRGVjb3JhdGlvbnMoYnVpbGRlciwgdGhpcy52aWV3LCBibG9jayk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICByZXR1cm4gYnVpbGRlci5maW5pc2goKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcbiAgICAgIHtcclxuICAgICAgICBkZWNvcmF0aW9uczogKHZhbHVlKSA9PiB2YWx1ZS5kZWNvcmF0aW9ucyxcclxuICAgICAgfSxcclxuICAgICk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFzeW5jIHdyaXRlTWFuYWdlZE91dHB1dEJsb2NrKGZpbGU6IFRGaWxlLCBibG9jazogbG9vbUNvZGVCbG9jaywgcmVzdWx0OiBsb29tU3RvcmVkT3V0cHV0W1wicmVzdWx0XCJdKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5wcm9jZXNzKGZpbGUsIChjb250ZW50KSA9PiB7XHJcbiAgICAgIGNvbnN0IGxpbmVzID0gY29udGVudC5zcGxpdCgvXFxyP1xcbi8pO1xyXG4gICAgICBjb25zdCBibG9ja3MgPSBwYXJzZU1hcmtkb3duQ29kZUJsb2NrcyhmaWxlLnBhdGgsIGNvbnRlbnQsIHRoaXMuc2V0dGluZ3MpO1xyXG4gICAgICBjb25zdCBjdXJyZW50QmxvY2sgPSBibG9ja3MuZmluZCgoY2FuZGlkYXRlKSA9PiBjYW5kaWRhdGUuaWQgPT09IGJsb2NrLmlkKTtcclxuICAgICAgY29uc3QgcmVuZGVyZWQgPSB0aGlzLnJlbmRlck1hbmFnZWRPdXRwdXRNYXJrZG93bihibG9jay5pZCwgcmVzdWx0KTtcclxuICAgICAgY29uc3QgZXhpc3RpbmdSYW5nZSA9IHRoaXMuZmluZE1hbmFnZWRPdXRwdXRSYW5nZShsaW5lcywgYmxvY2suaWQpO1xyXG5cclxuICAgICAgaWYgKGV4aXN0aW5nUmFuZ2UpIHtcclxuICAgICAgICBsaW5lcy5zcGxpY2UoZXhpc3RpbmdSYW5nZS5zdGFydCwgZXhpc3RpbmdSYW5nZS5lbmQgLSBleGlzdGluZ1JhbmdlLnN0YXJ0ICsgMSwgLi4ucmVuZGVyZWQpO1xyXG4gICAgICAgIHJldHVybiBsaW5lcy5qb2luKFwiXFxuXCIpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAoIWN1cnJlbnRCbG9jaykge1xyXG4gICAgICAgIHJldHVybiBjb250ZW50O1xyXG4gICAgICB9XHJcblxyXG4gICAgICBsaW5lcy5zcGxpY2UoY3VycmVudEJsb2NrLmVuZExpbmUgKyAxLCAwLCAuLi5yZW5kZXJlZCk7XHJcbiAgICAgIHJldHVybiBsaW5lcy5qb2luKFwiXFxuXCIpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFzeW5jIHJlbW92ZU1hbmFnZWRPdXRwdXRCbG9jayhmaWxlUGF0aDogc3RyaW5nLCBibG9ja0lkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoZmlsZVBhdGgpO1xyXG4gICAgaWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgYXdhaXQgdGhpcy5hcHAudmF1bHQucHJvY2VzcyhmaWxlLCAoY29udGVudCkgPT4ge1xyXG4gICAgICBjb25zdCBsaW5lcyA9IGNvbnRlbnQuc3BsaXQoL1xccj9cXG4vKTtcclxuICAgICAgY29uc3QgcmFuZ2UgPSB0aGlzLmZpbmRNYW5hZ2VkT3V0cHV0UmFuZ2UobGluZXMsIGJsb2NrSWQpO1xyXG4gICAgICBpZiAoIXJhbmdlKSB7XHJcbiAgICAgICAgcmV0dXJuIGNvbnRlbnQ7XHJcbiAgICAgIH1cclxuICAgICAgbGluZXMuc3BsaWNlKHJhbmdlLnN0YXJ0LCByYW5nZS5lbmQgLSByYW5nZS5zdGFydCArIDEpO1xyXG4gICAgICByZXR1cm4gbGluZXMuam9pbihcIlxcblwiKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZW5kZXJNYW5hZ2VkT3V0cHV0TWFya2Rvd24oYmxvY2tJZDogc3RyaW5nLCByZXN1bHQ6IGxvb21TdG9yZWRPdXRwdXRbXCJyZXN1bHRcIl0pOiBzdHJpbmdbXSB7XHJcbiAgICBjb25zdCBib2R5ID0gW1xyXG4gICAgICBgcnVubmVyPSR7cmVzdWx0LnJ1bm5lck5hbWV9YCxcclxuICAgICAgYGV4aXQ9JHtyZXN1bHQuZXhpdENvZGUgPz8gXCI/XCJ9YCxcclxuICAgICAgYGR1cmF0aW9uPSR7cmVzdWx0LmR1cmF0aW9uTXN9bXNgLFxyXG4gICAgICBgdGltZXN0YW1wPSR7cmVzdWx0LmZpbmlzaGVkQXR9YCxcclxuICAgICAgcmVzdWx0LnN0ZG91dCA/IGBzdGRvdXQ6XFxuJHtyZXN1bHQuc3Rkb3V0fWAgOiBcIlwiLFxyXG4gICAgICByZXN1bHQud2FybmluZyA/IGB3YXJuaW5nOlxcbiR7cmVzdWx0Lndhcm5pbmd9YCA6IFwiXCIsXHJcbiAgICAgIHJlc3VsdC5zdGRlcnIgPyBgc3RkZXJyOlxcbiR7cmVzdWx0LnN0ZGVycn1gIDogXCJcIixcclxuICAgIF1cclxuICAgICAgLmZpbHRlcihCb29sZWFuKVxyXG4gICAgICAuam9pbihcIlxcblxcblwiKTtcclxuXHJcbiAgICByZXR1cm4gW1xyXG4gICAgICBgPCEtLSBsb29tOm91dHB1dDpzdGFydCBpZD0ke2Jsb2NrSWR9IC0tPmAsXHJcbiAgICAgIFwiYGBgdGV4dFwiLFxyXG4gICAgICBib2R5LFxyXG4gICAgICBcImBgYFwiLFxyXG4gICAgICBcIjwhLS0gbG9vbTpvdXRwdXQ6ZW5kIC0tPlwiLFxyXG4gICAgXTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZmluZE1hbmFnZWRPdXRwdXRSYW5nZShsaW5lczogc3RyaW5nW10sIGJsb2NrSWQ6IHN0cmluZyk6IHsgc3RhcnQ6IG51bWJlcjsgZW5kOiBudW1iZXIgfSB8IG51bGwge1xyXG4gICAgY29uc3Qgc3RhcnRNYXJrZXIgPSBgPCEtLSBsb29tOm91dHB1dDpzdGFydCBpZD0ke2Jsb2NrSWR9IC0tPmA7XHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbmVzLmxlbmd0aDsgaSArPSAxKSB7XHJcbiAgICAgIGlmIChsaW5lc1tpXS50cmltKCkgIT09IHN0YXJ0TWFya2VyKSB7XHJcbiAgICAgICAgY29udGludWU7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGZvciAobGV0IGogPSBpICsgMTsgaiA8IGxpbmVzLmxlbmd0aDsgaiArPSAxKSB7XHJcbiAgICAgICAgaWYgKGxpbmVzW2pdLnRyaW0oKSA9PT0gXCI8IS0tIGxvb206b3V0cHV0OmVuZCAtLT5cIikge1xyXG4gICAgICAgICAgcmV0dXJuIHsgc3RhcnQ6IGksIGVuZDogaiB9O1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIG51bGw7XHJcbiAgfVxyXG59XHJcbiIsICJpbXBvcnQgeyBOb3RpY2UsIHR5cGUgQXBwLCB0eXBlIFRGaWxlIH0gZnJvbSBcIm9ic2lkaWFuXCI7XHJcbmltcG9ydCB7IGV4aXN0c1N5bmMgfSBmcm9tIFwiZnNcIjtcclxuaW1wb3J0IHsgbWtkaXIsIHJlYWRGaWxlLCBybSwgd3JpdGVGaWxlIH0gZnJvbSBcImZzL3Byb21pc2VzXCI7XHJcbmltcG9ydCB7IGJhc2VuYW1lLCBqb2luLCBub3JtYWxpemUgYXMgbm9ybWFsaXplRnNQYXRoIH0gZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IHsgcnVuUHJvY2VzcyB9IGZyb20gXCIuL3Byb2Nlc3NSdW5uZXJcIjtcclxuaW1wb3J0IHsgc3BsaXRDb21tYW5kTGluZSB9IGZyb20gXCIuLi91dGlscy9jb21tYW5kXCI7XHJcbmltcG9ydCB0eXBlIHsgbG9vbUNvZGVCbG9jaywgbG9vbVBsdWdpblNldHRpbmdzLCBsb29tUnVuQ29udGV4dCwgbG9vbVJ1blJlc3VsdCB9IGZyb20gXCIuLi90eXBlc1wiO1xyXG5cclxuaW50ZXJmYWNlIGxvb21Db250YWluZXJMYW5ndWFnZUNvbmZpZyB7XHJcbiAgY29tbWFuZDogc3RyaW5nO1xyXG4gIGV4dGVuc2lvbjogc3RyaW5nO1xyXG59XHJcblxyXG5pbnRlcmZhY2UgbG9vbUNvbnRhaW5lckNvbmZpZyB7XHJcbiAgaW1hZ2U/OiBzdHJpbmc7XHJcbiAgbGFuZ3VhZ2VzOiBSZWNvcmQ8c3RyaW5nLCBsb29tQ29udGFpbmVyTGFuZ3VhZ2VDb25maWc+O1xyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgbG9vbUNvbnRhaW5lclJ1bm5lciB7XHJcbiAgcHJpdmF0ZSByZWFkb25seSBidWlsdEltYWdlcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xyXG5cclxuICBjb25zdHJ1Y3RvcihcclxuICAgIHByaXZhdGUgcmVhZG9ubHkgYXBwOiBBcHAsXHJcbiAgICBwcml2YXRlIHJlYWRvbmx5IHBsdWdpbkRpcjogc3RyaW5nLFxyXG4gICkge31cclxuXHJcbiAgZ2V0Q29udGFpbmVyR3JvdXBOYW1lKGZpbGU6IFRGaWxlKTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgICBjb25zdCBmcm9udG1hdHRlciA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpPy5mcm9udG1hdHRlcjtcclxuICAgIGNvbnN0IHZhbHVlID0gZnJvbnRtYXR0ZXI/LltcImxvb20tY29udGFpbmVyXCJdO1xyXG4gICAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gXCJzdHJpbmdcIiAmJiB2YWx1ZS50cmltKCkgPyB2YWx1ZS50cmltKCkgOiBudWxsO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgZ2V0R3JvdXBTdW1tYXJpZXMoKTogUHJvbWlzZTxBcnJheTx7IG5hbWU6IHN0cmluZzsgc3RhdHVzOiBzdHJpbmcgfT4+IHtcclxuICAgIGNvbnN0IGNvbnRhaW5lcnNQYXRoID0gdGhpcy5nZXRDb250YWluZXJzUGF0aCgpO1xyXG4gICAgaWYgKCFleGlzdHNTeW5jKGNvbnRhaW5lcnNQYXRoKSkge1xyXG4gICAgICByZXR1cm4gW107XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgeyByZWFkZGlyIH0gPSBhd2FpdCBpbXBvcnQoXCJmcy9wcm9taXNlc1wiKTtcclxuICAgIGNvbnN0IGVudHJpZXMgPSBhd2FpdCByZWFkZGlyKGNvbnRhaW5lcnNQYXRoLCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSk7XHJcbiAgICByZXR1cm4gZW50cmllc1xyXG4gICAgICAuZmlsdGVyKChlbnRyeSkgPT4gZW50cnkuaXNEaXJlY3RvcnkoKSlcclxuICAgICAgLm1hcCgoZW50cnkpID0+IHtcclxuICAgICAgICBjb25zdCBncm91cFBhdGggPSBqb2luKGNvbnRhaW5lcnNQYXRoLCBlbnRyeS5uYW1lKTtcclxuICAgICAgICBjb25zdCBoYXNDb25maWcgPSBleGlzdHNTeW5jKGpvaW4oZ3JvdXBQYXRoLCBcImNvbmZpZy5qc29uXCIpKTtcclxuICAgICAgICBjb25zdCBoYXNEb2NrZXJmaWxlID0gZXhpc3RzU3luYyhqb2luKGdyb3VwUGF0aCwgXCJEb2NrZXJmaWxlXCIpKTtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgbmFtZTogZW50cnkubmFtZSxcclxuICAgICAgICAgIHN0YXR1czogaGFzQ29uZmlnID8gKGhhc0RvY2tlcmZpbGUgPyBcImNvbmZpZyArIERvY2tlcmZpbGVcIiA6IFwiY29uZmlnIG9ubHlcIikgOiBcIm1pc3NpbmcgY29uZmlnLmpzb25cIixcclxuICAgICAgICB9O1xyXG4gICAgICB9KTtcclxuICB9XHJcblxyXG4gIGFzeW5jIHJ1bihibG9jazogbG9vbUNvZGVCbG9jaywgY29udGV4dDogbG9vbVJ1bkNvbnRleHQsIHNldHRpbmdzOiBsb29tUGx1Z2luU2V0dGluZ3MsIGdyb3VwTmFtZTogc3RyaW5nKTogUHJvbWlzZTxsb29tUnVuUmVzdWx0PiB7XHJcbiAgICBjb25zdCBncm91cFBhdGggPSB0aGlzLnJlc29sdmVHcm91cFBhdGgoZ3JvdXBOYW1lKTtcclxuICAgIGNvbnN0IGNvbmZpZyA9IGF3YWl0IHRoaXMucmVhZENvbmZpZyhncm91cFBhdGgpO1xyXG4gICAgY29uc3QgbGFuZ3VhZ2UgPSBjb25maWcubGFuZ3VhZ2VzW2Jsb2NrLmxhbmd1YWdlXSA/PyBjb25maWcubGFuZ3VhZ2VzW2Jsb2NrLmxhbmd1YWdlQWxpYXNdO1xyXG4gICAgaWYgKCFsYW5ndWFnZSkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENvbnRhaW5lciBncm91cCAke2dyb3VwTmFtZX0gaGFzIG5vIGNvbW1hbmQgZm9yICR7YmxvY2subGFuZ3VhZ2V9LmApO1xyXG4gICAgfVxyXG5cclxuICAgIGF3YWl0IG1rZGlyKGdyb3VwUGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7XHJcbiAgICBjb25zdCBpbWFnZSA9IGF3YWl0IHRoaXMucmVzb2x2ZUltYWdlKGdyb3VwTmFtZSwgZ3JvdXBQYXRoLCBjb25maWcsIGNvbnRleHQsIHNldHRpbmdzKTtcclxuICAgIGNvbnN0IHRlbXBGaWxlTmFtZSA9IGB0ZW1wXyR7RGF0ZS5ub3coKX1fJHtNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDE2KS5zbGljZSgyKX0ke25vcm1hbGl6ZUV4dGVuc2lvbihsYW5ndWFnZS5leHRlbnNpb24pfWA7XHJcbiAgICBjb25zdCB0ZW1wRmlsZVBhdGggPSBqb2luKGdyb3VwUGF0aCwgdGVtcEZpbGVOYW1lKTtcclxuXHJcbiAgICB0cnkge1xyXG4gICAgICBhd2FpdCB3cml0ZUZpbGUodGVtcEZpbGVQYXRoLCBibG9jay5jb250ZW50LCBcInV0ZjhcIik7XHJcbiAgICAgIGNvbnN0IGNvbW1hbmQgPSBzcGxpdENvbW1hbmRMaW5lKGxhbmd1YWdlLmNvbW1hbmQucmVwbGFjZUFsbChcIntmaWxlfVwiLCB0ZW1wRmlsZU5hbWUpKTtcclxuICAgICAgaWYgKCFjb21tYW5kLmxlbmd0aCkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQ29udGFpbmVyIGNvbW1hbmQgZm9yICR7YmxvY2subGFuZ3VhZ2V9IGlzIGVtcHR5LmApO1xyXG4gICAgICB9XHJcblxyXG4gICAgICByZXR1cm4gYXdhaXQgcnVuUHJvY2Vzcyh7XHJcbiAgICAgICAgcnVubmVySWQ6IGBjb250YWluZXI6JHtncm91cE5hbWV9OiR7YmxvY2subGFuZ3VhZ2V9YCxcclxuICAgICAgICBydW5uZXJOYW1lOiBgQ29udGFpbmVyICR7Z3JvdXBOYW1lfWAsXHJcbiAgICAgICAgZXhlY3V0YWJsZTogXCJkb2NrZXJcIixcclxuICAgICAgICBhcmdzOiBbXHJcbiAgICAgICAgICBcInJ1blwiLFxyXG4gICAgICAgICAgXCItLXJtXCIsXHJcbiAgICAgICAgICBcIi12XCIsXHJcbiAgICAgICAgICBgJHtncm91cFBhdGh9Oi93b3Jrc3BhY2VgLFxyXG4gICAgICAgICAgXCItd1wiLFxyXG4gICAgICAgICAgXCIvd29ya3NwYWNlXCIsXHJcbiAgICAgICAgICBpbWFnZSxcclxuICAgICAgICAgIC4uLmNvbW1hbmQsXHJcbiAgICAgICAgXSxcclxuICAgICAgICB3b3JraW5nRGlyZWN0b3J5OiBncm91cFBhdGgsXHJcbiAgICAgICAgdGltZW91dE1zOiBjb250ZXh0LnRpbWVvdXRNcyxcclxuICAgICAgICBzaWduYWw6IGNvbnRleHQuc2lnbmFsLFxyXG4gICAgICB9KTtcclxuICAgIH0gZmluYWxseSB7XHJcbiAgICAgIGF3YWl0IHJtKHRlbXBGaWxlUGF0aCwgeyBmb3JjZTogdHJ1ZSB9KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGFzeW5jIGJ1aWxkR3JvdXAoZ3JvdXBOYW1lOiBzdHJpbmcsIHRpbWVvdXRNczogbnVtYmVyLCBzaWduYWw6IEFib3J0U2lnbmFsKTogUHJvbWlzZTxsb29tUnVuUmVzdWx0PiB7XHJcbiAgICBjb25zdCBncm91cFBhdGggPSB0aGlzLnJlc29sdmVHcm91cFBhdGgoZ3JvdXBOYW1lKTtcclxuICAgIGNvbnN0IGNvbmZpZyA9IGF3YWl0IHRoaXMucmVhZENvbmZpZyhncm91cFBhdGgpO1xyXG4gICAgcmV0dXJuIHRoaXMuYnVpbGRJbWFnZShncm91cE5hbWUsIGdyb3VwUGF0aCwgY29uZmlnLCB0aW1lb3V0TXMsIHNpZ25hbCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFzeW5jIHJlc29sdmVJbWFnZShcclxuICAgIGdyb3VwTmFtZTogc3RyaW5nLFxyXG4gICAgZ3JvdXBQYXRoOiBzdHJpbmcsXHJcbiAgICBjb25maWc6IGxvb21Db250YWluZXJDb25maWcsXHJcbiAgICBjb250ZXh0OiBsb29tUnVuQ29udGV4dCxcclxuICAgIHNldHRpbmdzOiBsb29tUGx1Z2luU2V0dGluZ3MsXHJcbiAgKTogUHJvbWlzZTxzdHJpbmc+IHtcclxuICAgIGNvbnN0IGRvY2tlcmZpbGUgPSBqb2luKGdyb3VwUGF0aCwgXCJEb2NrZXJmaWxlXCIpO1xyXG4gICAgaWYgKCFleGlzdHNTeW5jKGRvY2tlcmZpbGUpKSB7XHJcbiAgICAgIHJldHVybiBjb25maWcuaW1hZ2UgfHwgXCJ1YnVudHU6bGF0ZXN0XCI7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgaW1hZ2UgPSB0aGlzLmltYWdlTmFtZUZvckdyb3VwKGdyb3VwTmFtZSk7XHJcbiAgICBpZiAodGhpcy5idWlsdEltYWdlcy5oYXMoaW1hZ2UpKSB7XHJcbiAgICAgIHJldHVybiBpbWFnZTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmJ1aWxkSW1hZ2UoZ3JvdXBOYW1lLCBncm91cFBhdGgsIGNvbmZpZywgTWF0aC5tYXgoY29udGV4dC50aW1lb3V0TXMsIHNldHRpbmdzLmRlZmF1bHRUaW1lb3V0TXMsIDEyMF8wMDApLCBjb250ZXh0LnNpZ25hbCk7XHJcbiAgICBpZiAoIXJlc3VsdC5zdWNjZXNzKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihyZXN1bHQuc3RkZXJyIHx8IHJlc3VsdC5zdGRvdXQgfHwgYERvY2tlciBidWlsZCBmYWlsZWQgZm9yICR7Z3JvdXBOYW1lfS5gKTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmJ1aWx0SW1hZ2VzLmFkZChpbWFnZSk7XHJcbiAgICByZXR1cm4gaW1hZ2U7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFzeW5jIGJ1aWxkSW1hZ2UoXHJcbiAgICBncm91cE5hbWU6IHN0cmluZyxcclxuICAgIGdyb3VwUGF0aDogc3RyaW5nLFxyXG4gICAgX2NvbmZpZzogbG9vbUNvbnRhaW5lckNvbmZpZyxcclxuICAgIHRpbWVvdXRNczogbnVtYmVyLFxyXG4gICAgc2lnbmFsOiBBYm9ydFNpZ25hbCxcclxuICApOiBQcm9taXNlPGxvb21SdW5SZXN1bHQ+IHtcclxuICAgIGNvbnN0IGltYWdlID0gdGhpcy5pbWFnZU5hbWVGb3JHcm91cChncm91cE5hbWUpO1xyXG4gICAgcmV0dXJuIHJ1blByb2Nlc3Moe1xyXG4gICAgICBydW5uZXJJZDogYGNvbnRhaW5lcjoke2dyb3VwTmFtZX06YnVpbGRgLFxyXG4gICAgICBydW5uZXJOYW1lOiBgQ29udGFpbmVyICR7Z3JvdXBOYW1lfSBidWlsZGAsXHJcbiAgICAgIGV4ZWN1dGFibGU6IFwiZG9ja2VyXCIsXHJcbiAgICAgIGFyZ3M6IFtcImJ1aWxkXCIsIFwiLXRcIiwgaW1hZ2UsIGdyb3VwUGF0aF0sXHJcbiAgICAgIHdvcmtpbmdEaXJlY3Rvcnk6IGdyb3VwUGF0aCxcclxuICAgICAgdGltZW91dE1zLFxyXG4gICAgICBzaWduYWwsXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXN5bmMgcmVhZENvbmZpZyhncm91cFBhdGg6IHN0cmluZyk6IFByb21pc2U8bG9vbUNvbnRhaW5lckNvbmZpZz4ge1xyXG4gICAgY29uc3QgY29uZmlnUGF0aCA9IGpvaW4oZ3JvdXBQYXRoLCBcImNvbmZpZy5qc29uXCIpO1xyXG4gICAgbGV0IHJhdzogdW5rbm93bjtcclxuICAgIHRyeSB7XHJcbiAgICAgIHJhdyA9IEpTT04ucGFyc2UoYXdhaXQgcmVhZEZpbGUoY29uZmlnUGF0aCwgXCJ1dGY4XCIpKTtcclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5hYmxlIHRvIHJlYWQgY29udGFpbmVyIGNvbmZpZyAke2NvbmZpZ1BhdGh9OiAke2Vycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKX1gKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoIXJhdyB8fCB0eXBlb2YgcmF3ICE9PSBcIm9iamVjdFwiIHx8IEFycmF5LmlzQXJyYXkocmF3KSkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDb250YWluZXIgY29uZmlnIG11c3QgYmUgYW4gb2JqZWN0LlwiKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBkYXRhID0gcmF3IGFzIHsgaW1hZ2U/OiB1bmtub3duOyBsYW5ndWFnZXM/OiB1bmtub3duIH07XHJcbiAgICBpZiAoZGF0YS5pbWFnZSAhPSBudWxsICYmIHR5cGVvZiBkYXRhLmltYWdlICE9PSBcInN0cmluZ1wiKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkNvbnRhaW5lciBjb25maWcgaW1hZ2UgbXVzdCBiZSBhIHN0cmluZy5cIik7XHJcbiAgICB9XHJcbiAgICBpZiAoIWRhdGEubGFuZ3VhZ2VzIHx8IHR5cGVvZiBkYXRhLmxhbmd1YWdlcyAhPT0gXCJvYmplY3RcIiB8fCBBcnJheS5pc0FycmF5KGRhdGEubGFuZ3VhZ2VzKSkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDb250YWluZXIgY29uZmlnIGxhbmd1YWdlcyBtdXN0IGJlIGFuIG9iamVjdC5cIik7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgbGFuZ3VhZ2VzOiBSZWNvcmQ8c3RyaW5nLCBsb29tQ29udGFpbmVyTGFuZ3VhZ2VDb25maWc+ID0ge307XHJcbiAgICBmb3IgKGNvbnN0IFtsYW5ndWFnZSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKGRhdGEubGFuZ3VhZ2VzIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KSkge1xyXG4gICAgICBpZiAoIXZhbHVlIHx8IHR5cGVvZiB2YWx1ZSAhPT0gXCJvYmplY3RcIiB8fCBBcnJheS5pc0FycmF5KHZhbHVlKSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQ29udGFpbmVyIGxhbmd1YWdlICR7bGFuZ3VhZ2V9IG11c3QgYmUgYW4gb2JqZWN0LmApO1xyXG4gICAgICB9XHJcbiAgICAgIGNvbnN0IGxhbmd1YWdlQ29uZmlnID0gdmFsdWUgYXMgeyBjb21tYW5kPzogdW5rbm93bjsgZXh0ZW5zaW9uPzogdW5rbm93biB9O1xyXG4gICAgICBpZiAodHlwZW9mIGxhbmd1YWdlQ29uZmlnLmNvbW1hbmQgIT09IFwic3RyaW5nXCIgfHwgIWxhbmd1YWdlQ29uZmlnLmNvbW1hbmQudHJpbSgpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb250YWluZXIgbGFuZ3VhZ2UgJHtsYW5ndWFnZX0gbXVzdCBkZWZpbmUgY29tbWFuZC5gKTtcclxuICAgICAgfVxyXG4gICAgICBsYW5ndWFnZXNbbGFuZ3VhZ2VdID0ge1xyXG4gICAgICAgIGNvbW1hbmQ6IGxhbmd1YWdlQ29uZmlnLmNvbW1hbmQsXHJcbiAgICAgICAgZXh0ZW5zaW9uOiB0eXBlb2YgbGFuZ3VhZ2VDb25maWcuZXh0ZW5zaW9uID09PSBcInN0cmluZ1wiID8gbGFuZ3VhZ2VDb25maWcuZXh0ZW5zaW9uIDogYC4ke2xhbmd1YWdlfWAsXHJcbiAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgaW1hZ2U6IHR5cGVvZiBkYXRhLmltYWdlID09PSBcInN0cmluZ1wiID8gZGF0YS5pbWFnZSA6IHVuZGVmaW5lZCxcclxuICAgICAgbGFuZ3VhZ2VzLFxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0Q29udGFpbmVyc1BhdGgoKTogc3RyaW5nIHtcclxuICAgIGNvbnN0IGFkYXB0ZXJCYXNlUGF0aCA9ICh0aGlzLmFwcC52YXVsdC5hZGFwdGVyIGFzIHsgYmFzZVBhdGg/OiBzdHJpbmcgfSkuYmFzZVBhdGggPz8gXCJcIjtcclxuICAgIHJldHVybiBub3JtYWxpemVGc1BhdGgoam9pbihhZGFwdGVyQmFzZVBhdGgsIHRoaXMucGx1Z2luRGlyLCBcImNvbnRhaW5lcnNcIikpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZXNvbHZlR3JvdXBQYXRoKGdyb3VwTmFtZTogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgIGNvbnN0IHNhZmVOYW1lID0gYmFzZW5hbWUoZ3JvdXBOYW1lKTtcclxuICAgIGlmICghc2FmZU5hbWUgfHwgc2FmZU5hbWUgIT09IGdyb3VwTmFtZSkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgY29udGFpbmVyIGdyb3VwIG5hbWU6ICR7Z3JvdXBOYW1lfWApO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIG5vcm1hbGl6ZUZzUGF0aChqb2luKHRoaXMuZ2V0Q29udGFpbmVyc1BhdGgoKSwgc2FmZU5hbWUpKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgaW1hZ2VOYW1lRm9yR3JvdXAoZ3JvdXBOYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIGBsb29tLWNvbnRhaW5lci0ke2dyb3VwTmFtZS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1teYS16MC05Xy4tXS9nLCBcIi1cIil9YDtcclxuICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG5vcm1hbGl6ZUV4dGVuc2lvbihleHRlbnNpb246IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgY29uc3QgdHJpbW1lZCA9IGV4dGVuc2lvbi50cmltKCk7XHJcbiAgcmV0dXJuIHRyaW1tZWQuc3RhcnRzV2l0aChcIi5cIikgPyB0cmltbWVkIDogYC4ke3RyaW1tZWR9YDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHNob3dEb2NrZXJOb3RpY2UobWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XHJcbiAgbmV3IE5vdGljZShtZXNzYWdlLCA4MDAwKTtcclxufVxyXG4iLCAiaW1wb3J0IHsgbWtkdGVtcCwgcm0sIHdyaXRlRmlsZSB9IGZyb20gXCJmcy9wcm9taXNlc1wiO1xyXG5pbXBvcnQgeyB0bXBkaXIgfSBmcm9tIFwib3NcIjtcclxuaW1wb3J0IHsgam9pbiB9IGZyb20gXCJwYXRoXCI7XHJcbmltcG9ydCB7IHNwYXduIH0gZnJvbSBcImNoaWxkX3Byb2Nlc3NcIjtcclxuaW1wb3J0IHR5cGUgeyBsb29tUnVuUmVzdWx0IH0gZnJvbSBcIi4uL3R5cGVzXCI7XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIGxvb21Qcm9jZXNzU3BlYyB7XHJcbiAgcnVubmVySWQ6IHN0cmluZztcclxuICBydW5uZXJOYW1lOiBzdHJpbmc7XHJcbiAgZXhlY3V0YWJsZTogc3RyaW5nO1xyXG4gIGFyZ3M6IHN0cmluZ1tdO1xyXG4gIHdvcmtpbmdEaXJlY3Rvcnk6IHN0cmluZztcclxuICB0aW1lb3V0TXM6IG51bWJlcjtcclxuICBzaWduYWw6IEFib3J0U2lnbmFsO1xyXG4gIGVudj86IE5vZGVKUy5Qcm9jZXNzRW52O1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIGxvb21UZW1wU291cmNlU3BlYyBleHRlbmRzIGxvb21Qcm9jZXNzU3BlYyB7XHJcbiAgZmlsZUV4dGVuc2lvbjogc3RyaW5nO1xyXG4gIHNvdXJjZTogc3RyaW5nO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIGxvb21UZW1wU291cmNlSGFuZGxlIHtcclxuICB0ZW1wRGlyOiBzdHJpbmc7XHJcbiAgdGVtcEZpbGU6IHN0cmluZztcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHdpdGhOYW1lZFRlbXBTb3VyY2VGaWxlPFQ+KFxyXG4gIGZpbGVOYW1lOiBzdHJpbmcsXHJcbiAgc291cmNlOiBzdHJpbmcsXHJcbiAgY2FsbGJhY2s6IChoYW5kbGU6IGxvb21UZW1wU291cmNlSGFuZGxlKSA9PiBQcm9taXNlPFQ+LFxyXG4pOiBQcm9taXNlPFQ+IHtcclxuICBjb25zdCB0ZW1wRGlyID0gYXdhaXQgbWtkdGVtcChqb2luKHRtcGRpcigpLCBcImxvb20tXCIpKTtcclxuICBjb25zdCB0ZW1wRmlsZSA9IGpvaW4odGVtcERpciwgZmlsZU5hbWUpO1xyXG5cclxuICB0cnkge1xyXG4gICAgYXdhaXQgd3JpdGVGaWxlKHRlbXBGaWxlLCBub3JtYWxpemVFeGVjdXRhYmxlU291cmNlKHNvdXJjZSksIFwidXRmOFwiKTtcclxuICAgIHJldHVybiBhd2FpdCBjYWxsYmFjayh7IHRlbXBEaXIsIHRlbXBGaWxlIH0pO1xyXG4gIH0gZmluYWxseSB7XHJcbiAgICBhd2FpdCBybSh0ZW1wRGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSwgZm9yY2U6IHRydWUgfSk7XHJcbiAgfVxyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gd2l0aFRlbXBTb3VyY2VGaWxlPFQ+KFxyXG4gIGZpbGVFeHRlbnNpb246IHN0cmluZyxcclxuICBzb3VyY2U6IHN0cmluZyxcclxuICBjYWxsYmFjazogKGhhbmRsZTogbG9vbVRlbXBTb3VyY2VIYW5kbGUpID0+IFByb21pc2U8VD4sXHJcbik6IFByb21pc2U8VD4ge1xyXG4gIHJldHVybiB3aXRoTmFtZWRUZW1wU291cmNlRmlsZShgc25pcHBldCR7ZmlsZUV4dGVuc2lvbn1gLCBzb3VyY2UsIGNhbGxiYWNrKTtcclxufVxyXG5cclxuZnVuY3Rpb24gbm9ybWFsaXplRXhlY3V0YWJsZVNvdXJjZShzb3VyY2U6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgY29uc3QgbGluZXMgPSBzb3VyY2Uuc3BsaXQoXCJcXG5cIik7XHJcbiAgY29uc3Qgbm9uRW1wdHlMaW5lcyA9IGxpbmVzLmZpbHRlcigobGluZSkgPT4gbGluZS50cmltKCkubGVuZ3RoID4gMCk7XHJcbiAgaWYgKCFub25FbXB0eUxpbmVzLmxlbmd0aCkge1xyXG4gICAgcmV0dXJuIHNvdXJjZTtcclxuICB9XHJcblxyXG4gIGxldCBzaGFyZWRJbmRlbnQgPSBnZXRMZWFkaW5nV2hpdGVzcGFjZShub25FbXB0eUxpbmVzWzBdKTtcclxuICBmb3IgKGNvbnN0IGxpbmUgb2Ygbm9uRW1wdHlMaW5lcy5zbGljZSgxKSkge1xyXG4gICAgc2hhcmVkSW5kZW50ID0gc2hhcmVkV2hpdGVzcGFjZVByZWZpeChzaGFyZWRJbmRlbnQsIGdldExlYWRpbmdXaGl0ZXNwYWNlKGxpbmUpKTtcclxuICAgIGlmICghc2hhcmVkSW5kZW50KSB7XHJcbiAgICAgIHJldHVybiBzb3VyY2U7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBpZiAoIXNoYXJlZEluZGVudCkge1xyXG4gICAgcmV0dXJuIHNvdXJjZTtcclxuICB9XHJcblxyXG4gIHJldHVybiBsaW5lc1xyXG4gICAgLm1hcCgobGluZSkgPT4gKGxpbmUudHJpbSgpLmxlbmd0aCA9PT0gMCA/IGxpbmUgOiBsaW5lLnN0YXJ0c1dpdGgoc2hhcmVkSW5kZW50KSA/IGxpbmUuc2xpY2Uoc2hhcmVkSW5kZW50Lmxlbmd0aCkgOiBsaW5lKSlcclxuICAgIC5qb2luKFwiXFxuXCIpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRMZWFkaW5nV2hpdGVzcGFjZShsaW5lOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gIGNvbnN0IG1hdGNoID0gbGluZS5tYXRjaCgvXltcXHQgXSovKTtcclxuICByZXR1cm4gbWF0Y2g/LlswXSA/PyBcIlwiO1xyXG59XHJcblxyXG5mdW5jdGlvbiBzaGFyZWRXaGl0ZXNwYWNlUHJlZml4KGxlZnQ6IHN0cmluZywgcmlnaHQ6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgbGV0IGluZGV4ID0gMDtcclxuICB3aGlsZSAoaW5kZXggPCBsZWZ0Lmxlbmd0aCAmJiBpbmRleCA8IHJpZ2h0Lmxlbmd0aCAmJiBsZWZ0W2luZGV4XSA9PT0gcmlnaHRbaW5kZXhdKSB7XHJcbiAgICBpbmRleCArPSAxO1xyXG4gIH1cclxuICByZXR1cm4gbGVmdC5zbGljZSgwLCBpbmRleCk7XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBydW5Qcm9jZXNzKHNwZWM6IGxvb21Qcm9jZXNzU3BlYyk6IFByb21pc2U8bG9vbVJ1blJlc3VsdD4ge1xyXG4gIGNvbnN0IHN0YXJ0ZWRBdCA9IG5ldyBEYXRlKCk7XHJcbiAgbGV0IHN0ZG91dCA9IFwiXCI7XHJcbiAgbGV0IHN0ZGVyciA9IFwiXCI7XHJcbiAgbGV0IGV4aXRDb2RlOiBudW1iZXIgfCBudWxsID0gbnVsbDtcclxuICBsZXQgdGltZWRPdXQgPSBmYWxzZTtcclxuICBsZXQgY2FuY2VsbGVkID0gZmFsc2U7XHJcbiAgbGV0IGNoaWxkOiBSZXR1cm5UeXBlPHR5cGVvZiBzcGF3bj4gfCBudWxsID0gbnVsbDtcclxuICBsZXQgdGltZW91dEhhbmRsZTogTm9kZUpTLlRpbWVvdXQgfCBudWxsID0gbnVsbDtcclxuICBsZXQgYWJvcnRIYW5kbGVyOiAoKCkgPT4gdm9pZCkgfCBudWxsID0gbnVsbDtcclxuXHJcbiAgbGV0IGV4ZWN1dGFibGUgPSBzcGVjLmV4ZWN1dGFibGU7XHJcbiAgbGV0IGFyZ3MgPSBzcGVjLmFyZ3M7XHJcblxyXG4gIGlmICgoZ2xvYmFsVGhpcyBhcyBhbnkpLmxvb21SdW5PbldzbCAmJiBwcm9jZXNzLnBsYXRmb3JtID09PSBcIndpbjMyXCIpIHtcclxuICAgIGlmIChzcGVjLmV4ZWN1dGFibGUgIT09IFwid3NsXCIpIHtcclxuICAgICAgLy8gVHJhbnNsYXRlIFdpbmRvd3MgcGF0aHMgaW4gYXJndW1lbnRzIHRvIFdTTCBwYXRoc1xyXG4gICAgICBjb25zdCB3c2xBcmdzID0gc3BlYy5hcmdzLm1hcCgoYXJnKSA9PiB7XHJcbiAgICAgICAgY29uc3QgbWF0Y2ggPSBhcmcubWF0Y2goL14oW0EtWmEtel0pOlxcXFwoLiopLyk7XHJcbiAgICAgICAgaWYgKG1hdGNoKSB7XHJcbiAgICAgICAgICBjb25zdCBkcml2ZSA9IG1hdGNoWzFdLnRvTG93ZXJDYXNlKCk7XHJcbiAgICAgICAgICBjb25zdCByZXN0ID0gbWF0Y2hbMl0ucmVwbGFjZSgvXFxcXC9nLCBcIi9cIik7XHJcbiAgICAgICAgICByZXR1cm4gYC9tbnQvJHtkcml2ZX0vJHtyZXN0fWA7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChhcmcuaW5jbHVkZXMoXCJcXFxcXCIpKSB7XHJcbiAgICAgICAgICByZXR1cm4gYXJnLnJlcGxhY2UoL1xcXFwvZywgXCIvXCIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gYXJnO1xyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIC8vIEVzY2FwZSBkb3VibGUgcXVvdGVzIGluc2lkZSB0aGUgYXJndW1lbnRzIGFuZCBqb2luIHRoZW1cclxuICAgICAgY29uc3QgZXNjYXBlZEFyZ3MgPSBbc3BlYy5leGVjdXRhYmxlLCAuLi53c2xBcmdzXVxyXG4gICAgICAgIC5tYXAoKGFyZykgPT4gJ1wiJyArIGFyZy5yZXBsYWNlKC9cIi9nLCAnXFxcXFwiJykgKyAnXCInKVxyXG4gICAgICAgIC5qb2luKFwiIFwiKTtcclxuXHJcbiAgICAgIGV4ZWN1dGFibGUgPSBcIndzbFwiO1xyXG4gICAgICBhcmdzID0gW1wiYmFzaFwiLCBcIi1sXCIsIFwiLWNcIiwgZXNjYXBlZEFyZ3NdO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgdHJ5IHtcclxuICAgIGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgY2hpbGQgPSBzcGF3bihleGVjdXRhYmxlLCBhcmdzLCB7XHJcbiAgICAgICAgY3dkOiBzcGVjLndvcmtpbmdEaXJlY3RvcnksXHJcbiAgICAgICAgc2hlbGw6IGZhbHNlLFxyXG4gICAgICAgIGVudjoge1xyXG4gICAgICAgICAgLi4ucHJvY2Vzcy5lbnYsXHJcbiAgICAgICAgICAuLi5zcGVjLmVudixcclxuICAgICAgICB9LFxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGNvbnN0IGFib3J0ID0gKCkgPT4ge1xyXG4gICAgICAgIGNhbmNlbGxlZCA9IHRydWU7XHJcbiAgICAgICAgY2hpbGQ/LmtpbGwoXCJTSUdURVJNXCIpO1xyXG4gICAgICB9O1xyXG4gICAgICBhYm9ydEhhbmRsZXIgPSBhYm9ydDtcclxuXHJcbiAgICAgIGlmIChzcGVjLnNpZ25hbC5hYm9ydGVkKSB7XHJcbiAgICAgICAgYWJvcnQoKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBzcGVjLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgYWJvcnQsIHsgb25jZTogdHJ1ZSB9KTtcclxuICAgICAgfVxyXG5cclxuICAgICAgdGltZW91dEhhbmRsZSA9IHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgIHRpbWVkT3V0ID0gdHJ1ZTtcclxuICAgICAgICBjaGlsZD8ua2lsbChcIlNJR1RFUk1cIik7XHJcbiAgICAgIH0sIHNwZWMudGltZW91dE1zKTtcclxuXHJcbiAgICAgIGNoaWxkLnN0ZG91dD8ub24oXCJkYXRhXCIsIChjaHVuaykgPT4ge1xyXG4gICAgICAgIHN0ZG91dCArPSBjaHVuay50b1N0cmluZygpO1xyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGNoaWxkLnN0ZGVycj8ub24oXCJkYXRhXCIsIChjaHVuaykgPT4ge1xyXG4gICAgICAgIHN0ZGVyciArPSBjaHVuay50b1N0cmluZygpO1xyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGNoaWxkLm9uKFwiZXJyb3JcIiwgKGVycm9yKSA9PiB7XHJcbiAgICAgICAgcmVqZWN0KGVycm9yKTtcclxuICAgICAgfSk7XHJcblxyXG4gICAgICBjaGlsZC5vbihcImNsb3NlXCIsIChjb2RlKSA9PiB7XHJcbiAgICAgICAgZXhpdENvZGUgPSBjb2RlO1xyXG4gICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgc3RkZXJyID0gc3RkZXJyIHx8IGZvcm1hdFByb2Nlc3NFcnJvcihlcnJvciwgc3BlYy5leGVjdXRhYmxlKTtcclxuICAgIGV4aXRDb2RlID0gZXhpdENvZGUgPz8gLTE7XHJcbiAgfSBmaW5hbGx5IHtcclxuICAgIGlmIChhYm9ydEhhbmRsZXIpIHtcclxuICAgICAgc3BlYy5zaWduYWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGFib3J0SGFuZGxlcik7XHJcbiAgICB9XHJcbiAgICBpZiAodGltZW91dEhhbmRsZSkge1xyXG4gICAgICBjbGVhclRpbWVvdXQodGltZW91dEhhbmRsZSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBjb25zdCBmaW5pc2hlZEF0ID0gbmV3IERhdGUoKTtcclxuICBjb25zdCBkdXJhdGlvbk1zID0gZmluaXNoZWRBdC5nZXRUaW1lKCkgLSBzdGFydGVkQXQuZ2V0VGltZSgpO1xyXG4gIGNvbnN0IHN1Y2Nlc3MgPSAhdGltZWRPdXQgJiYgIWNhbmNlbGxlZCAmJiBleGl0Q29kZSA9PT0gMDtcclxuXHJcbiAgcmV0dXJuIHtcclxuICAgIHJ1bm5lcklkOiBzcGVjLnJ1bm5lcklkLFxyXG4gICAgcnVubmVyTmFtZTogc3BlYy5ydW5uZXJOYW1lLFxyXG4gICAgc3RhcnRlZEF0OiBzdGFydGVkQXQudG9JU09TdHJpbmcoKSxcclxuICAgIGZpbmlzaGVkQXQ6IGZpbmlzaGVkQXQudG9JU09TdHJpbmcoKSxcclxuICAgIGR1cmF0aW9uTXMsXHJcbiAgICBleGl0Q29kZSxcclxuICAgIHN0ZG91dCxcclxuICAgIHN0ZGVycixcclxuICAgIHN1Y2Nlc3MsXHJcbiAgICB0aW1lZE91dCxcclxuICAgIGNhbmNlbGxlZCxcclxuICB9O1xyXG59XHJcblxyXG5mdW5jdGlvbiBmb3JtYXRQcm9jZXNzRXJyb3IoZXJyb3I6IHVua25vd24sIGV4ZWN1dGFibGU6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgaWYgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IgJiYgXCJjb2RlXCIgaW4gZXJyb3IgJiYgKGVycm9yIGFzIE5vZGVKUy5FcnJub0V4Y2VwdGlvbikuY29kZSA9PT0gXCJFTk9FTlRcIikge1xyXG4gICAgcmV0dXJuIGBFeGVjdXRhYmxlIG5vdCBmb3VuZDogJHtleGVjdXRhYmxlfWA7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcnVuVGVtcEZpbGVQcm9jZXNzKHNwZWM6IGxvb21UZW1wU291cmNlU3BlYyk6IFByb21pc2U8bG9vbVJ1blJlc3VsdD4ge1xyXG4gIHJldHVybiB3aXRoVGVtcFNvdXJjZUZpbGUoc3BlYy5maWxlRXh0ZW5zaW9uLCBzcGVjLnNvdXJjZSwgYXN5bmMgKHsgdGVtcEZpbGUsIHRlbXBEaXIgfSkgPT5cclxuICAgIHJ1blByb2Nlc3Moe1xyXG4gICAgICBydW5uZXJJZDogc3BlYy5ydW5uZXJJZCxcclxuICAgICAgcnVubmVyTmFtZTogc3BlYy5ydW5uZXJOYW1lLFxyXG4gICAgICBleGVjdXRhYmxlOiBzcGVjLmV4ZWN1dGFibGUsXHJcbiAgICAgIGFyZ3M6IHNwZWMuYXJncy5tYXAoKHZhbHVlKSA9PiB2YWx1ZS5yZXBsYWNlQWxsKFwie2ZpbGV9XCIsIHRlbXBGaWxlKS5yZXBsYWNlQWxsKFwie3RlbXBEaXJ9XCIsIHRlbXBEaXIpKSxcclxuICAgICAgd29ya2luZ0RpcmVjdG9yeTogc3BlYy53b3JraW5nRGlyZWN0b3J5LFxyXG4gICAgICB0aW1lb3V0TXM6IHNwZWMudGltZW91dE1zLFxyXG4gICAgICBzaWduYWw6IHNwZWMuc2lnbmFsLFxyXG4gICAgICBlbnY6IGV4cGFuZFRlbXBsYXRlZEVudihzcGVjLmVudiwgdGVtcEZpbGUsIHRlbXBEaXIpLFxyXG4gICAgfSksXHJcbiAgKTtcclxufVxyXG5cclxuZnVuY3Rpb24gZXhwYW5kVGVtcGxhdGVkRW52KGVudjogTm9kZUpTLlByb2Nlc3NFbnYgfCB1bmRlZmluZWQsIHRlbXBGaWxlOiBzdHJpbmcsIHRlbXBEaXI6IHN0cmluZyk6IE5vZGVKUy5Qcm9jZXNzRW52IHwgdW5kZWZpbmVkIHtcclxuICBpZiAoIWVudikge1xyXG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICB9XHJcblxyXG4gIHJldHVybiBPYmplY3QuZnJvbUVudHJpZXMoXHJcbiAgICBPYmplY3QuZW50cmllcyhlbnYpLm1hcCgoW2tleSwgdmFsdWVdKSA9PiBbXHJcbiAgICAgIGtleSxcclxuICAgICAgdHlwZW9mIHZhbHVlID09PSBcInN0cmluZ1wiID8gdmFsdWUucmVwbGFjZUFsbChcIntmaWxlfVwiLCB0ZW1wRmlsZSkucmVwbGFjZUFsbChcInt0ZW1wRGlyfVwiLCB0ZW1wRGlyKSA6IHZhbHVlLFxyXG4gICAgXSksXHJcbiAgKTtcclxufVxyXG4iLCAiZXhwb3J0IGZ1bmN0aW9uIHNwbGl0Q29tbWFuZExpbmUoaW5wdXQ6IHN0cmluZyk6IHN0cmluZ1tdIHtcclxuICBjb25zdCBwYXJ0czogc3RyaW5nW10gPSBbXTtcclxuICBsZXQgY3VycmVudCA9IFwiXCI7XHJcbiAgbGV0IHF1b3RlOiBcIidcIiB8IFwiXFxcIlwiIHwgbnVsbCA9IG51bGw7XHJcbiAgbGV0IGVzY2FwaW5nID0gZmFsc2U7XHJcblxyXG4gIGZvciAoY29uc3QgY2hhciBvZiBpbnB1dC50cmltKCkpIHtcclxuICAgIGlmIChlc2NhcGluZykge1xyXG4gICAgICBjdXJyZW50ICs9IGNoYXI7XHJcbiAgICAgIGVzY2FwaW5nID0gZmFsc2U7XHJcbiAgICAgIGNvbnRpbnVlO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChjaGFyID09PSBcIlxcXFxcIikge1xyXG4gICAgICBlc2NhcGluZyA9IHRydWU7XHJcbiAgICAgIGNvbnRpbnVlO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICgoY2hhciA9PT0gXCInXCIgfHwgY2hhciA9PT0gXCJcXFwiXCIpICYmICFxdW90ZSkge1xyXG4gICAgICBxdW90ZSA9IGNoYXI7XHJcbiAgICAgIGNvbnRpbnVlO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChjaGFyID09PSBxdW90ZSkge1xyXG4gICAgICBxdW90ZSA9IG51bGw7XHJcbiAgICAgIGNvbnRpbnVlO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICgvXFxzLy50ZXN0KGNoYXIpICYmICFxdW90ZSkge1xyXG4gICAgICBpZiAoY3VycmVudCkge1xyXG4gICAgICAgIHBhcnRzLnB1c2goY3VycmVudCk7XHJcbiAgICAgICAgY3VycmVudCA9IFwiXCI7XHJcbiAgICAgIH1cclxuICAgICAgY29udGludWU7XHJcbiAgICB9XHJcblxyXG4gICAgY3VycmVudCArPSBjaGFyO1xyXG4gIH1cclxuXHJcbiAgaWYgKGN1cnJlbnQpIHtcclxuICAgIHBhcnRzLnB1c2goY3VycmVudCk7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gcGFydHM7XHJcbn1cclxuIiwgImltcG9ydCB7IERlY29yYXRpb24sIHR5cGUgRWRpdG9yVmlldyB9IGZyb20gXCJAY29kZW1pcnJvci92aWV3XCI7XHJcbmltcG9ydCB0eXBlIHsgUmFuZ2VTZXRCdWlsZGVyIH0gZnJvbSBcIkBjb2RlbWlycm9yL3N0YXRlXCI7XHJcbmltcG9ydCB0eXBlIHsgbG9vbUNvZGVCbG9jayB9IGZyb20gXCIuL3R5cGVzXCI7XHJcblxyXG5pbnRlcmZhY2UgTGx2bVRva2VuIHtcclxuICBmcm9tOiBudW1iZXI7XHJcbiAgdG86IG51bWJlcjtcclxuICBjbGFzc05hbWU6IHN0cmluZztcclxufVxyXG5cclxuY29uc3QgTExWTV9LRVlXT1JEUyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KFtcclxuICAuLi5tYXBXb3JkcyhcImxvb20tbGx2bS1rZXl3b3JkLWNvbnRyb2xcIiwgW1xyXG4gICAgXCJyZXRcIiwgXCJiclwiLCBcInN3aXRjaFwiLCBcImluZGlyZWN0YnJcIiwgXCJpbnZva2VcIiwgXCJjYWxsYnJcIiwgXCJyZXN1bWVcIiwgXCJ1bnJlYWNoYWJsZVwiLCBcImNsZWFudXByZXRcIiwgXCJjYXRjaHJldFwiLCBcImNhdGNoc3dpdGNoXCIsXHJcbiAgXSksXHJcbiAgLi4ubWFwV29yZHMoXCJsb29tLWxsdm0ta2V5d29yZC1kZWNsYXJhdGlvblwiLCBbXHJcbiAgICBcImRlZmluZVwiLCBcImRlY2xhcmVcIiwgXCJ0eXBlXCIsIFwiZ2xvYmFsXCIsIFwiY29uc3RhbnRcIiwgXCJhbGlhc1wiLCBcImlmdW5jXCIsIFwiY29tZGF0XCIsIFwiYXR0cmlidXRlc1wiLCBcInNlY3Rpb25cIiwgXCJnY1wiLCBcInByZWZpeFwiLCBcInByb2xvZ3VlXCIsXHJcbiAgICBcInBlcnNvbmFsaXR5XCIsIFwidXNlbGlzdG9yZGVyXCIsIFwidXNlbGlzdG9yZGVyX2JiXCIsIFwibW9kdWxlXCIsIFwiYXNtXCIsIFwic291cmNlX2ZpbGVuYW1lXCIsIFwidGFyZ2V0XCIsXHJcbiAgXSksXHJcbiAgLi4ubWFwV29yZHMoXCJsb29tLWxsdm0ta2V5d29yZC1tZW1vcnlcIiwgW1xyXG4gICAgXCJhbGxvY2FcIiwgXCJsb2FkXCIsIFwic3RvcmVcIiwgXCJnZXRlbGVtZW50cHRyXCIsIFwiZmVuY2VcIiwgXCJjbXB4Y2hnXCIsIFwiYXRvbWljcm13XCIsIFwiZXh0cmFjdHZhbHVlXCIsIFwiaW5zZXJ0dmFsdWVcIiwgXCJleHRyYWN0ZWxlbWVudFwiLFxyXG4gICAgXCJpbnNlcnRlbGVtZW50XCIsIFwic2h1ZmZsZXZlY3RvclwiLFxyXG4gIF0pLFxyXG4gIC4uLm1hcFdvcmRzKFwibG9vbS1sbHZtLWtleXdvcmQtYXJpdGhtZXRpY1wiLCBbXHJcbiAgICBcImFkZFwiLCBcInN1YlwiLCBcIm11bFwiLCBcInVkaXZcIiwgXCJzZGl2XCIsIFwidXJlbVwiLCBcInNyZW1cIiwgXCJzaGxcIiwgXCJsc2hyXCIsIFwiYXNoclwiLCBcImFuZFwiLCBcIm9yXCIsIFwieG9yXCIsIFwiZm5lZ1wiLCBcImZhZGRcIiwgXCJmc3ViXCIsIFwiZm11bFwiLFxyXG4gICAgXCJmZGl2XCIsIFwiZnJlbVwiLFxyXG4gIF0pLFxyXG4gIC4uLm1hcFdvcmRzKFwibG9vbS1sbHZtLWtleXdvcmQtY29tcGFyaXNvblwiLCBbXCJpY21wXCIsIFwiZmNtcFwiXSksXHJcbiAgLi4ubWFwV29yZHMoXCJsb29tLWxsdm0ta2V5d29yZC1jYXN0XCIsIFtcclxuICAgIFwidHJ1bmNcIiwgXCJ6ZXh0XCIsIFwic2V4dFwiLCBcImZwdHJ1bmNcIiwgXCJmcGV4dFwiLCBcImZwdG91aVwiLCBcImZwdG9zaVwiLCBcInVpdG9mcFwiLCBcInNpdG9mcFwiLCBcInB0cnRvaW50XCIsIFwiaW50dG9wdHJcIiwgXCJiaXRjYXN0XCIsIFwiYWRkcnNwYWNlY2FzdFwiLFxyXG4gIF0pLFxyXG4gIC4uLm1hcFdvcmRzKFwibG9vbS1sbHZtLWtleXdvcmQtb3RoZXJcIiwgW1wicGhpXCIsIFwic2VsZWN0XCIsIFwiZnJlZXplXCIsIFwiY2FsbFwiLCBcImxhbmRpbmdwYWRcIiwgXCJjYXRjaHBhZFwiLCBcImNsZWFudXBwYWRcIiwgXCJ2YV9hcmdcIl0pLFxyXG4gIC4uLm1hcFdvcmRzKFwibG9vbS1sbHZtLWtleXdvcmQtbW9kaWZpZXJcIiwgW1xyXG4gICAgXCJwcml2YXRlXCIsIFwiaW50ZXJuYWxcIiwgXCJhdmFpbGFibGVfZXh0ZXJuYWxseVwiLCBcImxpbmtvbmNlXCIsIFwid2Vha1wiLCBcImNvbW1vblwiLCBcImFwcGVuZGluZ1wiLCBcImV4dGVybl93ZWFrXCIsIFwibGlua29uY2Vfb2RyXCIsIFwid2Vha19vZHJcIixcclxuICAgIFwiZXh0ZXJuYWxcIiwgXCJkZWZhdWx0XCIsIFwiaGlkZGVuXCIsIFwicHJvdGVjdGVkXCIsIFwiZGxsaW1wb3J0XCIsIFwiZGxsZXhwb3J0XCIsIFwiZHNvX2xvY2FsXCIsIFwiZHNvX3ByZWVtcHRhYmxlXCIsIFwiZXh0ZXJuYWxseV9pbml0aWFsaXplZFwiLFxyXG4gICAgXCJ0aHJlYWRfbG9jYWxcIiwgXCJsb2NhbGR5bmFtaWNcIiwgXCJpbml0aWFsZXhlY1wiLCBcImxvY2FsZXhlY1wiLCBcInVubmFtZWRfYWRkclwiLCBcImxvY2FsX3VubmFtZWRfYWRkclwiLCBcImF0b21pY1wiLCBcInVub3JkZXJlZFwiLCBcIm1vbm90b25pY1wiLFxyXG4gICAgXCJhY3F1aXJlXCIsIFwicmVsZWFzZVwiLCBcImFjcV9yZWxcIiwgXCJzZXFfY3N0XCIsIFwic3luY3Njb3BlXCIsIFwidm9sYXRpbGVcIiwgXCJzaW5nbGV0aHJlYWRcIiwgXCJjY2NcIiwgXCJmYXN0Y2NcIiwgXCJjb2xkY2NcIiwgXCJ3ZWJraXRfanNjY1wiLFxyXG4gICAgXCJhbnlyZWdjY1wiLCBcInByZXNlcnZlX21vc3RjY1wiLCBcInByZXNlcnZlX2FsbGNjXCIsIFwiY3h4X2Zhc3RfdGxzY2NcIiwgXCJzd2lmdGNjXCIsIFwidGFpbGNjXCIsIFwiY2ZndWFyZF9jaGVja2NjXCIsIFwidGFpbFwiLCBcIm11c3R0YWlsXCIsIFwibm90YWlsXCIsXHJcbiAgICBcImZhc3RcIiwgXCJubmFuXCIsIFwibmluZlwiLCBcIm5zelwiLCBcImFyY3BcIiwgXCJjb250cmFjdFwiLCBcImFmblwiLCBcInJlYXNzb2NcIiwgXCJudXdcIiwgXCJuc3dcIiwgXCJleGFjdFwiLCBcImluYm91bmRzXCIsIFwidG9cIiwgXCJ4XCIsXHJcbiAgXSksXHJcbiAgLi4ubWFwV29yZHMoXCJsb29tLWxsdm0tcHJlZGljYXRlXCIsIFtcclxuICAgIFwiZXFcIiwgXCJuZVwiLCBcInVndFwiLCBcInVnZVwiLCBcInVsdFwiLCBcInVsZVwiLCBcInNndFwiLCBcInNnZVwiLCBcInNsdFwiLCBcInNsZVwiLCBcIm9lcVwiLCBcIm9ndFwiLCBcIm9nZVwiLCBcIm9sdFwiLCBcIm9sZVwiLCBcIm9uZVwiLCBcIm9yZFwiLCBcInVlcVwiLCBcInVuZVwiLFxyXG4gICAgXCJ1bm9cIixcclxuICBdKSxcclxuICAuLi5tYXBXb3JkcyhcImxvb20tbGx2bS1hdHRyaWJ1dGVcIiwgW1xyXG4gICAgXCJhbHdheXNpbmxpbmVcIiwgXCJhcmdtZW1vbmx5XCIsIFwiYnVpbHRpblwiLCBcImJ5cmVmXCIsIFwiYnl2YWxcIiwgXCJjb2xkXCIsIFwiY29udmVyZ2VudFwiLCBcImRlcmVmZXJlbmNlYWJsZVwiLCBcImRlcmVmZXJlbmNlYWJsZV9vcl9udWxsXCIsIFwiZGlzdGluY3RcIixcclxuICAgIFwiaW1tYXJnXCIsIFwiaW5hbGxvY2FcIiwgXCJpbnJlZ1wiLCBcIm11c3Rwcm9ncmVzc1wiLCBcIm5lc3RcIiwgXCJub2FsaWFzXCIsIFwibm9jYWxsYmFja1wiLCBcIm5vY2FwdHVyZVwiLCBcIm5vZnJlZVwiLCBcIm5vaW5saW5lXCIsIFwibm9ubGF6eWJpbmRcIixcclxuICAgIFwibm9ubnVsbFwiLCBcIm5vcmVjdXJzZVwiLCBcIm5vcmVkem9uZVwiLCBcIm5vcmV0dXJuXCIsIFwibm9zeW5jXCIsIFwibm91bndpbmRcIiwgXCJudWxsX3BvaW50ZXJfaXNfdmFsaWRcIiwgXCJvcGFxdWVcIiwgXCJvcHRub25lXCIsIFwib3B0c2l6ZVwiLFxyXG4gICAgXCJwcmVhbGxvY2F0ZWRcIiwgXCJyZWFkbm9uZVwiLCBcInJlYWRvbmx5XCIsIFwicmV0dXJuZWRcIiwgXCJyZXR1cm5zX3R3aWNlXCIsIFwic2FuaXRpemVfYWRkcmVzc1wiLCBcInNhbml0aXplX2h3YWRkcmVzc1wiLCBcInNhbml0aXplX21lbW9yeVwiLFxyXG4gICAgXCJzYW5pdGl6ZV90aHJlYWRcIiwgXCJzaWduZXh0XCIsIFwic3BlY3VsYXRhYmxlXCIsIFwic3JldFwiLCBcInNzcFwiLCBcInNzcHJlcVwiLCBcInNzcHN0cm9uZ1wiLCBcInN3aWZ0YXN5bmNcIiwgXCJzd2lmdHNlbGZcIiwgXCJzd2lmdGVycm9yXCIsIFwidXd0YWJsZVwiLFxyXG4gICAgXCJ3aWxscmV0dXJuXCIsIFwid3JpdGVvbmx5XCIsIFwiemVyb2V4dFwiLFxyXG4gIF0pLFxyXG4gIC4uLm1hcFdvcmRzKFwibG9vbS1sbHZtLWNvbnN0YW50XCIsIFtcInRydWVcIiwgXCJmYWxzZVwiLCBcIm51bGxcIiwgXCJub25lXCIsIFwidW5kZWZcIiwgXCJwb2lzb25cIiwgXCJ6ZXJvaW5pdGlhbGl6ZXJcIl0pLFxyXG5dKTtcclxuXHJcbmNvbnN0IExMVk1fUFJJTUlUSVZFX1RZUEVTID0gbmV3IFNldChbXHJcbiAgXCJ2b2lkXCIsIFwibGFiZWxcIiwgXCJ0b2tlblwiLCBcIm1ldGFkYXRhXCIsIFwieDg2X21teFwiLCBcIng4Nl9hbXhcIiwgXCJoYWxmXCIsIFwiYmZsb2F0XCIsIFwiZmxvYXRcIiwgXCJkb3VibGVcIiwgXCJmcDEyOFwiLCBcIng4Nl9mcDgwXCIsIFwicHBjX2ZwMTI4XCIsIFwicHRyXCIsXHJcbl0pO1xyXG5cclxuY29uc3QgUFVOQ1RVQVRJT05fQ0xBU1MgPSBcImxvb20tbGx2bS1wdW5jdHVhdGlvblwiO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGhpZ2hsaWdodExsdm1FbGVtZW50KGNvZGVFbGVtZW50OiBIVE1MRWxlbWVudCwgc291cmNlOiBzdHJpbmcpOiB2b2lkIHtcclxuICBjb2RlRWxlbWVudC5lbXB0eSgpO1xyXG4gIGNvZGVFbGVtZW50LmFkZENsYXNzKFwibG9vbS1sbHZtLWNvZGVcIik7XHJcblxyXG4gIGNvbnN0IGxpbmVzID0gc291cmNlLnNwbGl0KFwiXFxuXCIpO1xyXG4gIGxpbmVzLmZvckVhY2goKGxpbmUsIGluZGV4KSA9PiB7XHJcbiAgICBhcHBlbmRIaWdobGlnaHRlZExpbmUoY29kZUVsZW1lbnQsIGxpbmUpO1xyXG4gICAgaWYgKGluZGV4IDwgbGluZXMubGVuZ3RoIC0gMSkge1xyXG4gICAgICBjb2RlRWxlbWVudC5hcHBlbmRUZXh0KFwiXFxuXCIpO1xyXG4gICAgfVxyXG4gIH0pO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gYWRkTGx2bURlY29yYXRpb25zKFxyXG4gIGJ1aWxkZXI6IFJhbmdlU2V0QnVpbGRlcjxEZWNvcmF0aW9uPixcclxuICB2aWV3OiBFZGl0b3JWaWV3LFxyXG4gIGJsb2NrOiBsb29tQ29kZUJsb2NrLFxyXG4pOiB2b2lkIHtcclxuICBjb25zdCBjb250ZW50TGluZUNvdW50ID0gZ2V0Q29udGVudExpbmVDb3VudChibG9jayk7XHJcbiAgaWYgKCFjb250ZW50TGluZUNvdW50KSB7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG5cclxuICBjb25zdCBsaW5lcyA9IGJsb2NrLmNvbnRlbnQuc3BsaXQoXCJcXG5cIik7XHJcbiAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IGNvbnRlbnRMaW5lQ291bnQ7IGluZGV4ICs9IDEpIHtcclxuICAgIGNvbnN0IGxpbmUgPSBsaW5lc1tpbmRleF0gPz8gXCJcIjtcclxuICAgIGNvbnN0IHRva2VucyA9IHRva2VuaXplTGx2bUxpbmUobGluZSk7XHJcbiAgICBpZiAoIXRva2Vucy5sZW5ndGgpIHtcclxuICAgICAgY29udGludWU7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgZG9jTGluZSA9IHZpZXcuc3RhdGUuZG9jLmxpbmUoYmxvY2suc3RhcnRMaW5lICsgMiArIGluZGV4KTtcclxuICAgIGZvciAoY29uc3QgdG9rZW4gb2YgdG9rZW5zKSB7XHJcbiAgICAgIGlmICh0b2tlbi5mcm9tID09PSB0b2tlbi50bykge1xyXG4gICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICB9XHJcbiAgICAgIGJ1aWxkZXIuYWRkKFxyXG4gICAgICAgIGRvY0xpbmUuZnJvbSArIHRva2VuLmZyb20sXHJcbiAgICAgICAgZG9jTGluZS5mcm9tICsgdG9rZW4udG8sXHJcbiAgICAgICAgRGVjb3JhdGlvbi5tYXJrKHsgY2xhc3M6IHRva2VuLmNsYXNzTmFtZSB9KSxcclxuICAgICAgKTtcclxuICAgIH1cclxuICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGFwcGVuZEhpZ2hsaWdodGVkTGluZShjb250YWluZXI6IEhUTUxFbGVtZW50LCBsaW5lOiBzdHJpbmcpOiB2b2lkIHtcclxuICBsZXQgY3Vyc29yID0gMDtcclxuXHJcbiAgZm9yIChjb25zdCB0b2tlbiBvZiB0b2tlbml6ZUxsdm1MaW5lKGxpbmUpKSB7XHJcbiAgICBpZiAodG9rZW4uZnJvbSA+IGN1cnNvcikge1xyXG4gICAgICBjb250YWluZXIuYXBwZW5kVGV4dChsaW5lLnNsaWNlKGN1cnNvciwgdG9rZW4uZnJvbSkpO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHNwYW4gPSBjb250YWluZXIuY3JlYXRlU3Bhbih7IGNsczogdG9rZW4uY2xhc3NOYW1lIH0pO1xyXG4gICAgc3Bhbi5zZXRUZXh0KGxpbmUuc2xpY2UodG9rZW4uZnJvbSwgdG9rZW4udG8pKTtcclxuICAgIGN1cnNvciA9IHRva2VuLnRvO1xyXG4gIH1cclxuXHJcbiAgaWYgKGN1cnNvciA8IGxpbmUubGVuZ3RoKSB7XHJcbiAgICBjb250YWluZXIuYXBwZW5kVGV4dChsaW5lLnNsaWNlKGN1cnNvcikpO1xyXG4gIH1cclxufVxyXG5cclxuZnVuY3Rpb24gdG9rZW5pemVMbHZtTGluZShsaW5lOiBzdHJpbmcpOiBMbHZtVG9rZW5bXSB7XHJcbiAgY29uc3QgdG9rZW5zOiBMbHZtVG9rZW5bXSA9IFtdO1xyXG4gIGxldCBpbmRleCA9IDA7XHJcblxyXG4gIGFkZExhYmVsVG9rZW4obGluZSwgdG9rZW5zKTtcclxuXHJcbiAgd2hpbGUgKGluZGV4IDwgbGluZS5sZW5ndGgpIHtcclxuICAgIGNvbnN0IGN1cnJlbnQgPSBsaW5lW2luZGV4XTtcclxuICAgIGlmIChjdXJyZW50ID09PSBcIjtcIikge1xyXG4gICAgICB0b2tlbnMucHVzaCh7IGZyb206IGluZGV4LCB0bzogbGluZS5sZW5ndGgsIGNsYXNzTmFtZTogXCJsb29tLWxsdm0tY29tbWVudFwiIH0pO1xyXG4gICAgICBicmVhaztcclxuICAgIH1cclxuXHJcbiAgICBpZiAoL1xccy8udGVzdChjdXJyZW50KSkge1xyXG4gICAgICBpbmRleCArPSAxO1xyXG4gICAgICBjb250aW51ZTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBzdHJpbmdUb2tlbiA9IHJlYWRTdHJpbmdUb2tlbihsaW5lLCBpbmRleCk7XHJcbiAgICBpZiAoc3RyaW5nVG9rZW4pIHtcclxuICAgICAgaWYgKHN0cmluZ1Rva2VuLnByZWZpeEVuZCA+IGluZGV4KSB7XHJcbiAgICAgICAgdG9rZW5zLnB1c2goeyBmcm9tOiBpbmRleCwgdG86IHN0cmluZ1Rva2VuLnByZWZpeEVuZCwgY2xhc3NOYW1lOiBcImxvb20tbGx2bS1zdHJpbmctcHJlZml4XCIgfSk7XHJcbiAgICAgIH1cclxuICAgICAgdG9rZW5zLnB1c2goeyBmcm9tOiBzdHJpbmdUb2tlbi52YWx1ZVN0YXJ0LCB0bzogc3RyaW5nVG9rZW4udmFsdWVFbmQsIGNsYXNzTmFtZTogXCJsb29tLWxsdm0tc3RyaW5nXCIgfSk7XHJcbiAgICAgIGluZGV4ID0gc3RyaW5nVG9rZW4udmFsdWVFbmQ7XHJcbiAgICAgIGNvbnRpbnVlO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IG1hdGNoZWQgPVxyXG4gICAgICBtYXRjaFJlZ2V4VG9rZW4obGluZSwgaW5kZXgsIC9AbGx2bVxcLltBLVphLXokLl8wLTldKy95LCBcImxvb20tbGx2bS1pbnRyaW5zaWNcIiwgdG9rZW5zKSB8fFxyXG4gICAgICBtYXRjaFJlZ2V4VG9rZW4obGluZSwgaW5kZXgsIC9AW0EtWmEteiQuXy1dW0EtWmEteiQuXzAtOS1dKnxAXFxkK1xcYi95LCBcImxvb20tbGx2bS1nbG9iYWxcIiwgdG9rZW5zKSB8fFxyXG4gICAgICBtYXRjaFJlZ2V4VG9rZW4obGluZSwgaW5kZXgsIC8lW0EtWmEteiQuXy1dW0EtWmEteiQuXzAtOS1dKnwlXFxkK1xcYi95LCBcImxvb20tbGx2bS1sb2NhbFwiLCB0b2tlbnMpIHx8XHJcbiAgICAgIG1hdGNoUmVnZXhUb2tlbihsaW5lLCBpbmRleCwgLyFbQS1aYS16JC5fLV1bQS1aYS16JC5fMC05LV0qfCFcXGQrXFxiL3ksIFwibG9vbS1sbHZtLW1ldGFkYXRhXCIsIHRva2VucykgfHxcclxuICAgICAgbWF0Y2hSZWdleFRva2VuKGxpbmUsIGluZGV4LCAvXFwkW0EtWmEteiQuXy1dW0EtWmEteiQuXzAtOS1dKi95LCBcImxvb20tbGx2bS1jb21kYXRcIiwgdG9rZW5zKSB8fFxyXG4gICAgICBtYXRjaFJlZ2V4VG9rZW4obGluZSwgaW5kZXgsIC8jXFxkK1xcYi95LCBcImxvb20tbGx2bS1hdHRyaWJ1dGUtZ3JvdXBcIiwgdG9rZW5zKSB8fFxyXG4gICAgICBtYXRjaFJlZ2V4VG9rZW4obGluZSwgaW5kZXgsIC9cXGJhZGRyc3BhY2VcXHMqXFwoXFxzKlxcZCtcXHMqXFwpL3ksIFwibG9vbS1sbHZtLXR5cGVcIiwgdG9rZW5zKSB8fFxyXG4gICAgICBtYXRjaFJlZ2V4VG9rZW4obGluZSwgaW5kZXgsIC9bLStdPzB4WzAtOUEtRmEtZl0rXFxiL3ksIFwibG9vbS1sbHZtLW51bWJlclwiLCB0b2tlbnMpIHx8XHJcbiAgICAgIG1hdGNoUmVnZXhUb2tlbihsaW5lLCBpbmRleCwgL1stK10/KD86XFxkK1xcLlxcZCp8XFwuXFxkK3xcXGQrKSg/OltlRV1bLStdP1xcZCspXFxiL3ksIFwibG9vbS1sbHZtLW51bWJlclwiLCB0b2tlbnMpIHx8XHJcbiAgICAgIG1hdGNoUmVnZXhUb2tlbihsaW5lLCBpbmRleCwgL1stK10/KD86XFxkK1xcLlxcZCp8XFwuXFxkKylcXGIveSwgXCJsb29tLWxsdm0tbnVtYmVyXCIsIHRva2VucykgfHxcclxuICAgICAgbWF0Y2hSZWdleFRva2VuKGxpbmUsIGluZGV4LCAvWy0rXT9cXGQrXFxiL3ksIFwibG9vbS1sbHZtLW51bWJlclwiLCB0b2tlbnMpIHx8XHJcbiAgICAgIG1hdGNoUmVnZXhUb2tlbihsaW5lLCBpbmRleCwgL1xcLlxcLlxcLi95LCBcImxvb20tbGx2bS1wdW5jdHVhdGlvblwiLCB0b2tlbnMpO1xyXG5cclxuICAgIGlmIChtYXRjaGVkKSB7XHJcbiAgICAgIGluZGV4ID0gbWF0Y2hlZDtcclxuICAgICAgY29udGludWU7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3Qgd29yZCA9IHJlYWRXb3JkKGxpbmUsIGluZGV4KTtcclxuICAgIGlmICh3b3JkKSB7XHJcbiAgICAgIHRva2Vucy5wdXNoKHtcclxuICAgICAgICBmcm9tOiBpbmRleCxcclxuICAgICAgICB0bzogd29yZC5lbmQsXHJcbiAgICAgICAgY2xhc3NOYW1lOiBjbGFzc2lmeVdvcmQod29yZC52YWx1ZSksXHJcbiAgICAgIH0pO1xyXG4gICAgICBpbmRleCA9IHdvcmQuZW5kO1xyXG4gICAgICBjb250aW51ZTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoXCIoKVtde308Piw6PSpcIi5pbmNsdWRlcyhjdXJyZW50KSkge1xyXG4gICAgICB0b2tlbnMucHVzaCh7IGZyb206IGluZGV4LCB0bzogaW5kZXggKyAxLCBjbGFzc05hbWU6IFBVTkNUVUFUSU9OX0NMQVNTIH0pO1xyXG4gICAgICBpbmRleCArPSAxO1xyXG4gICAgICBjb250aW51ZTtcclxuICAgIH1cclxuXHJcbiAgICBpbmRleCArPSAxO1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIG5vcm1hbGl6ZVRva2Vucyh0b2tlbnMpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBhZGRMYWJlbFRva2VuKGxpbmU6IHN0cmluZywgdG9rZW5zOiBMbHZtVG9rZW5bXSk6IHZvaWQge1xyXG4gIGNvbnN0IG1hdGNoID0gbGluZS5tYXRjaCgvXihcXHMqKSg/OihbQS1aYS16JC5fLV1bQS1aYS16JC5fMC05LV0qfFxcZCspfCglW0EtWmEteiQuXy1dW0EtWmEteiQuXzAtOS1dKnwlXFxkKykpKDopLyk7XHJcbiAgaWYgKCFtYXRjaCB8fCBtYXRjaC5pbmRleCA9PSBudWxsKSB7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG5cclxuICBjb25zdCBsYWJlbFN0YXJ0ID0gbWF0Y2hbMV0ubGVuZ3RoO1xyXG4gIGNvbnN0IGxhYmVsVGV4dCA9IG1hdGNoWzJdID8/IG1hdGNoWzNdO1xyXG4gIGlmICghbGFiZWxUZXh0KSB7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG5cclxuICB0b2tlbnMucHVzaCh7XHJcbiAgICBmcm9tOiBsYWJlbFN0YXJ0LFxyXG4gICAgdG86IGxhYmVsU3RhcnQgKyBsYWJlbFRleHQubGVuZ3RoLFxyXG4gICAgY2xhc3NOYW1lOiBcImxvb20tbGx2bS1sYWJlbFwiLFxyXG4gIH0pO1xyXG4gIHRva2Vucy5wdXNoKHtcclxuICAgIGZyb206IGxhYmVsU3RhcnQgKyBsYWJlbFRleHQubGVuZ3RoLFxyXG4gICAgdG86IGxhYmVsU3RhcnQgKyBsYWJlbFRleHQubGVuZ3RoICsgMSxcclxuICAgIGNsYXNzTmFtZTogUFVOQ1RVQVRJT05fQ0xBU1MsXHJcbiAgfSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNsYXNzaWZ5V29yZCh3b3JkOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gIGlmICgvXmlcXGQrJC8udGVzdCh3b3JkKSB8fCBMTFZNX1BSSU1JVElWRV9UWVBFUy5oYXMod29yZCkpIHtcclxuICAgIHJldHVybiBcImxvb20tbGx2bS10eXBlXCI7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gTExWTV9LRVlXT1JEUy5nZXQod29yZCkgPz8gXCJsb29tLWxsdm0tcGxhaW5cIjtcclxufVxyXG5cclxuZnVuY3Rpb24gcmVhZFdvcmQobGluZTogc3RyaW5nLCBpbmRleDogbnVtYmVyKTogeyB2YWx1ZTogc3RyaW5nOyBlbmQ6IG51bWJlciB9IHwgbnVsbCB7XHJcbiAgY29uc3QgbWF0Y2ggPSAvW0EtWmEtel9dW0EtWmEtejAtOV8uLV0qL3k7XHJcbiAgbWF0Y2gubGFzdEluZGV4ID0gaW5kZXg7XHJcbiAgY29uc3QgcmVzdWx0ID0gbWF0Y2guZXhlYyhsaW5lKTtcclxuICBpZiAoIXJlc3VsdCkge1xyXG4gICAgcmV0dXJuIG51bGw7XHJcbiAgfVxyXG5cclxuICByZXR1cm4ge1xyXG4gICAgdmFsdWU6IHJlc3VsdFswXSxcclxuICAgIGVuZDogbWF0Y2gubGFzdEluZGV4LFxyXG4gIH07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlYWRTdHJpbmdUb2tlbihsaW5lOiBzdHJpbmcsIGluZGV4OiBudW1iZXIpOiB7IHByZWZpeEVuZDogbnVtYmVyOyB2YWx1ZVN0YXJ0OiBudW1iZXI7IHZhbHVlRW5kOiBudW1iZXIgfSB8IG51bGwge1xyXG4gIGxldCBjdXJzb3IgPSBpbmRleDtcclxuICBpZiAobGluZVtjdXJzb3JdID09PSBcImNcIiAmJiBsaW5lW2N1cnNvciArIDFdID09PSBcIlxcXCJcIikge1xyXG4gICAgY3Vyc29yICs9IDE7XHJcbiAgfVxyXG5cclxuICBpZiAobGluZVtjdXJzb3JdICE9PSBcIlxcXCJcIikge1xyXG4gICAgcmV0dXJuIG51bGw7XHJcbiAgfVxyXG5cclxuICBjb25zdCB2YWx1ZVN0YXJ0ID0gY3Vyc29yO1xyXG4gIGN1cnNvciArPSAxO1xyXG4gIHdoaWxlIChjdXJzb3IgPCBsaW5lLmxlbmd0aCkge1xyXG4gICAgaWYgKGxpbmVbY3Vyc29yXSA9PT0gXCJcXFxcXCIpIHtcclxuICAgICAgY3Vyc29yICs9IDI7XHJcbiAgICAgIGNvbnRpbnVlO1xyXG4gICAgfVxyXG4gICAgaWYgKGxpbmVbY3Vyc29yXSA9PT0gXCJcXFwiXCIpIHtcclxuICAgICAgY3Vyc29yICs9IDE7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG4gICAgY3Vyc29yICs9IDE7XHJcbiAgfVxyXG5cclxuICByZXR1cm4ge1xyXG4gICAgcHJlZml4RW5kOiB2YWx1ZVN0YXJ0LFxyXG4gICAgdmFsdWVTdGFydCxcclxuICAgIHZhbHVlRW5kOiBjdXJzb3IsXHJcbiAgfTtcclxufVxyXG5cclxuZnVuY3Rpb24gbWF0Y2hSZWdleFRva2VuKFxyXG4gIGxpbmU6IHN0cmluZyxcclxuICBpbmRleDogbnVtYmVyLFxyXG4gIHJlZ2V4OiBSZWdFeHAsXHJcbiAgY2xhc3NOYW1lOiBzdHJpbmcsXHJcbiAgdG9rZW5zOiBMbHZtVG9rZW5bXSxcclxuKTogbnVtYmVyIHwgbnVsbCB7XHJcbiAgcmVnZXgubGFzdEluZGV4ID0gaW5kZXg7XHJcbiAgY29uc3QgbWF0Y2ggPSByZWdleC5leGVjKGxpbmUpO1xyXG4gIGlmICghbWF0Y2gpIHtcclxuICAgIHJldHVybiBudWxsO1xyXG4gIH1cclxuXHJcbiAgdG9rZW5zLnB1c2goeyBmcm9tOiBpbmRleCwgdG86IHJlZ2V4Lmxhc3RJbmRleCwgY2xhc3NOYW1lIH0pO1xyXG4gIHJldHVybiByZWdleC5sYXN0SW5kZXg7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG5vcm1hbGl6ZVRva2Vucyh0b2tlbnM6IExsdm1Ub2tlbltdKTogTGx2bVRva2VuW10ge1xyXG4gIHRva2Vucy5zb3J0KChsZWZ0LCByaWdodCkgPT4gbGVmdC5mcm9tIC0gcmlnaHQuZnJvbSB8fCBsZWZ0LnRvIC0gcmlnaHQudG8pO1xyXG4gIGNvbnN0IG5vcm1hbGl6ZWQ6IExsdm1Ub2tlbltdID0gW107XHJcbiAgbGV0IGN1cnNvciA9IDA7XHJcblxyXG4gIGZvciAoY29uc3QgdG9rZW4gb2YgdG9rZW5zKSB7XHJcbiAgICBpZiAodG9rZW4udG8gPD0gY3Vyc29yKSB7XHJcbiAgICAgIGNvbnRpbnVlO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGZyb20gPSBNYXRoLm1heCh0b2tlbi5mcm9tLCBjdXJzb3IpO1xyXG4gICAgbm9ybWFsaXplZC5wdXNoKHsgLi4udG9rZW4sIGZyb20gfSk7XHJcbiAgICBjdXJzb3IgPSB0b2tlbi50bztcclxuICB9XHJcblxyXG4gIHJldHVybiBub3JtYWxpemVkO1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRDb250ZW50TGluZUNvdW50KGJsb2NrOiBsb29tQ29kZUJsb2NrKTogbnVtYmVyIHtcclxuICBpZiAoYmxvY2suZW5kTGluZSA9PT0gYmxvY2suc3RhcnRMaW5lKSB7XHJcbiAgICByZXR1cm4gMDtcclxuICB9XHJcblxyXG4gIGlmIChibG9jay5jb250ZW50Lmxlbmd0aCA9PT0gMCkge1xyXG4gICAgcmV0dXJuIGJsb2NrLmVuZExpbmUgPiBibG9jay5zdGFydExpbmUgKyAxID8gMSA6IDA7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gYmxvY2suY29udGVudC5zcGxpdChcIlxcblwiKS5sZW5ndGg7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG1hcFdvcmRzKGNsYXNzTmFtZTogc3RyaW5nLCB3b3Jkczogc3RyaW5nW10pOiBBcnJheTxbc3RyaW5nLCBzdHJpbmddPiB7XHJcbiAgcmV0dXJuIHdvcmRzLm1hcCgod29yZCkgPT4gW3dvcmQsIGNsYXNzTmFtZV0pO1xyXG59XHJcbiIsICJpbXBvcnQgeyBjcmVhdGVIYXNoIH0gZnJvbSBcImNyeXB0b1wiO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHNob3J0SGFzaChpbnB1dDogc3RyaW5nKTogc3RyaW5nIHtcclxuICByZXR1cm4gY3JlYXRlSGFzaChcInNoYTI1NlwiKS51cGRhdGUoaW5wdXQpLmRpZ2VzdChcImhleFwiKS5zbGljZSgwLCAxNik7XHJcbn1cclxuIiwgImltcG9ydCB7IHNob3J0SGFzaCB9IGZyb20gXCIuL3V0aWxzL2hhc2hcIjtcclxuaW1wb3J0IHR5cGUgeyBsb29tQ29kZUJsb2NrLCBsb29tTm9ybWFsaXplZExhbmd1YWdlLCBsb29tUGx1Z2luU2V0dGluZ3MgfSBmcm9tIFwiLi90eXBlc1wiO1xyXG5cclxuY29uc3QgTEFOR1VBR0VfQUxJQVNFUzogUmVjb3JkPHN0cmluZywgbG9vbU5vcm1hbGl6ZWRMYW5ndWFnZT4gPSB7XHJcbiAgcHl0aG9uOiBcInB5dGhvblwiLFxyXG4gIHB5OiBcInB5dGhvblwiLFxyXG4gIGphdmFzY3JpcHQ6IFwiamF2YXNjcmlwdFwiLFxyXG4gIGpzOiBcImphdmFzY3JpcHRcIixcclxuICB0eXBlc2NyaXB0OiBcInR5cGVzY3JpcHRcIixcclxuICB0czogXCJ0eXBlc2NyaXB0XCIsXHJcbiAgb2NhbWw6IFwib2NhbWxcIixcclxuICBtbDogXCJvY2FtbFwiLFxyXG4gIGM6IFwiY1wiLFxyXG4gIGg6IFwiY1wiLFxyXG4gIGNwcDogXCJjcHBcIixcclxuICBjeHg6IFwiY3BwXCIsXHJcbiAgY2M6IFwiY3BwXCIsXHJcbiAgXCJjKytcIjogXCJjcHBcIixcclxuICBzaGVsbDogXCJzaGVsbFwiLFxyXG4gIHNoOiBcInNoZWxsXCIsXHJcbiAgYmFzaDogXCJzaGVsbFwiLFxyXG4gIHpzaDogXCJzaGVsbFwiLFxyXG4gIHJ1Ynk6IFwicnVieVwiLFxyXG4gIHJiOiBcInJ1YnlcIixcclxuICBwZXJsOiBcInBlcmxcIixcclxuICBwbDogXCJwZXJsXCIsXHJcbiAgbHVhOiBcImx1YVwiLFxyXG4gIHBocDogXCJwaHBcIixcclxuICBnbzogXCJnb1wiLFxyXG4gIGdvbGFuZzogXCJnb1wiLFxyXG4gIHJ1c3Q6IFwicnVzdFwiLFxyXG4gIHJzOiBcInJ1c3RcIixcclxuICBoYXNrZWxsOiBcImhhc2tlbGxcIixcclxuICBoczogXCJoYXNrZWxsXCIsXHJcbiAgamF2YTogXCJqYXZhXCIsXHJcbiAgbGx2bTogXCJsbHZtLWlyXCIsXHJcbiAgbGx2bWlyOiBcImxsdm0taXJcIixcclxuICBcImxsdm0taXJcIjogXCJsbHZtLWlyXCIsXHJcbiAgbGw6IFwibGx2bS1pclwiLFxyXG4gIGxlYW46IFwibGVhblwiLFxyXG4gIGxlYW40OiBcImxlYW5cIixcclxuICBjb3E6IFwiY29xXCIsXHJcbiAgdjogXCJjb3FcIixcclxuICBzbXQ6IFwic210bGliXCIsXHJcbiAgc210MjogXCJzbXRsaWJcIixcclxuICBzbXRsaWI6IFwic210bGliXCIsXHJcbiAgXCJzbXQtbGliXCI6IFwic210bGliXCIsXHJcbiAgejM6IFwic210bGliXCIsXHJcbn07XHJcblxyXG5jb25zdCBPVVRQVVRfU1RBUlQgPSAvXjwhLS1cXHMqbG9vbTpvdXRwdXQ6c3RhcnRcXHMraWQ9KFthLWYwLTldKylcXHMqLS0+JC9pO1xyXG5jb25zdCBPVVRQVVRfRU5EID0gL148IS0tXFxzKmxvb206b3V0cHV0OmVuZFxccyotLT4kL2k7XHJcbmNvbnN0IEZFTkNFX1NUQVJUID0gL14oYGBgK3x+fn4rKVxccyooW15cXHNgXSopPy4qJC87XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gbm9ybWFsaXplTGFuZ3VhZ2UocmF3TGFuZ3VhZ2U6IHN0cmluZywgc2V0dGluZ3M/OiBsb29tUGx1Z2luU2V0dGluZ3MpOiBsb29tTm9ybWFsaXplZExhbmd1YWdlIHwgbnVsbCB7XHJcbiAgY29uc3Qgbm9ybWFsaXplZCA9IHJhd0xhbmd1YWdlLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xyXG5cclxuICBmb3IgKGNvbnN0IGxhbmd1YWdlIG9mIHNldHRpbmdzPy5jdXN0b21MYW5ndWFnZXMgPz8gW10pIHtcclxuICAgIGNvbnN0IG5hbWUgPSBsYW5ndWFnZS5uYW1lLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xyXG4gICAgY29uc3QgYWxpYXNlcyA9IHBhcnNlQWxpYXNMaXN0KGxhbmd1YWdlLmFsaWFzZXMpO1xyXG4gICAgaWYgKG5hbWUgJiYgKG5hbWUgPT09IG5vcm1hbGl6ZWQgfHwgYWxpYXNlcy5pbmNsdWRlcyhub3JtYWxpemVkKSkpIHtcclxuICAgICAgcmV0dXJuIGxhbmd1YWdlLm5hbWUudHJpbSgpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIExBTkdVQUdFX0FMSUFTRVNbbm9ybWFsaXplZF0gPz8gbnVsbDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGdldFN1cHBvcnRlZExhbmd1YWdlQWxpYXNlcyhzZXR0aW5ncz86IGxvb21QbHVnaW5TZXR0aW5ncyk6IHN0cmluZ1tdIHtcclxuICByZXR1cm4gW1xyXG4gICAgLi4uT2JqZWN0LmtleXMoTEFOR1VBR0VfQUxJQVNFUyksXHJcbiAgICAuLi4oc2V0dGluZ3M/LmN1c3RvbUxhbmd1YWdlcyA/PyBbXSkuZmxhdE1hcCgobGFuZ3VhZ2UpID0+IFtsYW5ndWFnZS5uYW1lLCAuLi5wYXJzZUFsaWFzTGlzdChsYW5ndWFnZS5hbGlhc2VzKV0pLFxyXG4gIF0ubWFwKChhbGlhcykgPT4gYWxpYXMudG9Mb3dlckNhc2UoKSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBwYXJzZU1hcmtkb3duQ29kZUJsb2NrcyhmaWxlUGF0aDogc3RyaW5nLCBzb3VyY2U6IHN0cmluZywgc2V0dGluZ3M/OiBsb29tUGx1Z2luU2V0dGluZ3MpOiBsb29tQ29kZUJsb2NrW10ge1xyXG4gIGNvbnN0IGxpbmVzID0gc291cmNlLnNwbGl0KC9cXHI/XFxuLyk7XHJcbiAgY29uc3QgYmxvY2tzOiBsb29tQ29kZUJsb2NrW10gPSBbXTtcclxuICBsZXQgb3JkaW5hbCA9IDA7XHJcbiAgbGV0IGluc2lkZU1hbmFnZWRPdXRwdXQgPSBmYWxzZTtcclxuXHJcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lcy5sZW5ndGg7IGkgKz0gMSkge1xyXG4gICAgY29uc3QgbGluZSA9IGxpbmVzW2ldO1xyXG5cclxuICAgIGlmIChpbnNpZGVNYW5hZ2VkT3V0cHV0KSB7XHJcbiAgICAgIGlmIChPVVRQVVRfRU5ELnRlc3QobGluZS50cmltKCkpKSB7XHJcbiAgICAgICAgaW5zaWRlTWFuYWdlZE91dHB1dCA9IGZhbHNlO1xyXG4gICAgICB9XHJcbiAgICAgIGNvbnRpbnVlO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChPVVRQVVRfU1RBUlQudGVzdChsaW5lLnRyaW0oKSkpIHtcclxuICAgICAgaW5zaWRlTWFuYWdlZE91dHB1dCA9IHRydWU7XHJcbiAgICAgIGNvbnRpbnVlO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGZlbmNlTWF0Y2ggPSBsaW5lLm1hdGNoKEZFTkNFX1NUQVJUKTtcclxuICAgIGlmICghZmVuY2VNYXRjaCkge1xyXG4gICAgICBjb250aW51ZTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBzdGFydExpbmUgPSBpO1xyXG4gICAgY29uc3QgZmVuY2VJbmRlbnQgPSBnZXRMZWFkaW5nV2hpdGVzcGFjZShsaW5lKTtcclxuICAgIGNvbnN0IGZlbmNlVG9rZW4gPSBmZW5jZU1hdGNoWzFdO1xyXG4gICAgY29uc3Qgc291cmNlTGFuZ3VhZ2UgPSAoZmVuY2VNYXRjaFsyXSA/PyBcIlwiKS50cmltKCk7XHJcbiAgICBjb25zdCBsYW5ndWFnZSA9IG5vcm1hbGl6ZUxhbmd1YWdlKHNvdXJjZUxhbmd1YWdlLCBzZXR0aW5ncyk7XHJcblxyXG4gICAgbGV0IGVuZExpbmUgPSBpO1xyXG4gICAgY29uc3QgY29udGVudExpbmVzOiBzdHJpbmdbXSA9IFtdO1xyXG5cclxuICAgIGZvciAobGV0IGogPSBpICsgMTsgaiA8IGxpbmVzLmxlbmd0aDsgaiArPSAxKSB7XHJcbiAgICAgIGNvbnN0IGlubmVyTGluZSA9IGxpbmVzW2pdO1xyXG4gICAgICBjb25zdCB0cmltbWVkID0gaW5uZXJMaW5lLnRyaW0oKTtcclxuXHJcbiAgICAgIGlmICh0cmltbWVkLnN0YXJ0c1dpdGgoZmVuY2VUb2tlbikgJiYgL14oYGBgK3x+fn4rKVxccyokLy50ZXN0KHRyaW1tZWQpKSB7XHJcbiAgICAgICAgZW5kTGluZSA9IGo7XHJcbiAgICAgICAgaSA9IGo7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNvbnRlbnRMaW5lcy5wdXNoKHN0cmlwRmVuY2VJbmRlbnQoaW5uZXJMaW5lLCBmZW5jZUluZGVudCkpO1xyXG4gICAgICBlbmRMaW5lID0gajtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoIWxhbmd1YWdlKSB7XHJcbiAgICAgIGNvbnRpbnVlO1xyXG4gICAgfVxyXG5cclxuICAgIG9yZGluYWwgKz0gMTtcclxuICAgIGNvbnN0IGNvbnRlbnQgPSBjb250ZW50TGluZXMuam9pbihcIlxcblwiKTtcclxuICAgIGNvbnN0IGNvbnRlbnRIYXNoID0gc2hvcnRIYXNoKGNvbnRlbnQpO1xyXG4gICAgY29uc3QgaWQgPSBzaG9ydEhhc2goYCR7ZmlsZVBhdGh9OiR7b3JkaW5hbH06JHtsYW5ndWFnZX06JHtjb250ZW50SGFzaH1gKTtcclxuXHJcbiAgICBibG9ja3MucHVzaCh7XHJcbiAgICAgIGlkLFxyXG4gICAgICBvcmRpbmFsLFxyXG4gICAgICBmaWxlUGF0aCxcclxuICAgICAgbGFuZ3VhZ2UsXHJcbiAgICAgIGxhbmd1YWdlQWxpYXM6IHNvdXJjZUxhbmd1YWdlLnRvTG93ZXJDYXNlKCksXHJcbiAgICAgIHNvdXJjZUxhbmd1YWdlLFxyXG4gICAgICBjb250ZW50LFxyXG4gICAgICBzdGFydExpbmUsXHJcbiAgICAgIGVuZExpbmUsXHJcbiAgICAgIGZlbmNlU3RhcnQ6IDAsXHJcbiAgICAgIGZlbmNlRW5kOiAwLFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gYmxvY2tzO1xyXG59XHJcblxyXG5mdW5jdGlvbiBwYXJzZUFsaWFzTGlzdCh2YWx1ZTogc3RyaW5nKTogc3RyaW5nW10ge1xyXG4gIHJldHVybiB2YWx1ZVxyXG4gICAgLnNwbGl0KFwiLFwiKVxyXG4gICAgLm1hcCgoYWxpYXMpID0+IGFsaWFzLnRyaW0oKS50b0xvd2VyQ2FzZSgpKVxyXG4gICAgLmZpbHRlcihCb29sZWFuKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGZpbmRCbG9ja0F0TGluZShibG9ja3M6IGxvb21Db2RlQmxvY2tbXSwgbGluZTogbnVtYmVyKTogbG9vbUNvZGVCbG9jayB8IG51bGwge1xyXG4gIHJldHVybiBibG9ja3MuZmluZCgoYmxvY2spID0+IGxpbmUgPj0gYmxvY2suc3RhcnRMaW5lICYmIGxpbmUgPD0gYmxvY2suZW5kTGluZSkgPz8gbnVsbDtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0TGVhZGluZ1doaXRlc3BhY2UobGluZTogc3RyaW5nKTogc3RyaW5nIHtcclxuICBjb25zdCBtYXRjaCA9IGxpbmUubWF0Y2goL15bXFx0IF0qLyk7XHJcbiAgcmV0dXJuIG1hdGNoPy5bMF0gPz8gXCJcIjtcclxufVxyXG5cclxuZnVuY3Rpb24gc3RyaXBGZW5jZUluZGVudChsaW5lOiBzdHJpbmcsIGZlbmNlSW5kZW50OiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gIGlmICghZmVuY2VJbmRlbnQpIHtcclxuICAgIHJldHVybiBsaW5lO1xyXG4gIH1cclxuXHJcbiAgbGV0IGluZGV4ID0gMDtcclxuICB3aGlsZSAoaW5kZXggPCBmZW5jZUluZGVudC5sZW5ndGggJiYgaW5kZXggPCBsaW5lLmxlbmd0aCAmJiBsaW5lW2luZGV4XSA9PT0gZmVuY2VJbmRlbnRbaW5kZXhdKSB7XHJcbiAgICBpbmRleCArPSAxO1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIGxpbmUuc2xpY2UoaW5kZXgpO1xyXG59XHJcbiIsICJpbXBvcnQgeyBydW5UZW1wRmlsZVByb2Nlc3MgfSBmcm9tIFwiLi4vZXhlY3V0aW9uL3Byb2Nlc3NSdW5uZXJcIjtcclxuaW1wb3J0IHR5cGUgeyBsb29tQ29kZUJsb2NrLCBsb29tUGx1Z2luU2V0dGluZ3MsIGxvb21SdW5Db250ZXh0LCBsb29tUnVuUmVzdWx0LCBsb29tUnVubmVyIH0gZnJvbSBcIi4uL3R5cGVzXCI7XHJcblxyXG5leHBvcnQgY2xhc3MgTm9kZVJ1bm5lciBpbXBsZW1lbnRzIGxvb21SdW5uZXIge1xyXG4gIGlkID0gXCJub2RlXCI7XHJcbiAgZGlzcGxheU5hbWUgPSBcIk5vZGUuanNcIjtcclxuICBsYW5ndWFnZXMgPSBbXCJqYXZhc2NyaXB0XCIsIFwidHlwZXNjcmlwdFwiXSBhcyBjb25zdDtcclxuXHJcbiAgY2FuUnVuKGJsb2NrOiBsb29tQ29kZUJsb2NrLCBzZXR0aW5nczogbG9vbVBsdWdpblNldHRpbmdzKTogYm9vbGVhbiB7XHJcbiAgICBpZiAoYmxvY2subGFuZ3VhZ2UgPT09IFwiamF2YXNjcmlwdFwiKSB7XHJcbiAgICAgIHJldHVybiBCb29sZWFuKHNldHRpbmdzLm5vZGVFeGVjdXRhYmxlLnRyaW0oKSk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIEJvb2xlYW4oc2V0dGluZ3MudHlwZXNjcmlwdFRyYW5zcGlsZXJFeGVjdXRhYmxlLnRyaW0oKSk7XHJcbiAgfVxyXG5cclxuICBhc3luYyBydW4oYmxvY2s6IGxvb21Db2RlQmxvY2ssIGNvbnRleHQ6IGxvb21SdW5Db250ZXh0LCBzZXR0aW5nczogbG9vbVBsdWdpblNldHRpbmdzKTogUHJvbWlzZTxsb29tUnVuUmVzdWx0PiB7XHJcbiAgICBpZiAoYmxvY2subGFuZ3VhZ2UgPT09IFwiamF2YXNjcmlwdFwiKSB7XHJcbiAgICAgIHJldHVybiBydW5UZW1wRmlsZVByb2Nlc3Moe1xyXG4gICAgICAgIHJ1bm5lcklkOiB0aGlzLmlkLFxyXG4gICAgICAgIHJ1bm5lck5hbWU6IHRoaXMuZGlzcGxheU5hbWUsXHJcbiAgICAgICAgZXhlY3V0YWJsZTogc2V0dGluZ3Mubm9kZUV4ZWN1dGFibGUudHJpbSgpLFxyXG4gICAgICAgIGFyZ3M6IFtcIntmaWxlfVwiXSxcclxuICAgICAgICBmaWxlRXh0ZW5zaW9uOiBcIi5qc1wiLFxyXG4gICAgICAgIHNvdXJjZTogYmxvY2suY29udGVudCxcclxuICAgICAgICB3b3JraW5nRGlyZWN0b3J5OiBjb250ZXh0LndvcmtpbmdEaXJlY3RvcnksXHJcbiAgICAgICAgdGltZW91dE1zOiBjb250ZXh0LnRpbWVvdXRNcyxcclxuICAgICAgICBzaWduYWw6IGNvbnRleHQuc2lnbmFsLFxyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBleGVjdXRhYmxlID0gc2V0dGluZ3MudHlwZXNjcmlwdFRyYW5zcGlsZXJFeGVjdXRhYmxlLnRyaW0oKTtcclxuICAgIGNvbnN0IHJ1bm5lck5hbWUgPSBzZXR0aW5ncy50eXBlc2NyaXB0TW9kZSA9PT0gXCJ0c3hcIiA/IFwiVHlwZVNjcmlwdCAodHN4KVwiIDogXCJUeXBlU2NyaXB0ICh0cy1ub2RlKVwiO1xyXG5cclxuICAgIHJldHVybiBydW5UZW1wRmlsZVByb2Nlc3Moe1xyXG4gICAgICBydW5uZXJJZDogYCR7dGhpcy5pZH06JHtzZXR0aW5ncy50eXBlc2NyaXB0TW9kZX1gLFxyXG4gICAgICBydW5uZXJOYW1lLFxyXG4gICAgICBleGVjdXRhYmxlLFxyXG4gICAgICBhcmdzOiBbXCJ7ZmlsZX1cIl0sXHJcbiAgICAgIGZpbGVFeHRlbnNpb246IFwiLnRzXCIsXHJcbiAgICAgIHNvdXJjZTogYmxvY2suY29udGVudCxcclxuICAgICAgd29ya2luZ0RpcmVjdG9yeTogY29udGV4dC53b3JraW5nRGlyZWN0b3J5LFxyXG4gICAgICB0aW1lb3V0TXM6IGNvbnRleHQudGltZW91dE1zLFxyXG4gICAgICBzaWduYWw6IGNvbnRleHQuc2lnbmFsLFxyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcbiIsICJpbXBvcnQgeyBydW5UZW1wRmlsZVByb2Nlc3MgfSBmcm9tIFwiLi4vZXhlY3V0aW9uL3Byb2Nlc3NSdW5uZXJcIjtcclxuaW1wb3J0IHsgc3BsaXRDb21tYW5kTGluZSB9IGZyb20gXCIuLi91dGlscy9jb21tYW5kXCI7XHJcbmltcG9ydCB0eXBlIHsgbG9vbUNvZGVCbG9jaywgbG9vbUN1c3RvbUxhbmd1YWdlLCBsb29tUGx1Z2luU2V0dGluZ3MsIGxvb21SdW5Db250ZXh0LCBsb29tUnVuUmVzdWx0LCBsb29tUnVubmVyIH0gZnJvbSBcIi4uL3R5cGVzXCI7XHJcblxyXG5leHBvcnQgY2xhc3MgQ3VzdG9tTGFuZ3VhZ2VSdW5uZXIgaW1wbGVtZW50cyBsb29tUnVubmVyIHtcclxuICBpZCA9IFwiY3VzdG9tXCI7XHJcbiAgZGlzcGxheU5hbWUgPSBcIkN1c3RvbSBsYW5ndWFnZVwiO1xyXG4gIGxhbmd1YWdlcyA9IFtdIGFzIGNvbnN0O1xyXG5cclxuICBjYW5SdW4oYmxvY2s6IGxvb21Db2RlQmxvY2ssIHNldHRpbmdzOiBsb29tUGx1Z2luU2V0dGluZ3MpOiBib29sZWFuIHtcclxuICAgIHJldHVybiBCb29sZWFuKHRoaXMuZ2V0Q3VzdG9tTGFuZ3VhZ2UoYmxvY2ssIHNldHRpbmdzKT8uZXhlY3V0YWJsZS50cmltKCkpO1xyXG4gIH1cclxuXHJcbiAgcnVuKGJsb2NrOiBsb29tQ29kZUJsb2NrLCBjb250ZXh0OiBsb29tUnVuQ29udGV4dCwgc2V0dGluZ3M6IGxvb21QbHVnaW5TZXR0aW5ncyk6IFByb21pc2U8bG9vbVJ1blJlc3VsdD4ge1xyXG4gICAgY29uc3QgbGFuZ3VhZ2UgPSB0aGlzLmdldEN1c3RvbUxhbmd1YWdlKGJsb2NrLCBzZXR0aW5ncyk7XHJcbiAgICBpZiAoIWxhbmd1YWdlKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgY3VzdG9tIGxhbmd1YWdlOiAke2Jsb2NrLmxhbmd1YWdlfWApO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBydW5UZW1wRmlsZVByb2Nlc3Moe1xyXG4gICAgICBydW5uZXJJZDogYCR7dGhpcy5pZH06JHtsYW5ndWFnZS5uYW1lfWAsXHJcbiAgICAgIHJ1bm5lck5hbWU6IGxhbmd1YWdlLm5hbWUsXHJcbiAgICAgIGV4ZWN1dGFibGU6IGxhbmd1YWdlLmV4ZWN1dGFibGUudHJpbSgpLFxyXG4gICAgICBhcmdzOiBzcGxpdENvbW1hbmRMaW5lKGxhbmd1YWdlLmFyZ3MgfHwgXCJ7ZmlsZX1cIiksXHJcbiAgICAgIGZpbGVFeHRlbnNpb246IG5vcm1hbGl6ZUV4dGVuc2lvbihsYW5ndWFnZS5leHRlbnNpb24sIGxhbmd1YWdlLm5hbWUpLFxyXG4gICAgICBzb3VyY2U6IGJsb2NrLmNvbnRlbnQsXHJcbiAgICAgIHdvcmtpbmdEaXJlY3Rvcnk6IGNvbnRleHQud29ya2luZ0RpcmVjdG9yeSxcclxuICAgICAgdGltZW91dE1zOiBjb250ZXh0LnRpbWVvdXRNcyxcclxuICAgICAgc2lnbmFsOiBjb250ZXh0LnNpZ25hbCxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRDdXN0b21MYW5ndWFnZShibG9jazogbG9vbUNvZGVCbG9jaywgc2V0dGluZ3M6IGxvb21QbHVnaW5TZXR0aW5ncyk6IGxvb21DdXN0b21MYW5ndWFnZSB8IHVuZGVmaW5lZCB7XHJcbiAgICBjb25zdCBub3JtYWxpemVkID0gYmxvY2subGFuZ3VhZ2UudHJpbSgpLnRvTG93ZXJDYXNlKCk7XHJcbiAgICByZXR1cm4gc2V0dGluZ3MuY3VzdG9tTGFuZ3VhZ2VzLmZpbmQoKGxhbmd1YWdlKSA9PiB7XHJcbiAgICAgIGNvbnN0IG5hbWUgPSBsYW5ndWFnZS5uYW1lLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xyXG4gICAgICBjb25zdCBhbGlhc2VzID0gbGFuZ3VhZ2UuYWxpYXNlc1xyXG4gICAgICAgIC5zcGxpdChcIixcIilcclxuICAgICAgICAubWFwKChhbGlhcykgPT4gYWxpYXMudHJpbSgpLnRvTG93ZXJDYXNlKCkpXHJcbiAgICAgICAgLmZpbHRlcihCb29sZWFuKTtcclxuICAgICAgcmV0dXJuIG5hbWUgPT09IG5vcm1hbGl6ZWQgfHwgYWxpYXNlcy5pbmNsdWRlcyhub3JtYWxpemVkKTtcclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG5cclxuZnVuY3Rpb24gbm9ybWFsaXplRXh0ZW5zaW9uKGV4dGVuc2lvbjogc3RyaW5nLCBuYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gIGNvbnN0IHRyaW1tZWQgPSBleHRlbnNpb24udHJpbSgpO1xyXG4gIGlmICghdHJpbW1lZCkge1xyXG4gICAgcmV0dXJuIGAuJHtuYW1lfWA7XHJcbiAgfVxyXG4gIHJldHVybiB0cmltbWVkLnN0YXJ0c1dpdGgoXCIuXCIpID8gdHJpbW1lZCA6IGAuJHt0cmltbWVkfWA7XHJcbn1cclxuIiwgImltcG9ydCB7IHJ1blRlbXBGaWxlUHJvY2VzcyB9IGZyb20gXCIuLi9leGVjdXRpb24vcHJvY2Vzc1J1bm5lclwiO1xyXG5pbXBvcnQgdHlwZSB7IGxvb21Db2RlQmxvY2ssIGxvb21Ob3JtYWxpemVkTGFuZ3VhZ2UsIGxvb21QbHVnaW5TZXR0aW5ncywgbG9vbVJ1bkNvbnRleHQsIGxvb21SdW5SZXN1bHQsIGxvb21SdW5uZXIgfSBmcm9tIFwiLi4vdHlwZXNcIjtcclxuXHJcbmludGVyZmFjZSBJbnRlcnByZXRlZFNwZWMge1xyXG4gIGxhbmd1YWdlOiBsb29tTm9ybWFsaXplZExhbmd1YWdlO1xyXG4gIGRpc3BsYXlOYW1lOiBzdHJpbmc7XHJcbiAgZXhlY3V0YWJsZTogKHNldHRpbmdzOiBsb29tUGx1Z2luU2V0dGluZ3MpID0+IHN0cmluZztcclxuICBmaWxlRXh0ZW5zaW9uOiBzdHJpbmc7XHJcbiAgYXJncz86IHN0cmluZ1tdO1xyXG4gIGVudj86IE5vZGVKUy5Qcm9jZXNzRW52O1xyXG4gIG1pbmltdW1UaW1lb3V0TXM/OiBudW1iZXI7XHJcbn1cclxuXHJcbmNvbnN0IElOVEVSUFJFVEVEX1NQRUNTOiBJbnRlcnByZXRlZFNwZWNbXSA9IFtcclxuICB7XHJcbiAgICBsYW5ndWFnZTogXCJzaGVsbFwiLFxyXG4gICAgZGlzcGxheU5hbWU6IFwiU2hlbGxcIixcclxuICAgIGV4ZWN1dGFibGU6IChzZXR0aW5ncykgPT4gc2V0dGluZ3Muc2hlbGxFeGVjdXRhYmxlLFxyXG4gICAgZmlsZUV4dGVuc2lvbjogXCIuc2hcIixcclxuICB9LFxyXG4gIHtcclxuICAgIGxhbmd1YWdlOiBcInJ1YnlcIixcclxuICAgIGRpc3BsYXlOYW1lOiBcIlJ1YnlcIixcclxuICAgIGV4ZWN1dGFibGU6IChzZXR0aW5ncykgPT4gc2V0dGluZ3MucnVieUV4ZWN1dGFibGUsXHJcbiAgICBmaWxlRXh0ZW5zaW9uOiBcIi5yYlwiLFxyXG4gIH0sXHJcbiAge1xyXG4gICAgbGFuZ3VhZ2U6IFwicGVybFwiLFxyXG4gICAgZGlzcGxheU5hbWU6IFwiUGVybFwiLFxyXG4gICAgZXhlY3V0YWJsZTogKHNldHRpbmdzKSA9PiBzZXR0aW5ncy5wZXJsRXhlY3V0YWJsZSxcclxuICAgIGZpbGVFeHRlbnNpb246IFwiLnBsXCIsXHJcbiAgfSxcclxuICB7XHJcbiAgICBsYW5ndWFnZTogXCJsdWFcIixcclxuICAgIGRpc3BsYXlOYW1lOiBcIkx1YVwiLFxyXG4gICAgZXhlY3V0YWJsZTogKHNldHRpbmdzKSA9PiBzZXR0aW5ncy5sdWFFeGVjdXRhYmxlLFxyXG4gICAgZmlsZUV4dGVuc2lvbjogXCIubHVhXCIsXHJcbiAgfSxcclxuICB7XHJcbiAgICBsYW5ndWFnZTogXCJwaHBcIixcclxuICAgIGRpc3BsYXlOYW1lOiBcIlBIUFwiLFxyXG4gICAgZXhlY3V0YWJsZTogKHNldHRpbmdzKSA9PiBzZXR0aW5ncy5waHBFeGVjdXRhYmxlLFxyXG4gICAgZmlsZUV4dGVuc2lvbjogXCIucGhwXCIsXHJcbiAgfSxcclxuICB7XHJcbiAgICBsYW5ndWFnZTogXCJnb1wiLFxyXG4gICAgZGlzcGxheU5hbWU6IFwiR29cIixcclxuICAgIGV4ZWN1dGFibGU6IChzZXR0aW5ncykgPT4gc2V0dGluZ3MuZ29FeGVjdXRhYmxlLFxyXG4gICAgZmlsZUV4dGVuc2lvbjogXCIuZ29cIixcclxuICAgIGFyZ3M6IFtcInJ1blwiLCBcIntmaWxlfVwiXSxcclxuICAgIGVudjoge1xyXG4gICAgICBHT0NBQ0hFOiBcInt0ZW1wRGlyfS9nb2NhY2hlXCIsXHJcbiAgICB9LFxyXG4gICAgbWluaW11bVRpbWVvdXRNczogMzBfMDAwLFxyXG4gIH0sXHJcbiAge1xyXG4gICAgbGFuZ3VhZ2U6IFwiaGFza2VsbFwiLFxyXG4gICAgZGlzcGxheU5hbWU6IFwiSGFza2VsbFwiLFxyXG4gICAgZXhlY3V0YWJsZTogKHNldHRpbmdzKSA9PiBzZXR0aW5ncy5oYXNrZWxsRXhlY3V0YWJsZSxcclxuICAgIGZpbGVFeHRlbnNpb246IFwiLmhzXCIsXHJcbiAgICBtaW5pbXVtVGltZW91dE1zOiAzMF8wMDAsXHJcbiAgfSxcclxuXTtcclxuXHJcbmV4cG9ydCBjbGFzcyBJbnRlcnByZXRlZFJ1bm5lciBpbXBsZW1lbnRzIGxvb21SdW5uZXIge1xyXG4gIGlkID0gXCJpbnRlcnByZXRlZFwiO1xyXG4gIGRpc3BsYXlOYW1lID0gXCJJbnRlcnByZXRlZFwiO1xyXG4gIGxhbmd1YWdlcyA9IElOVEVSUFJFVEVEX1NQRUNTLm1hcCgoc3BlYykgPT4gc3BlYy5sYW5ndWFnZSk7XHJcblxyXG4gIGNhblJ1bihibG9jazogbG9vbUNvZGVCbG9jaywgc2V0dGluZ3M6IGxvb21QbHVnaW5TZXR0aW5ncyk6IGJvb2xlYW4ge1xyXG4gICAgY29uc3Qgc3BlYyA9IHRoaXMuZ2V0U3BlYyhibG9jay5sYW5ndWFnZSk7XHJcbiAgICByZXR1cm4gQm9vbGVhbihzcGVjPy5leGVjdXRhYmxlKHNldHRpbmdzKS50cmltKCkpO1xyXG4gIH1cclxuXHJcbiAgcnVuKGJsb2NrOiBsb29tQ29kZUJsb2NrLCBjb250ZXh0OiBsb29tUnVuQ29udGV4dCwgc2V0dGluZ3M6IGxvb21QbHVnaW5TZXR0aW5ncyk6IFByb21pc2U8bG9vbVJ1blJlc3VsdD4ge1xyXG4gICAgY29uc3Qgc3BlYyA9IHRoaXMuZ2V0U3BlYyhibG9jay5sYW5ndWFnZSk7XHJcbiAgICBpZiAoIXNwZWMpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBsYW5ndWFnZTogJHtibG9jay5sYW5ndWFnZX1gKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gcnVuVGVtcEZpbGVQcm9jZXNzKHtcclxuICAgICAgcnVubmVySWQ6IGAke3RoaXMuaWR9OiR7YmxvY2subGFuZ3VhZ2V9YCxcclxuICAgICAgcnVubmVyTmFtZTogc3BlYy5kaXNwbGF5TmFtZSxcclxuICAgICAgZXhlY3V0YWJsZTogc3BlYy5leGVjdXRhYmxlKHNldHRpbmdzKS50cmltKCksXHJcbiAgICAgIGFyZ3M6IHNwZWMuYXJncyA/PyBbXCJ7ZmlsZX1cIl0sXHJcbiAgICAgIGZpbGVFeHRlbnNpb246IHNwZWMuZmlsZUV4dGVuc2lvbixcclxuICAgICAgc291cmNlOiBibG9jay5jb250ZW50LFxyXG4gICAgICB3b3JraW5nRGlyZWN0b3J5OiBjb250ZXh0LndvcmtpbmdEaXJlY3RvcnksXHJcbiAgICAgIHRpbWVvdXRNczogTWF0aC5tYXgoY29udGV4dC50aW1lb3V0TXMsIHNwZWMubWluaW11bVRpbWVvdXRNcyA/PyAwKSxcclxuICAgICAgc2lnbmFsOiBjb250ZXh0LnNpZ25hbCxcclxuICAgICAgZW52OiBzcGVjLmVudixcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRTcGVjKGxhbmd1YWdlOiBsb29tTm9ybWFsaXplZExhbmd1YWdlKTogSW50ZXJwcmV0ZWRTcGVjIHwgdW5kZWZpbmVkIHtcclxuICAgIHJldHVybiBJTlRFUlBSRVRFRF9TUEVDUy5maW5kKChzcGVjKSA9PiBzcGVjLmxhbmd1YWdlID09PSBsYW5ndWFnZSk7XHJcbiAgfVxyXG59XHJcbiIsICJpbXBvcnQgeyBydW5UZW1wRmlsZVByb2Nlc3MgfSBmcm9tIFwiLi4vZXhlY3V0aW9uL3Byb2Nlc3NSdW5uZXJcIjtcclxuaW1wb3J0IHR5cGUgeyBsb29tQ29kZUJsb2NrLCBsb29tUGx1Z2luU2V0dGluZ3MsIGxvb21SdW5Db250ZXh0LCBsb29tUnVuUmVzdWx0LCBsb29tUnVubmVyIH0gZnJvbSBcIi4uL3R5cGVzXCI7XHJcblxyXG5leHBvcnQgY2xhc3MgTGx2bVJ1bm5lciBpbXBsZW1lbnRzIGxvb21SdW5uZXIge1xyXG4gIGlkID0gXCJsbHZtLWlyXCI7XHJcbiAgZGlzcGxheU5hbWUgPSBcIkxMVk0gSVJcIjtcclxuICBsYW5ndWFnZXMgPSBbXCJsbHZtLWlyXCJdIGFzIGNvbnN0O1xyXG5cclxuICBjYW5SdW4oYmxvY2s6IGxvb21Db2RlQmxvY2ssIHNldHRpbmdzOiBsb29tUGx1Z2luU2V0dGluZ3MpOiBib29sZWFuIHtcclxuICAgIHJldHVybiBibG9jay5sYW5ndWFnZSA9PT0gXCJsbHZtLWlyXCIgJiYgQm9vbGVhbihzZXR0aW5ncy5sbHZtSW50ZXJwcmV0ZXJFeGVjdXRhYmxlLnRyaW0oKSk7XHJcbiAgfVxyXG5cclxuICBhc3luYyBydW4oYmxvY2s6IGxvb21Db2RlQmxvY2ssIGNvbnRleHQ6IGxvb21SdW5Db250ZXh0LCBzZXR0aW5nczogbG9vbVBsdWdpblNldHRpbmdzKTogUHJvbWlzZTxsb29tUnVuUmVzdWx0PiB7XHJcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBydW5UZW1wRmlsZVByb2Nlc3Moe1xyXG4gICAgICBydW5uZXJJZDogdGhpcy5pZCxcclxuICAgICAgcnVubmVyTmFtZTogdGhpcy5kaXNwbGF5TmFtZSxcclxuICAgICAgZXhlY3V0YWJsZTogc2V0dGluZ3MubGx2bUludGVycHJldGVyRXhlY3V0YWJsZS50cmltKCksXHJcbiAgICAgIGFyZ3M6IFtcIntmaWxlfVwiXSxcclxuICAgICAgZmlsZUV4dGVuc2lvbjogXCIubGxcIixcclxuICAgICAgc291cmNlOiBibG9jay5jb250ZW50LFxyXG4gICAgICB3b3JraW5nRGlyZWN0b3J5OiBjb250ZXh0LndvcmtpbmdEaXJlY3RvcnksXHJcbiAgICAgIHRpbWVvdXRNczogTWF0aC5tYXgoY29udGV4dC50aW1lb3V0TXMsIDMwXzAwMCksXHJcbiAgICAgIHNpZ25hbDogY29udGV4dC5zaWduYWwsXHJcbiAgICB9KTtcclxuXHJcbiAgICBpZiAoIXJlc3VsdC50aW1lZE91dCAmJiAhcmVzdWx0LmNhbmNlbGxlZCAmJiByZXN1bHQuZXhpdENvZGUgIT0gbnVsbCAmJiAhcmVzdWx0LnN0ZGVyci50cmltKCkpIHtcclxuICAgICAgaWYgKHJlc3VsdC5leGl0Q29kZSAhPT0gMCkge1xyXG4gICAgICAgIHJlc3VsdC5zdWNjZXNzID0gdHJ1ZTtcclxuICAgICAgICByZXN1bHQud2FybmluZyA9IGBQcm9ncmFtIHJldHVybmVkIGkzMiAke3Jlc3VsdC5leGl0Q29kZX0uIFVuZGVyIGxsaSwgdGhhdCBiZWNvbWVzIHRoZSBwcm9jZXNzIGV4aXQgc3RhdHVzLmA7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmICghcmVzdWx0LnN0ZG91dC50cmltKCkpIHtcclxuICAgICAgICByZXN1bHQuc3Rkb3V0ID0gcmVzdWx0LmV4aXRDb2RlID09PSAwXHJcbiAgICAgICAgICA/IFwiTExWTSBwcm9ncmFtIGV4aXRlZCB3aXRoIGNvZGUgMC5cIlxyXG4gICAgICAgICAgOiBgTExWTSBwcm9ncmFtIHJldHVybmVkIGkzMiAke3Jlc3VsdC5leGl0Q29kZX0uXFxuVXNlIHN0ZG91dCBpbiB0aGUgSVIgaXRzZWxmIGlmIHlvdSB3YW50IHByaW50YWJsZSBwcm9ncmFtIG91dHB1dC5gO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxuICB9XHJcbn1cclxuIiwgImltcG9ydCB7IGpvaW4gfSBmcm9tIFwicGF0aFwiO1xyXG5pbXBvcnQgeyBydW5Qcm9jZXNzLCB3aXRoTmFtZWRUZW1wU291cmNlRmlsZSwgd2l0aFRlbXBTb3VyY2VGaWxlIH0gZnJvbSBcIi4uL2V4ZWN1dGlvbi9wcm9jZXNzUnVubmVyXCI7XHJcbmltcG9ydCB0eXBlIHsgbG9vbUNvZGVCbG9jaywgbG9vbVBsdWdpblNldHRpbmdzLCBsb29tUnVuQ29udGV4dCwgbG9vbVJ1blJlc3VsdCwgbG9vbVJ1bm5lciB9IGZyb20gXCIuLi90eXBlc1wiO1xyXG5cclxuZXhwb3J0IGNsYXNzIE1hbmFnZWRDb21waWxlZFJ1bm5lciBpbXBsZW1lbnRzIGxvb21SdW5uZXIge1xyXG4gIGlkID0gXCJtYW5hZ2VkLWNvbXBpbGVkXCI7XHJcbiAgZGlzcGxheU5hbWUgPSBcIk1hbmFnZWQgY29tcGlsZXJcIjtcclxuICBsYW5ndWFnZXMgPSBbXCJydXN0XCIsIFwiamF2YVwiXSBhcyBjb25zdDtcclxuXHJcbiAgY2FuUnVuKGJsb2NrOiBsb29tQ29kZUJsb2NrLCBzZXR0aW5nczogbG9vbVBsdWdpblNldHRpbmdzKTogYm9vbGVhbiB7XHJcbiAgICBpZiAoYmxvY2subGFuZ3VhZ2UgPT09IFwicnVzdFwiKSB7XHJcbiAgICAgIHJldHVybiBCb29sZWFuKHNldHRpbmdzLnJ1c3RFeGVjdXRhYmxlLnRyaW0oKSk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGJsb2NrLmxhbmd1YWdlID09PSBcImphdmFcIikge1xyXG4gICAgICByZXR1cm4gQm9vbGVhbihzZXR0aW5ncy5qYXZhRXhlY3V0YWJsZS50cmltKCkpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBmYWxzZTtcclxuICB9XHJcblxyXG4gIGFzeW5jIHJ1bihibG9jazogbG9vbUNvZGVCbG9jaywgY29udGV4dDogbG9vbVJ1bkNvbnRleHQsIHNldHRpbmdzOiBsb29tUGx1Z2luU2V0dGluZ3MpOiBQcm9taXNlPGxvb21SdW5SZXN1bHQ+IHtcclxuICAgIGlmIChibG9jay5sYW5ndWFnZSA9PT0gXCJydXN0XCIpIHtcclxuICAgICAgcmV0dXJuIHRoaXMucnVuUnVzdChibG9jaywgY29udGV4dCwgc2V0dGluZ3MpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChibG9jay5sYW5ndWFnZSA9PT0gXCJqYXZhXCIpIHtcclxuICAgICAgcmV0dXJuIHRoaXMucnVuSmF2YShibG9jaywgY29udGV4dCwgc2V0dGluZ3MpO1xyXG4gICAgfVxyXG5cclxuICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgbGFuZ3VhZ2U6ICR7YmxvY2subGFuZ3VhZ2V9YCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFzeW5jIHJ1blJ1c3QoYmxvY2s6IGxvb21Db2RlQmxvY2ssIGNvbnRleHQ6IGxvb21SdW5Db250ZXh0LCBzZXR0aW5nczogbG9vbVBsdWdpblNldHRpbmdzKTogUHJvbWlzZTxsb29tUnVuUmVzdWx0PiB7XHJcbiAgICByZXR1cm4gd2l0aFRlbXBTb3VyY2VGaWxlKFwiLnJzXCIsIGJsb2NrLmNvbnRlbnQsIGFzeW5jICh7IHRlbXBEaXIsIHRlbXBGaWxlIH0pID0+IHtcclxuICAgICAgY29uc3QgYmluYXJ5UGF0aCA9IGpvaW4odGVtcERpciwgXCJzbmlwcGV0Lm91dFwiKTtcclxuICAgICAgY29uc3QgY29tcGlsZVJlc3VsdCA9IGF3YWl0IHJ1blByb2Nlc3Moe1xyXG4gICAgICAgIHJ1bm5lcklkOiBgJHt0aGlzLmlkfTpydXN0OmNvbXBpbGVgLFxyXG4gICAgICAgIHJ1bm5lck5hbWU6IFwiUnVzdFwiLFxyXG4gICAgICAgIGV4ZWN1dGFibGU6IHNldHRpbmdzLnJ1c3RFeGVjdXRhYmxlLnRyaW0oKSxcclxuICAgICAgICBhcmdzOiBbdGVtcEZpbGUsIFwiLW9cIiwgYmluYXJ5UGF0aF0sXHJcbiAgICAgICAgd29ya2luZ0RpcmVjdG9yeTogY29udGV4dC53b3JraW5nRGlyZWN0b3J5LFxyXG4gICAgICAgIHRpbWVvdXRNczogTWF0aC5tYXgoY29udGV4dC50aW1lb3V0TXMsIDMwXzAwMCksXHJcbiAgICAgICAgc2lnbmFsOiBjb250ZXh0LnNpZ25hbCxcclxuICAgICAgfSk7XHJcblxyXG4gICAgICBpZiAoIWNvbXBpbGVSZXN1bHQuc3VjY2Vzcykge1xyXG4gICAgICAgIHJldHVybiBjb21waWxlUmVzdWx0O1xyXG4gICAgICB9XHJcblxyXG4gICAgICByZXR1cm4gcnVuUHJvY2Vzcyh7XHJcbiAgICAgICAgcnVubmVySWQ6IGAke3RoaXMuaWR9OnJ1c3Q6cnVuYCxcclxuICAgICAgICBydW5uZXJOYW1lOiBcIlJ1c3RcIixcclxuICAgICAgICBleGVjdXRhYmxlOiBiaW5hcnlQYXRoLFxyXG4gICAgICAgIGFyZ3M6IFtdLFxyXG4gICAgICAgIHdvcmtpbmdEaXJlY3Rvcnk6IGNvbnRleHQud29ya2luZ0RpcmVjdG9yeSxcclxuICAgICAgICB0aW1lb3V0TXM6IE1hdGgubWF4KGNvbnRleHQudGltZW91dE1zLCAzMF8wMDApLFxyXG4gICAgICAgIHNpZ25hbDogY29udGV4dC5zaWduYWwsXHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFzeW5jIHJ1bkphdmEoYmxvY2s6IGxvb21Db2RlQmxvY2ssIGNvbnRleHQ6IGxvb21SdW5Db250ZXh0LCBzZXR0aW5nczogbG9vbVBsdWdpblNldHRpbmdzKTogUHJvbWlzZTxsb29tUnVuUmVzdWx0PiB7XHJcbiAgICByZXR1cm4gd2l0aE5hbWVkVGVtcFNvdXJjZUZpbGUoXCJNYWluLmphdmFcIiwgYmxvY2suY29udGVudCwgYXN5bmMgKHsgdGVtcERpciwgdGVtcEZpbGUgfSkgPT4ge1xyXG4gICAgICBpZiAoIXNldHRpbmdzLmphdmFDb21waWxlckV4ZWN1dGFibGUudHJpbSgpKSB7XHJcbiAgICAgICAgcmV0dXJuIHJ1blByb2Nlc3Moe1xyXG4gICAgICAgICAgcnVubmVySWQ6IGAke3RoaXMuaWR9OmphdmE6c291cmNlYCxcclxuICAgICAgICAgIHJ1bm5lck5hbWU6IFwiSmF2YVwiLFxyXG4gICAgICAgICAgZXhlY3V0YWJsZTogc2V0dGluZ3MuamF2YUV4ZWN1dGFibGUudHJpbSgpLFxyXG4gICAgICAgICAgYXJnczogW3RlbXBGaWxlXSxcclxuICAgICAgICAgIHdvcmtpbmdEaXJlY3Rvcnk6IGNvbnRleHQud29ya2luZ0RpcmVjdG9yeSxcclxuICAgICAgICAgIHRpbWVvdXRNczogTWF0aC5tYXgoY29udGV4dC50aW1lb3V0TXMsIDMwXzAwMCksXHJcbiAgICAgICAgICBzaWduYWw6IGNvbnRleHQuc2lnbmFsLFxyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCBjb21waWxlUmVzdWx0ID0gYXdhaXQgcnVuUHJvY2Vzcyh7XHJcbiAgICAgICAgcnVubmVySWQ6IGAke3RoaXMuaWR9OmphdmE6Y29tcGlsZWAsXHJcbiAgICAgICAgcnVubmVyTmFtZTogXCJKYXZhXCIsXHJcbiAgICAgICAgZXhlY3V0YWJsZTogc2V0dGluZ3MuamF2YUNvbXBpbGVyRXhlY3V0YWJsZS50cmltKCksXHJcbiAgICAgICAgYXJnczogW3RlbXBGaWxlXSxcclxuICAgICAgICB3b3JraW5nRGlyZWN0b3J5OiB0ZW1wRGlyLFxyXG4gICAgICAgIHRpbWVvdXRNczogTWF0aC5tYXgoY29udGV4dC50aW1lb3V0TXMsIDMwXzAwMCksXHJcbiAgICAgICAgc2lnbmFsOiBjb250ZXh0LnNpZ25hbCxcclxuICAgICAgfSk7XHJcblxyXG4gICAgICBpZiAoIWNvbXBpbGVSZXN1bHQuc3VjY2Vzcykge1xyXG4gICAgICAgIHJldHVybiBjb21waWxlUmVzdWx0O1xyXG4gICAgICB9XHJcblxyXG4gICAgICByZXR1cm4gcnVuUHJvY2Vzcyh7XHJcbiAgICAgICAgcnVubmVySWQ6IGAke3RoaXMuaWR9OmphdmE6cnVuYCxcclxuICAgICAgICBydW5uZXJOYW1lOiBcIkphdmFcIixcclxuICAgICAgICBleGVjdXRhYmxlOiBzZXR0aW5ncy5qYXZhRXhlY3V0YWJsZS50cmltKCksXHJcbiAgICAgICAgYXJnczogW1wiLWNwXCIsIHRlbXBEaXIsIFwiTWFpblwiXSxcclxuICAgICAgICB3b3JraW5nRGlyZWN0b3J5OiBjb250ZXh0LndvcmtpbmdEaXJlY3RvcnksXHJcbiAgICAgICAgdGltZW91dE1zOiBNYXRoLm1heChjb250ZXh0LnRpbWVvdXRNcywgMzBfMDAwKSxcclxuICAgICAgICBzaWduYWw6IGNvbnRleHQuc2lnbmFsLFxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG4iLCAiaW1wb3J0IHsgam9pbiB9IGZyb20gXCJwYXRoXCI7XHJcbmltcG9ydCB7IHJ1blByb2Nlc3MsIHdpdGhUZW1wU291cmNlRmlsZSB9IGZyb20gXCIuLi9leGVjdXRpb24vcHJvY2Vzc1J1bm5lclwiO1xyXG5pbXBvcnQgdHlwZSB7IGxvb21Db2RlQmxvY2ssIGxvb21QbHVnaW5TZXR0aW5ncywgbG9vbVJ1bkNvbnRleHQsIGxvb21SdW5SZXN1bHQsIGxvb21SdW5uZXIgfSBmcm9tIFwiLi4vdHlwZXNcIjtcclxuXHJcbmV4cG9ydCBjbGFzcyBOYXRpdmVDb21waWxlZFJ1bm5lciBpbXBsZW1lbnRzIGxvb21SdW5uZXIge1xyXG4gIGlkID0gXCJuYXRpdmUtY29tcGlsZWRcIjtcclxuICBkaXNwbGF5TmFtZSA9IFwiTmF0aXZlIGNvbXBpbGVyXCI7XHJcbiAgbGFuZ3VhZ2VzID0gW1wiY1wiLCBcImNwcFwiXSBhcyBjb25zdDtcclxuXHJcbiAgY2FuUnVuKGJsb2NrOiBsb29tQ29kZUJsb2NrLCBzZXR0aW5nczogbG9vbVBsdWdpblNldHRpbmdzKTogYm9vbGVhbiB7XHJcbiAgICBpZiAoYmxvY2subGFuZ3VhZ2UgPT09IFwiY1wiKSB7XHJcbiAgICAgIHJldHVybiBCb29sZWFuKHNldHRpbmdzLmNFeGVjdXRhYmxlLnRyaW0oKSk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGJsb2NrLmxhbmd1YWdlID09PSBcImNwcFwiKSB7XHJcbiAgICAgIHJldHVybiBCb29sZWFuKHNldHRpbmdzLmNwcEV4ZWN1dGFibGUudHJpbSgpKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gZmFsc2U7XHJcbiAgfVxyXG5cclxuICBhc3luYyBydW4oYmxvY2s6IGxvb21Db2RlQmxvY2ssIGNvbnRleHQ6IGxvb21SdW5Db250ZXh0LCBzZXR0aW5nczogbG9vbVBsdWdpblNldHRpbmdzKTogUHJvbWlzZTxsb29tUnVuUmVzdWx0PiB7XHJcbiAgICBjb25zdCBleGVjdXRhYmxlID0gYmxvY2subGFuZ3VhZ2UgPT09IFwiY1wiID8gc2V0dGluZ3MuY0V4ZWN1dGFibGUudHJpbSgpIDogc2V0dGluZ3MuY3BwRXhlY3V0YWJsZS50cmltKCk7XHJcbiAgICBjb25zdCBmaWxlRXh0ZW5zaW9uID0gYmxvY2subGFuZ3VhZ2UgPT09IFwiY1wiID8gXCIuY1wiIDogXCIuY3BwXCI7XHJcbiAgICBjb25zdCBydW5uZXJOYW1lID0gYmxvY2subGFuZ3VhZ2UgPT09IFwiY1wiID8gXCJDIChHQ0MpXCIgOiBcIkMrKyAoRysrKVwiO1xyXG5cclxuICAgIHJldHVybiB3aXRoVGVtcFNvdXJjZUZpbGUoZmlsZUV4dGVuc2lvbiwgYmxvY2suY29udGVudCwgYXN5bmMgKHsgdGVtcERpciwgdGVtcEZpbGUgfSkgPT4ge1xyXG4gICAgICBjb25zdCBiaW5hcnlQYXRoID0gam9pbih0ZW1wRGlyLCBcInNuaXBwZXQub3V0XCIpO1xyXG4gICAgICBjb25zdCBjb21waWxlUmVzdWx0ID0gYXdhaXQgcnVuUHJvY2Vzcyh7XHJcbiAgICAgICAgcnVubmVySWQ6IGAke3RoaXMuaWR9OiR7YmxvY2subGFuZ3VhZ2V9OmNvbXBpbGVgLFxyXG4gICAgICAgIHJ1bm5lck5hbWUsXHJcbiAgICAgICAgZXhlY3V0YWJsZSxcclxuICAgICAgICBhcmdzOiBbdGVtcEZpbGUsIFwiLW9cIiwgYmluYXJ5UGF0aF0sXHJcbiAgICAgICAgd29ya2luZ0RpcmVjdG9yeTogY29udGV4dC53b3JraW5nRGlyZWN0b3J5LFxyXG4gICAgICAgIHRpbWVvdXRNczogTWF0aC5tYXgoY29udGV4dC50aW1lb3V0TXMsIDMwXzAwMCksXHJcbiAgICAgICAgc2lnbmFsOiBjb250ZXh0LnNpZ25hbCxcclxuICAgICAgfSk7XHJcblxyXG4gICAgICBpZiAoIWNvbXBpbGVSZXN1bHQuc3VjY2Vzcykge1xyXG4gICAgICAgIHJldHVybiBjb21waWxlUmVzdWx0O1xyXG4gICAgICB9XHJcblxyXG4gICAgICByZXR1cm4gcnVuUHJvY2Vzcyh7XHJcbiAgICAgICAgcnVubmVySWQ6IGAke3RoaXMuaWR9OiR7YmxvY2subGFuZ3VhZ2V9OnJ1bmAsXHJcbiAgICAgICAgcnVubmVyTmFtZSxcclxuICAgICAgICBleGVjdXRhYmxlOiBiaW5hcnlQYXRoLFxyXG4gICAgICAgIGFyZ3M6IFtdLFxyXG4gICAgICAgIHdvcmtpbmdEaXJlY3Rvcnk6IGNvbnRleHQud29ya2luZ0RpcmVjdG9yeSxcclxuICAgICAgICB0aW1lb3V0TXM6IE1hdGgubWF4KGNvbnRleHQudGltZW91dE1zLCAzMF8wMDApLFxyXG4gICAgICAgIHNpZ25hbDogY29udGV4dC5zaWduYWwsXHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcbiIsICJpbXBvcnQgeyBqb2luIH0gZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IHsgcnVuUHJvY2VzcywgcnVuVGVtcEZpbGVQcm9jZXNzLCB3aXRoVGVtcFNvdXJjZUZpbGUgfSBmcm9tIFwiLi4vZXhlY3V0aW9uL3Byb2Nlc3NSdW5uZXJcIjtcclxuaW1wb3J0IHR5cGUgeyBsb29tQ29kZUJsb2NrLCBsb29tUGx1Z2luU2V0dGluZ3MsIGxvb21SdW5Db250ZXh0LCBsb29tUnVuUmVzdWx0LCBsb29tUnVubmVyIH0gZnJvbSBcIi4uL3R5cGVzXCI7XHJcblxyXG5leHBvcnQgY2xhc3MgT2NhbWxSdW5uZXIgaW1wbGVtZW50cyBsb29tUnVubmVyIHtcclxuICBpZCA9IFwib2NhbWxcIjtcclxuICBkaXNwbGF5TmFtZSA9IFwiT0NhbWxcIjtcclxuICBsYW5ndWFnZXMgPSBbXCJvY2FtbFwiXSBhcyBjb25zdDtcclxuXHJcbiAgY2FuUnVuKGJsb2NrOiBsb29tQ29kZUJsb2NrLCBzZXR0aW5nczogbG9vbVBsdWdpblNldHRpbmdzKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gYmxvY2subGFuZ3VhZ2UgPT09IFwib2NhbWxcIiAmJiBCb29sZWFuKHNldHRpbmdzLm9jYW1sRXhlY3V0YWJsZS50cmltKCkpO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgcnVuKGJsb2NrOiBsb29tQ29kZUJsb2NrLCBjb250ZXh0OiBsb29tUnVuQ29udGV4dCwgc2V0dGluZ3M6IGxvb21QbHVnaW5TZXR0aW5ncyk6IFByb21pc2U8bG9vbVJ1blJlc3VsdD4ge1xyXG4gICAgY29uc3QgbW9kZSA9IHNldHRpbmdzLm9jYW1sTW9kZTtcclxuICAgIGNvbnN0IGV4ZWN1dGFibGUgPSBzZXR0aW5ncy5vY2FtbEV4ZWN1dGFibGUudHJpbSgpO1xyXG5cclxuICAgIGlmIChtb2RlID09PSBcIm9jYW1sXCIpIHtcclxuICAgICAgcmV0dXJuIHJ1blRlbXBGaWxlUHJvY2Vzcyh7XHJcbiAgICAgICAgcnVubmVySWQ6IGAke3RoaXMuaWR9Om9jYW1sYCxcclxuICAgICAgICBydW5uZXJOYW1lOiBcIk9DYW1sXCIsXHJcbiAgICAgICAgZXhlY3V0YWJsZSxcclxuICAgICAgICBhcmdzOiBbXCJ7ZmlsZX1cIl0sXHJcbiAgICAgICAgZmlsZUV4dGVuc2lvbjogXCIubWxcIixcclxuICAgICAgICBzb3VyY2U6IGJsb2NrLmNvbnRlbnQsXHJcbiAgICAgICAgd29ya2luZ0RpcmVjdG9yeTogY29udGV4dC53b3JraW5nRGlyZWN0b3J5LFxyXG4gICAgICAgIHRpbWVvdXRNczogY29udGV4dC50aW1lb3V0TXMsXHJcbiAgICAgICAgc2lnbmFsOiBjb250ZXh0LnNpZ25hbCxcclxuICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKG1vZGUgPT09IFwiZHVuZVwiKSB7XHJcbiAgICAgIHJldHVybiBydW5UZW1wRmlsZVByb2Nlc3Moe1xyXG4gICAgICAgIHJ1bm5lcklkOiBgJHt0aGlzLmlkfTpkdW5lYCxcclxuICAgICAgICBydW5uZXJOYW1lOiBcIkR1bmUgLyBPQ2FtbFwiLFxyXG4gICAgICAgIGV4ZWN1dGFibGUsXHJcbiAgICAgICAgYXJnczogW1wiZXhlY1wiLCBcIi0tXCIsIFwib2NhbWxcIiwgXCJ7ZmlsZX1cIl0sXHJcbiAgICAgICAgZmlsZUV4dGVuc2lvbjogXCIubWxcIixcclxuICAgICAgICBzb3VyY2U6IGJsb2NrLmNvbnRlbnQsXHJcbiAgICAgICAgd29ya2luZ0RpcmVjdG9yeTogY29udGV4dC53b3JraW5nRGlyZWN0b3J5LFxyXG4gICAgICAgIHRpbWVvdXRNczogY29udGV4dC50aW1lb3V0TXMsXHJcbiAgICAgICAgc2lnbmFsOiBjb250ZXh0LnNpZ25hbCxcclxuICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHdpdGhUZW1wU291cmNlRmlsZShcIi5tbFwiLCBibG9jay5jb250ZW50LCBhc3luYyAoeyB0ZW1wRGlyLCB0ZW1wRmlsZSB9KSA9PiB7XHJcbiAgICAgIGNvbnN0IGJpbmFyeVBhdGggPSBqb2luKHRlbXBEaXIsIFwic25pcHBldC5vdXRcIik7XHJcbiAgICAgIGNvbnN0IGNvbXBpbGVSZXN1bHQgPSBhd2FpdCBydW5Qcm9jZXNzKHtcclxuICAgICAgICBydW5uZXJJZDogYCR7dGhpcy5pZH06b2NhbWxjLWNvbXBpbGVgLFxyXG4gICAgICAgIHJ1bm5lck5hbWU6IFwiT0NhbWxjXCIsXHJcbiAgICAgICAgZXhlY3V0YWJsZSxcclxuICAgICAgICBhcmdzOiBbXCItb1wiLCBiaW5hcnlQYXRoLCB0ZW1wRmlsZV0sXHJcbiAgICAgICAgd29ya2luZ0RpcmVjdG9yeTogY29udGV4dC53b3JraW5nRGlyZWN0b3J5LFxyXG4gICAgICAgIHRpbWVvdXRNczogY29udGV4dC50aW1lb3V0TXMsXHJcbiAgICAgICAgc2lnbmFsOiBjb250ZXh0LnNpZ25hbCxcclxuICAgICAgfSk7XHJcblxyXG4gICAgICBpZiAoIWNvbXBpbGVSZXN1bHQuc3VjY2Vzcykge1xyXG4gICAgICAgIHJldHVybiBjb21waWxlUmVzdWx0O1xyXG4gICAgICB9XHJcblxyXG4gICAgICByZXR1cm4gcnVuUHJvY2Vzcyh7XHJcbiAgICAgICAgcnVubmVySWQ6IGAke3RoaXMuaWR9Om9jYW1sYy1ydW5gLFxyXG4gICAgICAgIHJ1bm5lck5hbWU6IFwiT0NhbWxjXCIsXHJcbiAgICAgICAgZXhlY3V0YWJsZTogYmluYXJ5UGF0aCxcclxuICAgICAgICBhcmdzOiBbXSxcclxuICAgICAgICB3b3JraW5nRGlyZWN0b3J5OiBjb250ZXh0LndvcmtpbmdEaXJlY3RvcnksXHJcbiAgICAgICAgdGltZW91dE1zOiBjb250ZXh0LnRpbWVvdXRNcyxcclxuICAgICAgICBzaWduYWw6IGNvbnRleHQuc2lnbmFsLFxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG4iLCAiaW1wb3J0IHsgcnVuVGVtcEZpbGVQcm9jZXNzIH0gZnJvbSBcIi4uL2V4ZWN1dGlvbi9wcm9jZXNzUnVubmVyXCI7XHJcbmltcG9ydCB0eXBlIHsgbG9vbUNvZGVCbG9jaywgbG9vbVBsdWdpblNldHRpbmdzLCBsb29tUnVuQ29udGV4dCwgbG9vbVJ1blJlc3VsdCwgbG9vbVJ1bm5lciB9IGZyb20gXCIuLi90eXBlc1wiO1xyXG5cclxuZXhwb3J0IGNsYXNzIFB5dGhvblJ1bm5lciBpbXBsZW1lbnRzIGxvb21SdW5uZXIge1xyXG4gIGlkID0gXCJweXRob25cIjtcclxuICBkaXNwbGF5TmFtZSA9IFwiUHl0aG9uXCI7XHJcbiAgbGFuZ3VhZ2VzID0gW1wicHl0aG9uXCJdIGFzIGNvbnN0O1xyXG5cclxuICBjYW5SdW4oYmxvY2s6IGxvb21Db2RlQmxvY2ssIHNldHRpbmdzOiBsb29tUGx1Z2luU2V0dGluZ3MpOiBib29sZWFuIHtcclxuICAgIHJldHVybiBibG9jay5sYW5ndWFnZSA9PT0gXCJweXRob25cIiAmJiBCb29sZWFuKHNldHRpbmdzLnB5dGhvbkV4ZWN1dGFibGUudHJpbSgpKTtcclxuICB9XHJcblxyXG4gIHJ1bihibG9jazogbG9vbUNvZGVCbG9jaywgY29udGV4dDogbG9vbVJ1bkNvbnRleHQsIHNldHRpbmdzOiBsb29tUGx1Z2luU2V0dGluZ3MpOiBQcm9taXNlPGxvb21SdW5SZXN1bHQ+IHtcclxuICAgIHJldHVybiBydW5UZW1wRmlsZVByb2Nlc3Moe1xyXG4gICAgICBydW5uZXJJZDogdGhpcy5pZCxcclxuICAgICAgcnVubmVyTmFtZTogdGhpcy5kaXNwbGF5TmFtZSxcclxuICAgICAgZXhlY3V0YWJsZTogc2V0dGluZ3MucHl0aG9uRXhlY3V0YWJsZS50cmltKCksXHJcbiAgICAgIGFyZ3M6IFtcIntmaWxlfVwiXSxcclxuICAgICAgZmlsZUV4dGVuc2lvbjogXCIucHlcIixcclxuICAgICAgc291cmNlOiBibG9jay5jb250ZW50LFxyXG4gICAgICB3b3JraW5nRGlyZWN0b3J5OiBjb250ZXh0LndvcmtpbmdEaXJlY3RvcnksXHJcbiAgICAgIHRpbWVvdXRNczogY29udGV4dC50aW1lb3V0TXMsXHJcbiAgICAgIHNpZ25hbDogY29udGV4dC5zaWduYWwsXHJcbiAgICB9KTtcclxuICB9XHJcbn1cclxuIiwgImltcG9ydCB7IGV4aXN0c1N5bmMgfSBmcm9tIFwiZnNcIjtcclxuaW1wb3J0IHsgam9pbiB9IGZyb20gXCJwYXRoXCI7XHJcbmltcG9ydCB7IHJ1blRlbXBGaWxlUHJvY2VzcyB9IGZyb20gXCIuLi9leGVjdXRpb24vcHJvY2Vzc1J1bm5lclwiO1xyXG5pbXBvcnQgdHlwZSB7IGxvb21Db2RlQmxvY2ssIGxvb21QbHVnaW5TZXR0aW5ncywgbG9vbVJ1bkNvbnRleHQsIGxvb21SdW5SZXN1bHQsIGxvb21SdW5uZXIgfSBmcm9tIFwiLi4vdHlwZXNcIjtcclxuXHJcbmV4cG9ydCBjbGFzcyBQcm9vZlJ1bm5lciBpbXBsZW1lbnRzIGxvb21SdW5uZXIge1xyXG4gIGlkID0gXCJwcm9vZlwiO1xyXG4gIGRpc3BsYXlOYW1lID0gXCJQcm9vZiBjaGVja2VyXCI7XHJcbiAgbGFuZ3VhZ2VzID0gW1wibGVhblwiLCBcImNvcVwiLCBcInNtdGxpYlwiXSBhcyBjb25zdDtcclxuXHJcbiAgY2FuUnVuKGJsb2NrOiBsb29tQ29kZUJsb2NrLCBzZXR0aW5nczogbG9vbVBsdWdpblNldHRpbmdzKTogYm9vbGVhbiB7XHJcbiAgICBpZiAoYmxvY2subGFuZ3VhZ2UgPT09IFwibGVhblwiKSB7XHJcbiAgICAgIHJldHVybiBCb29sZWFuKHNldHRpbmdzLmxlYW5FeGVjdXRhYmxlLnRyaW0oKSk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGJsb2NrLmxhbmd1YWdlID09PSBcImNvcVwiKSB7XHJcbiAgICAgIHJldHVybiBCb29sZWFuKHJlc29sdmVDb3FFeGVjdXRhYmxlKHNldHRpbmdzKS50cmltKCkpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChibG9jay5sYW5ndWFnZSA9PT0gXCJzbXRsaWJcIikge1xyXG4gICAgICByZXR1cm4gQm9vbGVhbihzZXR0aW5ncy5zbXRFeGVjdXRhYmxlLnRyaW0oKSk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG4gIH1cclxuXHJcbiAgcnVuKGJsb2NrOiBsb29tQ29kZUJsb2NrLCBjb250ZXh0OiBsb29tUnVuQ29udGV4dCwgc2V0dGluZ3M6IGxvb21QbHVnaW5TZXR0aW5ncyk6IFByb21pc2U8bG9vbVJ1blJlc3VsdD4ge1xyXG4gICAgaWYgKGJsb2NrLmxhbmd1YWdlID09PSBcImxlYW5cIikge1xyXG4gICAgICByZXR1cm4gcnVuVGVtcEZpbGVQcm9jZXNzKHtcclxuICAgICAgICBydW5uZXJJZDogYCR7dGhpcy5pZH06bGVhbmAsXHJcbiAgICAgICAgcnVubmVyTmFtZTogXCJMZWFuXCIsXHJcbiAgICAgICAgZXhlY3V0YWJsZTogc2V0dGluZ3MubGVhbkV4ZWN1dGFibGUudHJpbSgpLFxyXG4gICAgICAgIGFyZ3M6IFtcIntmaWxlfVwiXSxcclxuICAgICAgICBmaWxlRXh0ZW5zaW9uOiBcIi5sZWFuXCIsXHJcbiAgICAgICAgc291cmNlOiBibG9jay5jb250ZW50LFxyXG4gICAgICAgIHdvcmtpbmdEaXJlY3Rvcnk6IGNvbnRleHQud29ya2luZ0RpcmVjdG9yeSxcclxuICAgICAgICB0aW1lb3V0TXM6IE1hdGgubWF4KGNvbnRleHQudGltZW91dE1zLCAzMF8wMDApLFxyXG4gICAgICAgIHNpZ25hbDogY29udGV4dC5zaWduYWwsXHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChibG9jay5sYW5ndWFnZSA9PT0gXCJjb3FcIikge1xyXG4gICAgICByZXR1cm4gcnVuVGVtcEZpbGVQcm9jZXNzKHtcclxuICAgICAgICBydW5uZXJJZDogYCR7dGhpcy5pZH06Y29xYCxcclxuICAgICAgICBydW5uZXJOYW1lOiBcIkNvcVwiLFxyXG4gICAgICAgIGV4ZWN1dGFibGU6IHJlc29sdmVDb3FFeGVjdXRhYmxlKHNldHRpbmdzKSxcclxuICAgICAgICBhcmdzOiBbXCItcVwiLCBcIntmaWxlfVwiXSxcclxuICAgICAgICBmaWxlRXh0ZW5zaW9uOiBcIi52XCIsXHJcbiAgICAgICAgc291cmNlOiBibG9jay5jb250ZW50LFxyXG4gICAgICAgIHdvcmtpbmdEaXJlY3Rvcnk6IGNvbnRleHQud29ya2luZ0RpcmVjdG9yeSxcclxuICAgICAgICB0aW1lb3V0TXM6IE1hdGgubWF4KGNvbnRleHQudGltZW91dE1zLCAzMF8wMDApLFxyXG4gICAgICAgIHNpZ25hbDogY29udGV4dC5zaWduYWwsXHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChibG9jay5sYW5ndWFnZSA9PT0gXCJzbXRsaWJcIikge1xyXG4gICAgICByZXR1cm4gcnVuVGVtcEZpbGVQcm9jZXNzKHtcclxuICAgICAgICBydW5uZXJJZDogYCR7dGhpcy5pZH06c210bGliYCxcclxuICAgICAgICBydW5uZXJOYW1lOiBcIlNNVC1MSUIgKFozKVwiLFxyXG4gICAgICAgIGV4ZWN1dGFibGU6IHNldHRpbmdzLnNtdEV4ZWN1dGFibGUudHJpbSgpLFxyXG4gICAgICAgIGFyZ3M6IFtcIntmaWxlfVwiXSxcclxuICAgICAgICBmaWxlRXh0ZW5zaW9uOiBcIi5zbXQyXCIsXHJcbiAgICAgICAgc291cmNlOiBibG9jay5jb250ZW50LFxyXG4gICAgICAgIHdvcmtpbmdEaXJlY3Rvcnk6IGNvbnRleHQud29ya2luZ0RpcmVjdG9yeSxcclxuICAgICAgICB0aW1lb3V0TXM6IE1hdGgubWF4KGNvbnRleHQudGltZW91dE1zLCAzMF8wMDApLFxyXG4gICAgICAgIHNpZ25hbDogY29udGV4dC5zaWduYWwsXHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgcHJvb2YgbGFuZ3VhZ2U6ICR7YmxvY2subGFuZ3VhZ2V9YCk7XHJcbiAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiByZXNvbHZlQ29xRXhlY3V0YWJsZShzZXR0aW5nczogbG9vbVBsdWdpblNldHRpbmdzKTogc3RyaW5nIHtcclxuICBjb25zdCBjb25maWd1cmVkID0gc2V0dGluZ3MuY29xRXhlY3V0YWJsZS50cmltKCk7XHJcbiAgaWYgKGNvbmZpZ3VyZWQgJiYgY29uZmlndXJlZCAhPT0gXCJjb3FjXCIpIHtcclxuICAgIHJldHVybiBjb25maWd1cmVkO1xyXG4gIH1cclxuXHJcbiAgY29uc3Qgb3BhbUNvcWMgPSBqb2luKHByb2Nlc3MuZW52LkhPTUUgPz8gXCJcIiwgXCIub3BhbVwiLCBcImRlZmF1bHRcIiwgXCJiaW5cIiwgXCJjb3FjXCIpO1xyXG4gIHJldHVybiBleGlzdHNTeW5jKG9wYW1Db3FjKSA/IG9wYW1Db3FjIDogY29uZmlndXJlZCB8fCBcImNvcWNcIjtcclxufVxyXG4iLCAiaW1wb3J0IHR5cGUgeyBsb29tQ29kZUJsb2NrLCBsb29tUGx1Z2luU2V0dGluZ3MsIGxvb21SdW5uZXIgfSBmcm9tIFwiLi4vdHlwZXNcIjtcclxuXHJcbmV4cG9ydCBjbGFzcyBsb29tUnVubmVyUmVnaXN0cnkge1xyXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgcnVubmVyczogbG9vbVJ1bm5lcltdKSB7fVxyXG5cclxuICBnZXRSdW5uZXJGb3JCbG9jayhibG9jazogbG9vbUNvZGVCbG9jaywgc2V0dGluZ3M6IGxvb21QbHVnaW5TZXR0aW5ncyk6IGxvb21SdW5uZXIgfCBudWxsIHtcclxuICAgIHJldHVybiB0aGlzLnJ1bm5lcnMuZmluZCgocnVubmVyKSA9PiAoIXJ1bm5lci5sYW5ndWFnZXMubGVuZ3RoIHx8IHJ1bm5lci5sYW5ndWFnZXMuaW5jbHVkZXMoYmxvY2subGFuZ3VhZ2UpKSAmJiBydW5uZXIuY2FuUnVuKGJsb2NrLCBzZXR0aW5ncykpID8/IG51bGw7XHJcbiAgfVxyXG5cclxuICBnZXRTdXBwb3J0ZWRMYW5ndWFnZXMoKTogc3RyaW5nW10ge1xyXG4gICAgcmV0dXJuIFsuLi5uZXcgU2V0KHRoaXMucnVubmVycy5mbGF0TWFwKChydW5uZXIpID0+IHJ1bm5lci5sYW5ndWFnZXMpKV07XHJcbiAgfVxyXG59XHJcbiIsICJpbXBvcnQgeyBOb3RpY2UsIFBsdWdpblNldHRpbmdUYWIsIFNldHRpbmcsIG5vcm1hbGl6ZVBhdGggfSBmcm9tIFwib2JzaWRpYW5cIjtcclxuaW1wb3J0IHR5cGUgbG9vbVBsdWdpbiBmcm9tIFwiLi9tYWluXCI7XHJcbmltcG9ydCB0eXBlIHsgbG9vbUN1c3RvbUxhbmd1YWdlLCBsb29tUGx1Z2luU2V0dGluZ3MgfSBmcm9tIFwiLi90eXBlc1wiO1xyXG5cclxuZXhwb3J0IGNvbnN0IERFRkFVTFRfU0VUVElOR1M6IGxvb21QbHVnaW5TZXR0aW5ncyA9IHtcclxuICBlbmFibGVMb2NhbEV4ZWN1dGlvbjogZmFsc2UsXHJcbiAgaGFzQWNrbm93bGVkZ2VkRXhlY3V0aW9uUmlzazogZmFsc2UsXHJcbiAgcHJlc2VydmVTb3VyY2VNb2RlOiB0cnVlLFxyXG4gIGRlZmF1bHRUaW1lb3V0TXM6IDgwMDAsXHJcbiAgd29ya2luZ0RpcmVjdG9yeTogXCJcIixcclxuICBweXRob25FeGVjdXRhYmxlOiBcInB5dGhvbjNcIixcclxuICBub2RlRXhlY3V0YWJsZTogXCJub2RlXCIsXHJcbiAgdHlwZXNjcmlwdE1vZGU6IFwidHMtbm9kZVwiLFxyXG4gIHR5cGVzY3JpcHRUcmFuc3BpbGVyRXhlY3V0YWJsZTogXCJ0cy1ub2RlXCIsXHJcbiAgb2NhbWxNb2RlOiBcIm9jYW1sXCIsXHJcbiAgb2NhbWxFeGVjdXRhYmxlOiBcIm9jYW1sXCIsXHJcbiAgY0V4ZWN1dGFibGU6IFwiZ2NjXCIsXHJcbiAgY3BwRXhlY3V0YWJsZTogXCJnKytcIixcclxuICBzaGVsbEV4ZWN1dGFibGU6IFwiYmFzaFwiLFxyXG4gIHJ1YnlFeGVjdXRhYmxlOiBcInJ1YnlcIixcclxuICBwZXJsRXhlY3V0YWJsZTogXCJwZXJsXCIsXHJcbiAgbHVhRXhlY3V0YWJsZTogXCJsdWFcIixcclxuICBwaHBFeGVjdXRhYmxlOiBcInBocFwiLFxyXG4gIGdvRXhlY3V0YWJsZTogXCJnb1wiLFxyXG4gIHJ1c3RFeGVjdXRhYmxlOiBcInJ1c3RjXCIsXHJcbiAgaGFza2VsbEV4ZWN1dGFibGU6IFwicnVuZ2hjXCIsXHJcbiAgamF2YUNvbXBpbGVyRXhlY3V0YWJsZTogXCJcIixcclxuICBqYXZhRXhlY3V0YWJsZTogXCJqYXZhXCIsXHJcbiAgbGx2bUludGVycHJldGVyRXhlY3V0YWJsZTogXCJsbGlcIixcclxuICBsZWFuRXhlY3V0YWJsZTogXCJsZWFuXCIsXHJcbiAgY29xRXhlY3V0YWJsZTogXCJjb3FjXCIsXHJcbiAgc210RXhlY3V0YWJsZTogXCJ6M1wiLFxyXG4gIHdyaXRlT3V0cHV0VG9Ob3RlOiBmYWxzZSxcclxuICBhdXRvUnVuT25GaWxlT3BlbjogZmFsc2UsXHJcbiAgY3VzdG9tTGFuZ3VhZ2VzOiBbXSxcclxuICBwZGZFeHBvcnRNb2RlOiBcImJvdGhcIixcclxuICBydW5PbldzbDogZmFsc2UsXHJcbn07XHJcblxyXG5leHBvcnQgY2xhc3MgbG9vbVNldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcclxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IGxvb21QbHVnaW46IGxvb21QbHVnaW4pIHtcclxuICAgIHN1cGVyKGxvb21QbHVnaW4uYXBwLCBsb29tUGx1Z2luKTtcclxuICB9XHJcblxyXG4gIGRpc3BsYXkoKTogdm9pZCB7XHJcbiAgICBjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xyXG4gICAgY29udGFpbmVyRWwuZW1wdHkoKTtcclxuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDJcIiwgeyB0ZXh0OiBcImxvb21cIiB9KTtcclxuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwicFwiLCB7IHRleHQ6IFwiUnVuIHN1cHBvcnRlZCBjb2RlIGZlbmNlcyBkaXJlY3RseSBmcm9tIG5vdGVzIHdoaWxlIHByZXNlcnZpbmcgbmF0aXZlIHN5bnRheCBoaWdobGlnaHRpbmcuXCIgfSk7XHJcblxyXG4gICAgdGhpcy5yZW5kZXJHZW5lcmFsU2V0dGluZ3ModGhpcy5jcmVhdGVTZWN0aW9uKGNvbnRhaW5lckVsLCBcIkdlbmVyYWwgU2V0dGluZ3NcIiwgdHJ1ZSkpO1xyXG4gICAgdGhpcy5yZW5kZXJCdWlsdEluUnVudGltZXModGhpcy5jcmVhdGVTZWN0aW9uKGNvbnRhaW5lckVsLCBcIkJ1aWx0LWluIFJ1bnRpbWVzXCIpKTtcclxuICAgIHRoaXMucmVuZGVyQ3VzdG9tTGFuZ3VhZ2VzKHRoaXMuY3JlYXRlU2VjdGlvbihjb250YWluZXJFbCwgXCJDdXN0b20gTGFuZ3VhZ2VzXCIpKTtcclxuICAgIHZvaWQgdGhpcy5yZW5kZXJDb250YWluZXJHcm91cHModGhpcy5jcmVhdGVTZWN0aW9uKGNvbnRhaW5lckVsLCBcIkNvbnRhaW5lcml6YXRpb24gR3JvdXBzXCIpKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgY3JlYXRlU2VjdGlvbihjb250YWluZXJFbDogSFRNTEVsZW1lbnQsIHRpdGxlOiBzdHJpbmcsIG9wZW4gPSBmYWxzZSk6IEhUTUxFbGVtZW50IHtcclxuICAgIGNvbnN0IGRldGFpbHMgPSBjb250YWluZXJFbC5jcmVhdGVFbChcImRldGFpbHNcIiwgeyBjbHM6IFwibG9vbS1zZXR0aW5ncy1zZWN0aW9uXCIgfSk7XHJcbiAgICBkZXRhaWxzLm9wZW4gPSBvcGVuO1xyXG4gICAgZGV0YWlscy5jcmVhdGVFbChcInN1bW1hcnlcIiwgeyB0ZXh0OiB0aXRsZSwgY2xzOiBcImxvb20tc2V0dGluZ3Mtc3VtbWFyeVwiIH0pO1xyXG4gICAgcmV0dXJuIGRldGFpbHMuY3JlYXRlRGl2KHsgY2xzOiBcImxvb20tc2V0dGluZ3Mtc2VjdGlvbi1ib2R5XCIgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlbmRlckdlbmVyYWxTZXR0aW5ncyhjb250YWluZXJFbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIkVuYWJsZSBsb2NhbCBleGVjdXRpb25cIilcclxuICAgICAgLnNldERlc2MoXCJEaXNhYmxlZCBieSBkZWZhdWx0LiBsb29tIHJ1bnMgY29kZSBvbiB5b3VyIGxvY2FsIG1hY2hpbmUgYW5kIGRvZXMgbm90IHByb3ZpZGUgc2FuZGJveGluZy5cIilcclxuICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxyXG4gICAgICAgIHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLmxvb21QbHVnaW4uc2V0dGluZ3MuZW5hYmxlTG9jYWxFeGVjdXRpb24pLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgdGhpcy5sb29tUGx1Z2luLnNldHRpbmdzLmVuYWJsZUxvY2FsRXhlY3V0aW9uID0gdmFsdWU7XHJcbiAgICAgICAgICBpZiAodmFsdWUpIHtcclxuICAgICAgICAgICAgdGhpcy5sb29tUGx1Z2luLnNldHRpbmdzLmhhc0Fja25vd2xlZGdlZEV4ZWN1dGlvblJpc2sgPSB0cnVlO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgYXdhaXQgdGhpcy5sb29tUGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgIH0pLFxyXG4gICAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIktlZXAgbG9vbSBub3RlcyBpbiBzb3VyY2UgbW9kZVwiKVxyXG4gICAgICAuc2V0RGVzYyhcIlByZXNlcnZlIHJhdyBmZW5jZWQgY29kZSBpbiB0aGUgZWRpdG9yIGluc3RlYWQgb2YgbGV0dGluZyBsaXZlIHByZXZpZXcgY29sbGFwc2UgcmVzZWFyY2ggc25pcHBldHMuXCIpXHJcbiAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cclxuICAgICAgICB0b2dnbGUuc2V0VmFsdWUodGhpcy5sb29tUGx1Z2luLnNldHRpbmdzLnByZXNlcnZlU291cmNlTW9kZSkub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICB0aGlzLmxvb21QbHVnaW4uc2V0dGluZ3MucHJlc2VydmVTb3VyY2VNb2RlID0gdmFsdWU7XHJcbiAgICAgICAgICBhd2FpdCB0aGlzLmxvb21QbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICB2b2lkIHRoaXMubG9vbVBsdWdpbi5lbmZvcmNlU291cmNlTW9kZUZvckFjdGl2ZVZpZXcoKTtcclxuICAgICAgICB9KSxcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJEZWZhdWx0IHRpbWVvdXRcIilcclxuICAgICAgLnNldERlc2MoXCJNYXhpbXVtIGV4ZWN1dGlvbiB0aW1lIGluIG1pbGxpc2Vjb25kcyBiZWZvcmUgbG9vbSB0ZXJtaW5hdGVzIHRoZSBwcm9jZXNzLlwiKVxyXG4gICAgICAuYWRkVGV4dCgodGV4dCkgPT5cclxuICAgICAgICB0ZXh0LnNldFBsYWNlaG9sZGVyKFwiODAwMFwiKS5zZXRWYWx1ZShTdHJpbmcodGhpcy5sb29tUGx1Z2luLnNldHRpbmdzLmRlZmF1bHRUaW1lb3V0TXMpKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgIGNvbnN0IHBhcnNlZCA9IE51bWJlci5wYXJzZUludCh2YWx1ZSwgMTApO1xyXG4gICAgICAgICAgaWYgKCFOdW1iZXIuaXNOYU4ocGFyc2VkKSAmJiBwYXJzZWQgPiAwKSB7XHJcbiAgICAgICAgICAgIHRoaXMubG9vbVBsdWdpbi5zZXR0aW5ncy5kZWZhdWx0VGltZW91dE1zID0gcGFyc2VkO1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLmxvb21QbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSksXHJcbiAgICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiV29ya2luZyBkaXJlY3RvcnlcIilcclxuICAgICAgLnNldERlc2MoXCJPcHRpb25hbC4gRW1wdHkgdXNlcyB0aGUgY3VycmVudCBub3RlIGZvbGRlciB3aGVuIHBvc3NpYmxlLCBvdGhlcndpc2UgdGhlIHZhdWx0IHJvb3QuXCIpXHJcbiAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxyXG4gICAgICAgIHRleHQuc2V0UGxhY2Vob2xkZXIoXCJWYXVsdCByb290XCIpLnNldFZhbHVlKHRoaXMubG9vbVBsdWdpbi5zZXR0aW5ncy53b3JraW5nRGlyZWN0b3J5KS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgIHRoaXMubG9vbVBsdWdpbi5zZXR0aW5ncy53b3JraW5nRGlyZWN0b3J5ID0gdmFsdWUudHJpbSgpID8gbm9ybWFsaXplUGF0aCh2YWx1ZS50cmltKCkpIDogXCJcIjtcclxuICAgICAgICAgIGF3YWl0IHRoaXMubG9vbVBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICB9KSxcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJXcml0ZSBvdXRwdXQgYmFjayB0byBub3RlXCIpXHJcbiAgICAgIC5zZXREZXNjKFwiSW5zZXJ0IG1hbmFnZWQgbG9vbSBvdXRwdXQgc2VjdGlvbnMgYmVuZWF0aCBjb2RlIGJsb2NrcyBpbnN0ZWFkIG9mIGtlZXBpbmcgcmVzdWx0cyBwdXJlbHkgaW4gdGhlIFVJLlwiKVxyXG4gICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+XHJcbiAgICAgICAgdG9nZ2xlLnNldFZhbHVlKHRoaXMubG9vbVBsdWdpbi5zZXR0aW5ncy53cml0ZU91dHB1dFRvTm90ZSkub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICB0aGlzLmxvb21QbHVnaW4uc2V0dGluZ3Mud3JpdGVPdXRwdXRUb05vdGUgPSB2YWx1ZTtcclxuICAgICAgICAgIGF3YWl0IHRoaXMubG9vbVBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICB9KSxcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJBdXRvLXJ1biBvbiBmaWxlIG9wZW5cIilcclxuICAgICAgLnNldERlc2MoXCJSdW4gYWxsIHN1cHBvcnRlZCBibG9ja3MgaW4gdGhlIGFjdGl2ZSBub3RlIHdoZW4gaXQgb3BlbnMuIERpc2FibGVkIGJ5IGRlZmF1bHQuXCIpXHJcbiAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cclxuICAgICAgICB0b2dnbGUuc2V0VmFsdWUodGhpcy5sb29tUGx1Z2luLnNldHRpbmdzLmF1dG9SdW5PbkZpbGVPcGVuKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgIHRoaXMubG9vbVBsdWdpbi5zZXR0aW5ncy5hdXRvUnVuT25GaWxlT3BlbiA9IHZhbHVlO1xyXG4gICAgICAgICAgYXdhaXQgdGhpcy5sb29tUGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgIH0pLFxyXG4gICAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIlBERiBleHBvcnQgbW9kZVwiKVxyXG4gICAgICAuc2V0RGVzYyhcIkNob29zZSB3aGF0IHRvIGluY2x1ZGUgd2hlbiBleHBvcnRpbmcgbm90ZXMgY29udGFpbmluZyBsb29tIGNvZGUgYmxvY2tzIHRvIFBERi5cIilcclxuICAgICAgLmFkZERyb3Bkb3duKChkcm9wZG93bikgPT5cclxuICAgICAgICBkcm9wZG93blxyXG4gICAgICAgICAgLmFkZE9wdGlvbihcImJvdGhcIiwgXCJCb3RoIENvZGUgYW5kIE91dHB1dFwiKVxyXG4gICAgICAgICAgLmFkZE9wdGlvbihcImNvZGVcIiwgXCJDb2RlIEJsb2NrIE9ubHlcIilcclxuICAgICAgICAgIC5hZGRPcHRpb24oXCJvdXRwdXRcIiwgXCJPdXRwdXQgT25seVwiKVxyXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMubG9vbVBsdWdpbi5zZXR0aW5ncy5wZGZFeHBvcnRNb2RlIHx8IFwiYm90aFwiKVxyXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLmxvb21QbHVnaW4uc2V0dGluZ3MucGRmRXhwb3J0TW9kZSA9IHZhbHVlIGFzIFwiYm90aFwiIHwgXCJjb2RlXCIgfCBcIm91dHB1dFwiO1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLmxvb21QbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICB9KSxcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJSdW4gb24gV1NMXCIpXHJcbiAgICAgIC5zZXREZXNjKFwiT24gV2luZG93cywgZXhlY3V0ZSBsb2NhbCBjb21tYW5kcyBpbnNpZGUgV1NMIChXaW5kb3dzIFN1YnN5c3RlbSBmb3IgTGludXgpIGluc3RlYWQgb2YgbmF0aXZlbHkgb24gV2luZG93cy5cIilcclxuICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxyXG4gICAgICAgIHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLmxvb21QbHVnaW4uc2V0dGluZ3MucnVuT25Xc2wpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgdGhpcy5sb29tUGx1Z2luLnNldHRpbmdzLnJ1bk9uV3NsID0gdmFsdWU7XHJcbiAgICAgICAgICBhd2FpdCB0aGlzLmxvb21QbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgfSksXHJcbiAgICAgICk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlbmRlckJ1aWx0SW5SdW50aW1lcyhjb250YWluZXJFbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcclxuICAgIHRoaXMuYWRkVGV4dFNldHRpbmcoY29udGFpbmVyRWwsIFwiUHl0aG9uIGV4ZWN1dGFibGVcIiwgXCJQYXRoIG9yIGNvbW1hbmQgbmFtZSBmb3IgUHl0aG9uLlwiLCBcInB5dGhvbkV4ZWN1dGFibGVcIik7XHJcbiAgICB0aGlzLmFkZFRleHRTZXR0aW5nKGNvbnRhaW5lckVsLCBcIk5vZGUgZXhlY3V0YWJsZVwiLCBcIlBhdGggb3IgY29tbWFuZCBuYW1lIGZvciBKYXZhU2NyaXB0IGV4ZWN1dGlvbi5cIiwgXCJub2RlRXhlY3V0YWJsZVwiKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJUeXBlU2NyaXB0IHJ1bm5lciBtb2RlXCIpXHJcbiAgICAgIC5zZXREZXNjKFwiVXNlIHRzLW5vZGUgb3IgdHN4IGZvciBUeXBlU2NyaXB0IGJsb2Nrcy5cIilcclxuICAgICAgLmFkZERyb3Bkb3duKChkcm9wZG93bikgPT5cclxuICAgICAgICBkcm9wZG93blxyXG4gICAgICAgICAgLmFkZE9wdGlvbihcInRzLW5vZGVcIiwgXCJ0cy1ub2RlXCIpXHJcbiAgICAgICAgICAuYWRkT3B0aW9uKFwidHN4XCIsIFwidHN4XCIpXHJcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5sb29tUGx1Z2luLnNldHRpbmdzLnR5cGVzY3JpcHRNb2RlKVxyXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLmxvb21QbHVnaW4uc2V0dGluZ3MudHlwZXNjcmlwdE1vZGUgPSB2YWx1ZSBhcyBcInRzLW5vZGVcIiB8IFwidHN4XCI7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMubG9vbVBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgIH0pLFxyXG4gICAgICApO1xyXG5cclxuICAgIHRoaXMuYWRkVGV4dFNldHRpbmcoY29udGFpbmVyRWwsIFwiVHlwZVNjcmlwdCB0cmFuc3BpbGVyIGV4ZWN1dGFibGVcIiwgXCJDb21tYW5kIG9yIHBhdGggZm9yIHRzLW5vZGUgb3IgdHN4LlwiLCBcInR5cGVzY3JpcHRUcmFuc3BpbGVyRXhlY3V0YWJsZVwiKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJPQ2FtbCBtb2RlXCIpXHJcbiAgICAgIC5zZXREZXNjKFwiQ2hvb3NlIGJldHdlZW4gdGhlIE9DYW1sIHRvcGxldmVsLCBvY2FtbGMgY29tcGlsYXRpb24sIG9yIGR1bmUgZXhlYy5cIilcclxuICAgICAgLmFkZERyb3Bkb3duKChkcm9wZG93bikgPT5cclxuICAgICAgICBkcm9wZG93blxyXG4gICAgICAgICAgLmFkZE9wdGlvbihcIm9jYW1sXCIsIFwib2NhbWxcIilcclxuICAgICAgICAgIC5hZGRPcHRpb24oXCJvY2FtbGNcIiwgXCJvY2FtbGNcIilcclxuICAgICAgICAgIC5hZGRPcHRpb24oXCJkdW5lXCIsIFwiZHVuZVwiKVxyXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMubG9vbVBsdWdpbi5zZXR0aW5ncy5vY2FtbE1vZGUpXHJcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMubG9vbVBsdWdpbi5zZXR0aW5ncy5vY2FtbE1vZGUgPSB2YWx1ZSBhcyBcIm9jYW1sXCIgfCBcIm9jYW1sY1wiIHwgXCJkdW5lXCI7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMubG9vbVBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgIH0pLFxyXG4gICAgICApO1xyXG5cclxuICAgIHRoaXMuYWRkVGV4dFNldHRpbmcoY29udGFpbmVyRWwsIFwiT0NhbWwgZXhlY3V0YWJsZVwiLCBcIkNvbW1hbmQgb3IgcGF0aCBmb3Igb2NhbWwsIG9jYW1sYywgb3IgZHVuZSBkZXBlbmRpbmcgb24gdGhlIHNlbGVjdGVkIG1vZGUuXCIsIFwib2NhbWxFeGVjdXRhYmxlXCIpO1xyXG4gICAgdGhpcy5hZGRUZXh0U2V0dGluZyhjb250YWluZXJFbCwgXCJDIGNvbXBpbGVyXCIsIFwiQ29tbWFuZCBvciBwYXRoIGZvciBjb21waWxpbmcgQyBibG9ja3MuXCIsIFwiY0V4ZWN1dGFibGVcIik7XHJcbiAgICB0aGlzLmFkZFRleHRTZXR0aW5nKGNvbnRhaW5lckVsLCBcIkMrKyBjb21waWxlclwiLCBcIkNvbW1hbmQgb3IgcGF0aCBmb3IgY29tcGlsaW5nIEMrKyBibG9ja3MuXCIsIFwiY3BwRXhlY3V0YWJsZVwiKTtcclxuICAgIHRoaXMuYWRkVGV4dFNldHRpbmcoY29udGFpbmVyRWwsIFwiU2hlbGwgZXhlY3V0YWJsZVwiLCBcIkNvbW1hbmQgb3IgcGF0aCBmb3IgU2hlbGwsIEJhc2gsIGFuZCBzaCBibG9ja3MuXCIsIFwic2hlbGxFeGVjdXRhYmxlXCIpO1xyXG4gICAgdGhpcy5hZGRUZXh0U2V0dGluZyhjb250YWluZXJFbCwgXCJSdWJ5IGV4ZWN1dGFibGVcIiwgXCJDb21tYW5kIG9yIHBhdGggZm9yIFJ1YnkgYmxvY2tzLlwiLCBcInJ1YnlFeGVjdXRhYmxlXCIpO1xyXG4gICAgdGhpcy5hZGRUZXh0U2V0dGluZyhjb250YWluZXJFbCwgXCJQZXJsIGV4ZWN1dGFibGVcIiwgXCJDb21tYW5kIG9yIHBhdGggZm9yIFBlcmwgYmxvY2tzLlwiLCBcInBlcmxFeGVjdXRhYmxlXCIpO1xyXG4gICAgdGhpcy5hZGRUZXh0U2V0dGluZyhjb250YWluZXJFbCwgXCJMdWEgZXhlY3V0YWJsZVwiLCBcIkNvbW1hbmQgb3IgcGF0aCBmb3IgTHVhIGJsb2Nrcy5cIiwgXCJsdWFFeGVjdXRhYmxlXCIpO1xyXG4gICAgdGhpcy5hZGRUZXh0U2V0dGluZyhjb250YWluZXJFbCwgXCJQSFAgZXhlY3V0YWJsZVwiLCBcIkNvbW1hbmQgb3IgcGF0aCBmb3IgUEhQIGJsb2Nrcy5cIiwgXCJwaHBFeGVjdXRhYmxlXCIpO1xyXG4gICAgdGhpcy5hZGRUZXh0U2V0dGluZyhjb250YWluZXJFbCwgXCJHbyBleGVjdXRhYmxlXCIsIFwiQ29tbWFuZCBvciBwYXRoIGZvciBHbyBibG9ja3MuXCIsIFwiZ29FeGVjdXRhYmxlXCIpO1xyXG4gICAgdGhpcy5hZGRUZXh0U2V0dGluZyhjb250YWluZXJFbCwgXCJSdXN0IGNvbXBpbGVyXCIsIFwiQ29tbWFuZCBvciBwYXRoIGZvciBjb21waWxpbmcgUnVzdCBibG9ja3MuXCIsIFwicnVzdEV4ZWN1dGFibGVcIik7XHJcbiAgICB0aGlzLmFkZFRleHRTZXR0aW5nKGNvbnRhaW5lckVsLCBcIkhhc2tlbGwgZXhlY3V0YWJsZVwiLCBcIkNvbW1hbmQgb3IgcGF0aCBmb3IgSGFza2VsbCBibG9ja3MuIERlZmF1bHRzIHRvIHJ1bmdoYy5cIiwgXCJoYXNrZWxsRXhlY3V0YWJsZVwiKTtcclxuICAgIHRoaXMuYWRkVGV4dFNldHRpbmcoY29udGFpbmVyRWwsIFwiSmF2YSBjb21waWxlclwiLCBcIk9wdGlvbmFsIGNvbW1hbmQgb3IgcGF0aCBmb3IgamF2YWMuIExlYXZlIGVtcHR5IHRvIHVzZSBKYXZhIHNvdXJjZS1maWxlIG1vZGUuXCIsIFwiamF2YUNvbXBpbGVyRXhlY3V0YWJsZVwiKTtcclxuICAgIHRoaXMuYWRkVGV4dFNldHRpbmcoY29udGFpbmVyRWwsIFwiSmF2YSBleGVjdXRhYmxlXCIsIFwiQ29tbWFuZCBvciBwYXRoIGZvciBydW5uaW5nIGNvbXBpbGVkIEphdmEgYmxvY2tzLlwiLCBcImphdmFFeGVjdXRhYmxlXCIpO1xyXG4gICAgdGhpcy5hZGRUZXh0U2V0dGluZyhjb250YWluZXJFbCwgXCJMTFZNIElSIGludGVycHJldGVyXCIsIFwiQ29tbWFuZCBvciBwYXRoIGZvciBydW5uaW5nIExMVk0gSVIgYmxvY2tzIHdpdGggbGxpLlwiLCBcImxsdm1JbnRlcnByZXRlckV4ZWN1dGFibGVcIik7XHJcbiAgICB0aGlzLmFkZFRleHRTZXR0aW5nKGNvbnRhaW5lckVsLCBcIkxlYW4gZXhlY3V0YWJsZVwiLCBcIkNvbW1hbmQgb3IgcGF0aCBmb3IgY2hlY2tpbmcgTGVhbiBibG9ja3MuXCIsIFwibGVhbkV4ZWN1dGFibGVcIik7XHJcbiAgICB0aGlzLmFkZFRleHRTZXR0aW5nKGNvbnRhaW5lckVsLCBcIkNvcSBleGVjdXRhYmxlXCIsIFwiQ29tbWFuZCBvciBwYXRoIGZvciBjaGVja2luZyBDb3EgYmxvY2tzIHdpdGggY29xYy5cIiwgXCJjb3FFeGVjdXRhYmxlXCIpO1xyXG4gICAgdGhpcy5hZGRUZXh0U2V0dGluZyhjb250YWluZXJFbCwgXCJTTVQgc29sdmVyXCIsIFwiQ29tbWFuZCBvciBwYXRoIGZvciBTTVQtTElCIGJsb2Nrcy4gRGVmYXVsdHMgdG8gejMuXCIsIFwic210RXhlY3V0YWJsZVwiKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVuZGVyQ3VzdG9tTGFuZ3VhZ2VzKGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xyXG4gICAgY29uc3QgbGlzdEVsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcImxvb20tY3VzdG9tLWxhbmd1YWdlLWxpc3RcIiB9KTtcclxuICAgIHRoaXMucmVuZGVyQ3VzdG9tTGFuZ3VhZ2VMaXN0KGxpc3RFbCk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiQWRkIGN1c3RvbSBsYW5ndWFnZVwiKVxyXG4gICAgICAuc2V0RGVzYyhcIkNyZWF0ZSBhIG5ldyBsb2NhbCBjb21tYW5kLWJhY2tlZCBsYW5ndWFnZS5cIilcclxuICAgICAgLmFkZEJ1dHRvbigoYnV0dG9uKSA9PlxyXG4gICAgICAgIGJ1dHRvbi5zZXRCdXR0b25UZXh0KFwiK1wiKS5vbkNsaWNrKGFzeW5jICgpID0+IHtcclxuICAgICAgICAgIHRoaXMubG9vbVBsdWdpbi5zZXR0aW5ncy5jdXN0b21MYW5ndWFnZXMucHVzaCh7XHJcbiAgICAgICAgICAgIG5hbWU6IFwiY3VzdG9tLWxhbmd1YWdlXCIsXHJcbiAgICAgICAgICAgIGFsaWFzZXM6IFwiXCIsXHJcbiAgICAgICAgICAgIGV4ZWN1dGFibGU6IFwiXCIsXHJcbiAgICAgICAgICAgIGFyZ3M6IFwie2ZpbGV9XCIsXHJcbiAgICAgICAgICAgIGV4dGVuc2lvbjogXCIudHh0XCIsXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICAgIGF3YWl0IHRoaXMubG9vbVBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgIHRoaXMuZGlzcGxheSgpO1xyXG4gICAgICAgIH0pLFxyXG4gICAgICApO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZW5kZXJDdXN0b21MYW5ndWFnZUxpc3QoY29udGFpbmVyRWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XHJcbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xyXG5cclxuICAgIGlmICghdGhpcy5sb29tUGx1Z2luLnNldHRpbmdzLmN1c3RvbUxhbmd1YWdlcy5sZW5ndGgpIHtcclxuICAgICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJwXCIsIHtcclxuICAgICAgICB0ZXh0OiBcIk5vIGN1c3RvbSBsYW5ndWFnZXMgY29uZmlndXJlZC5cIixcclxuICAgICAgICBjbHM6IFwic2V0dGluZy1pdGVtLWRlc2NyaXB0aW9uXCIsXHJcbiAgICAgIH0pO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5sb29tUGx1Z2luLnNldHRpbmdzLmN1c3RvbUxhbmd1YWdlcy5mb3JFYWNoKChsYW5ndWFnZSwgaW5kZXgpID0+IHtcclxuICAgICAgY29uc3QgZGV0YWlscyA9IGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiZGV0YWlsc1wiLCB7IGNsczogXCJsb29tLWN1c3RvbS1sYW5ndWFnZVwiIH0pO1xyXG4gICAgICBkZXRhaWxzLm9wZW4gPSB0cnVlO1xyXG4gICAgICBkZXRhaWxzLmNyZWF0ZUVsKFwic3VtbWFyeVwiLCB7IHRleHQ6IGxhbmd1YWdlLm5hbWUgfHwgYEN1c3RvbSBsYW5ndWFnZSAke2luZGV4ICsgMX1gIH0pO1xyXG4gICAgICBjb25zdCBib2R5ID0gZGV0YWlscy5jcmVhdGVEaXYoeyBjbHM6IFwibG9vbS1jdXN0b20tbGFuZ3VhZ2UtYm9keVwiIH0pO1xyXG5cclxuICAgICAgdGhpcy5hZGRDdXN0b21MYW5ndWFnZVRleHRTZXR0aW5nKGJvZHksIGxhbmd1YWdlLCBcIk5hbWVcIiwgXCJOb3JtYWxpemVkIGxhbmd1YWdlIGlkIHVzZWQgYnkgbG9vbS5cIiwgXCJuYW1lXCIpO1xyXG4gICAgICB0aGlzLmFkZEN1c3RvbUxhbmd1YWdlVGV4dFNldHRpbmcoYm9keSwgbGFuZ3VhZ2UsIFwiQWxpYXNlc1wiLCBcIkNvbW1hLXNlcGFyYXRlZCBmZW5jZSBhbGlhc2VzLlwiLCBcImFsaWFzZXNcIik7XHJcbiAgICAgIHRoaXMuYWRkQ3VzdG9tTGFuZ3VhZ2VUZXh0U2V0dGluZyhib2R5LCBsYW5ndWFnZSwgXCJFeGVjdXRhYmxlXCIsIFwiTG9jYWwgY29tbWFuZCBvciBhYnNvbHV0ZSBleGVjdXRhYmxlIHBhdGguXCIsIFwiZXhlY3V0YWJsZVwiKTtcclxuICAgICAgdGhpcy5hZGRDdXN0b21MYW5ndWFnZVRleHRTZXR0aW5nKGJvZHksIGxhbmd1YWdlLCBcIkFyZ3VtZW50c1wiLCBcIlNwYWNlLXNlcGFyYXRlZCBhcmd1bWVudHMuIFVzZSB7ZmlsZX0gZm9yIHRoZSB0ZW1wIHNvdXJjZSBmaWxlLlwiLCBcImFyZ3NcIik7XHJcbiAgICAgIHRoaXMuYWRkQ3VzdG9tTGFuZ3VhZ2VUZXh0U2V0dGluZyhib2R5LCBsYW5ndWFnZSwgXCJFeHRlbnNpb25cIiwgXCJUZW1wIHNvdXJjZSBmaWxlIGV4dGVuc2lvbiwgZm9yIGV4YW1wbGUgLnB5LlwiLCBcImV4dGVuc2lvblwiKTtcclxuXHJcbiAgICAgIG5ldyBTZXR0aW5nKGJvZHkpXHJcbiAgICAgICAgLnNldE5hbWUoXCJEZWxldGUgbGFuZ3VhZ2VcIilcclxuICAgICAgICAuc2V0RGVzYyhcIlJlbW92ZSB0aGlzIGN1c3RvbSBsYW5ndWFnZS5cIilcclxuICAgICAgICAuYWRkQnV0dG9uKChidXR0b24pID0+XHJcbiAgICAgICAgICBidXR0b24uc2V0QnV0dG9uVGV4dChcIkRlbGV0ZVwiKS5zZXRXYXJuaW5nKCkub25DbGljayhhc3luYyAoKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMubG9vbVBsdWdpbi5zZXR0aW5ncy5jdXN0b21MYW5ndWFnZXMuc3BsaWNlKGluZGV4LCAxKTtcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy5sb29tUGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICB0aGlzLmRpc3BsYXkoKTtcclxuICAgICAgICAgIH0pLFxyXG4gICAgICAgICk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXN5bmMgcmVuZGVyQ29udGFpbmVyR3JvdXBzKGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgbGlzdEVsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcImxvb20tY29udGFpbmVyLWdyb3VwLWxpc3RcIiB9KTtcclxuICAgIGxpc3RFbC5zZXRUZXh0KFwiU2Nhbm5pbmcgY29udGFpbmVyIGdyb3Vwcy4uLlwiKTtcclxuXHJcbiAgICBjb25zdCBncm91cHMgPSBhd2FpdCB0aGlzLmxvb21QbHVnaW4uZ2V0Q29udGFpbmVyR3JvdXBTdW1tYXJpZXMoKTtcclxuICAgIGxpc3RFbC5lbXB0eSgpO1xyXG5cclxuICAgIGlmICghZ3JvdXBzLmxlbmd0aCkge1xyXG4gICAgICBsaXN0RWwuY3JlYXRlRWwoXCJwXCIsIHtcclxuICAgICAgICB0ZXh0OiBcIk5vIGNvbnRhaW5lciBncm91cHMgZm91bmQgaW4gLm9ic2lkaWFuL3BsdWdpbnMvbG9vbS9jb250YWluZXJzLlwiLFxyXG4gICAgICAgIGNsczogXCJzZXR0aW5nLWl0ZW0tZGVzY3JpcHRpb25cIixcclxuICAgICAgfSk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBmb3IgKGNvbnN0IGdyb3VwIG9mIGdyb3Vwcykge1xyXG4gICAgICBuZXcgU2V0dGluZyhsaXN0RWwpXHJcbiAgICAgICAgLnNldE5hbWUoZ3JvdXAubmFtZSlcclxuICAgICAgICAuc2V0RGVzYyhncm91cC5zdGF0dXMpXHJcbiAgICAgICAgLmFkZEJ1dHRvbigoYnV0dG9uKSA9PlxyXG4gICAgICAgICAgYnV0dG9uLnNldEJ1dHRvblRleHQoXCJCdWlsZCAvIHJlYnVpbGRcIikub25DbGljayhhc3luYyAoKSA9PiB7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMubG9vbVBsdWdpbi5idWlsZENvbnRhaW5lckdyb3VwKGdyb3VwLm5hbWUpO1xyXG4gICAgICAgICAgfSksXHJcbiAgICAgICAgKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgYWRkVGV4dFNldHRpbmc8SyBleHRlbmRzIGtleW9mIGxvb21QbHVnaW5TZXR0aW5ncz4oY29udGFpbmVyRWw6IEhUTUxFbGVtZW50LCBuYW1lOiBzdHJpbmcsIGRlc2NyaXB0aW9uOiBzdHJpbmcsIGtleTogSyk6IHZvaWQge1xyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKG5hbWUpXHJcbiAgICAgIC5zZXREZXNjKGRlc2NyaXB0aW9uKVxyXG4gICAgICAuYWRkVGV4dCgodGV4dCkgPT5cclxuICAgICAgICB0ZXh0LnNldFZhbHVlKFN0cmluZyh0aGlzLmxvb21QbHVnaW4uc2V0dGluZ3Nba2V5XSA/PyBcIlwiKSkub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAodGhpcy5sb29tUGx1Z2luLnNldHRpbmdzW2tleV0gYXMgc3RyaW5nKSA9IHZhbHVlLnRyaW0oKTtcclxuICAgICAgICAgIGF3YWl0IHRoaXMubG9vbVBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICB9KSxcclxuICAgICAgKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYWRkQ3VzdG9tTGFuZ3VhZ2VUZXh0U2V0dGluZzxLIGV4dGVuZHMga2V5b2YgbG9vbUN1c3RvbUxhbmd1YWdlPihcclxuICAgIGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCxcclxuICAgIGxhbmd1YWdlOiBsb29tQ3VzdG9tTGFuZ3VhZ2UsXHJcbiAgICBuYW1lOiBzdHJpbmcsXHJcbiAgICBkZXNjcmlwdGlvbjogc3RyaW5nLFxyXG4gICAga2V5OiBLLFxyXG4gICk6IHZvaWQge1xyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKG5hbWUpXHJcbiAgICAgIC5zZXREZXNjKGRlc2NyaXB0aW9uKVxyXG4gICAgICAuYWRkVGV4dCgodGV4dCkgPT5cclxuICAgICAgICB0ZXh0LnNldFZhbHVlKGxhbmd1YWdlW2tleV0pLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgbGFuZ3VhZ2Vba2V5XSA9IHZhbHVlLnRyaW0oKTtcclxuICAgICAgICAgIGF3YWl0IHRoaXMubG9vbVBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICB9KSxcclxuICAgICAgKTtcclxuICB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBzaG93RXhlY3V0aW9uRGlzYWJsZWROb3RpY2UoKTogdm9pZCB7XHJcbiAgbmV3IE5vdGljZShcImxvb20gbG9jYWwgZXhlY3V0aW9uIGlzIGRpc2FibGVkLiBFbmFibGUgaXQgaW4gc2V0dGluZ3Mgb3IgY29uZmlybSB0aGUgZXhlY3V0aW9uIHdhcm5pbmcgZmlyc3QuXCIpO1xyXG59XHJcbiIsICJpbXBvcnQgeyBzZXRJY29uIH0gZnJvbSBcIm9ic2lkaWFuXCI7XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIGxvb21Ub29sYmFySGFuZGxlcnMge1xyXG4gIG9uUnVuOiAoKSA9PiB2b2lkO1xyXG4gIG9uQ29weTogKCkgPT4gdm9pZDtcclxuICBvblJlbW92ZTogKCkgPT4gdm9pZDtcclxuICBvblRvZ2dsZU91dHB1dDogKCkgPT4gdm9pZDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNvZGVCbG9ja1Rvb2xiYXIoXHJcbiAgYmxvY2tJZDogc3RyaW5nLFxyXG4gIGlzUnVubmluZzogYm9vbGVhbixcclxuICBoYW5kbGVyczogbG9vbVRvb2xiYXJIYW5kbGVycyxcclxuKTogSFRNTERpdkVsZW1lbnQge1xyXG4gIGNvbnN0IHRvb2xiYXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gIHRvb2xiYXIuY2xhc3NOYW1lID0gXCJsb29tLWNvZGUtdG9vbGJhclwiO1xyXG4gIHRvb2xiYXIuZGF0YXNldC5sb29tQmxvY2tJZCA9IGJsb2NrSWQ7XHJcblxyXG4gIHRvb2xiYXIuYXBwZW5kQ2hpbGQoY3JlYXRlQnV0dG9uKFwiUnVuIGJsb2NrXCIsIGlzUnVubmluZyA/IFwibG9hZGVyLWNpcmNsZVwiIDogXCJwbGF5XCIsIGhhbmRsZXJzLm9uUnVuLCBpc1J1bm5pbmcpKTtcclxuICB0b29sYmFyLmFwcGVuZENoaWxkKGNyZWF0ZUJ1dHRvbihcIkNvcHkgY29kZVwiLCBcImNvcHlcIiwgaGFuZGxlcnMub25Db3B5LCBmYWxzZSkpO1xyXG4gIHRvb2xiYXIuYXBwZW5kQ2hpbGQoY3JlYXRlQnV0dG9uKFwiUmVtb3ZlIHNuaXBwZXRcIiwgXCJ0cmFzaC0yXCIsIGhhbmRsZXJzLm9uUmVtb3ZlLCBmYWxzZSkpO1xyXG4gIHRvb2xiYXIuYXBwZW5kQ2hpbGQoY3JlYXRlQnV0dG9uKFwiVG9nZ2xlIG91dHB1dFwiLCBcInBhbmVsLWJvdHRvbS1vcGVuXCIsIGhhbmRsZXJzLm9uVG9nZ2xlT3V0cHV0LCBmYWxzZSkpO1xyXG5cclxuICByZXR1cm4gdG9vbGJhcjtcclxufVxyXG5cclxuZnVuY3Rpb24gY3JlYXRlQnV0dG9uKGxhYmVsOiBzdHJpbmcsIGljb25OYW1lOiBzdHJpbmcsIG9uQ2xpY2s6ICgpID0+IHZvaWQsIHNwaW5uaW5nOiBib29sZWFuKTogSFRNTEJ1dHRvbkVsZW1lbnQge1xyXG4gIGNvbnN0IGJ1dHRvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIik7XHJcbiAgYnV0dG9uLmNsYXNzTmFtZSA9IGBsb29tLXRvb2xiYXItYnV0dG9uJHtzcGlubmluZyA/IFwiIGlzLXJ1bm5pbmdcIiA6IFwiXCJ9YDtcclxuICBidXR0b24udHlwZSA9IFwiYnV0dG9uXCI7XHJcbiAgYnV0dG9uLnNldEF0dHJpYnV0ZShcImFyaWEtbGFiZWxcIiwgbGFiZWwpO1xyXG4gIGJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGV2ZW50KSA9PiB7XHJcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICBvbkNsaWNrKCk7XHJcbiAgfSk7XHJcbiAgc2V0SWNvbihidXR0b24sIGljb25OYW1lKTtcclxuICByZXR1cm4gYnV0dG9uO1xyXG59XHJcbiIsICJpbXBvcnQgeyBzZXRJY29uIH0gZnJvbSBcIm9ic2lkaWFuXCI7XHJcbmltcG9ydCB0eXBlIHsgbG9vbVN0b3JlZE91dHB1dCB9IGZyb20gXCIuLi90eXBlc1wiO1xyXG5cclxuZnVuY3Rpb24gZ2V0U3RhdHVzS2luZChvdXRwdXQ6IGxvb21TdG9yZWRPdXRwdXQpOiBcInN1Y2Nlc3NcIiB8IFwid2FybmluZ1wiIHwgXCJmYWlsdXJlXCIge1xyXG4gIGlmIChvdXRwdXQucmVzdWx0LnN1Y2Nlc3MpIHtcclxuICAgIHJldHVybiBvdXRwdXQucmVzdWx0LnN0ZGVyci50cmltKCkgfHwgb3V0cHV0LnJlc3VsdC53YXJuaW5nPy50cmltKCkgPyBcIndhcm5pbmdcIiA6IFwic3VjY2Vzc1wiO1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIFwiZmFpbHVyZVwiO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlT3V0cHV0UGFuZWwob3V0cHV0OiBsb29tU3RvcmVkT3V0cHV0KTogSFRNTERpdkVsZW1lbnQge1xyXG4gIGNvbnN0IHBhbmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuICBwYW5lbC5jbGFzc05hbWUgPSBgbG9vbS1vdXRwdXQtcGFuZWwgaXMtJHtnZXRTdGF0dXNLaW5kKG91dHB1dCl9JHtvdXRwdXQudmlzaWJsZSA/IFwiXCIgOiBcIiBpcy1oaWRkZW5cIn1gO1xyXG4gIHBhbmVsLmRhdGFzZXQubG9vbUJsb2NrSWQgPSBvdXRwdXQuYmxvY2tJZDtcclxuICByZW5kZXJPdXRwdXRQYW5lbChwYW5lbCwgb3V0cHV0KTtcclxuICByZXR1cm4gcGFuZWw7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJPdXRwdXRQYW5lbChwYW5lbDogSFRNTEVsZW1lbnQsIG91dHB1dDogbG9vbVN0b3JlZE91dHB1dCk6IHZvaWQge1xyXG4gIGNvbnN0IGtpbmQgPSBnZXRTdGF0dXNLaW5kKG91dHB1dCk7XHJcbiAgcGFuZWwuY2xhc3NOYW1lID0gYGxvb20tb3V0cHV0LXBhbmVsIGlzLSR7a2luZH0ke291dHB1dC52aXNpYmxlID8gXCJcIiA6IFwiIGlzLWhpZGRlblwifSR7b3V0cHV0LmNvbGxhcHNlZCA/IFwiIGlzLWNvbGxhcHNlZFwiIDogXCJcIn1gO1xyXG4gIHBhbmVsLmVtcHR5KCk7XHJcblxyXG4gIGNvbnN0IGhlYWRlciA9IHBhbmVsLmNyZWF0ZURpdih7IGNsczogXCJsb29tLW91dHB1dC1oZWFkZXJcIiB9KTtcclxuICBjb25zdCBiYWRnZSA9IGhlYWRlci5jcmVhdGVEaXYoeyBjbHM6IFwibG9vbS1vdXRwdXQtYmFkZ2VcIiB9KTtcclxuICBzZXRJY29uKGJhZGdlLCBraW5kID09PSBcInN1Y2Nlc3NcIiA/IFwiY2hlY2stY2lyY2xlLTJcIiA6IGtpbmQgPT09IFwid2FybmluZ1wiID8gXCJhbGVydC10cmlhbmdsZVwiIDogXCJ4LWNpcmNsZVwiKTtcclxuXHJcbiAgY29uc3QgdGl0bGUgPSBoZWFkZXIuY3JlYXRlRGl2KHsgY2xzOiBcImxvb20tb3V0cHV0LXRpdGxlXCIgfSk7XHJcbiAgdGl0bGUuc2V0VGV4dChgJHtvdXRwdXQucmVzdWx0LnJ1bm5lck5hbWV9IFx1MDBCNyBleGl0ICR7b3V0cHV0LnJlc3VsdC5leGl0Q29kZSA/PyBcIj9cIn1gKTtcclxuXHJcbiAgY29uc3QgbWV0YSA9IGhlYWRlci5jcmVhdGVEaXYoeyBjbHM6IFwibG9vbS1vdXRwdXQtbWV0YVwiIH0pO1xyXG4gIG1ldGEuc2V0VGV4dChgJHtvdXRwdXQucmVzdWx0LmR1cmF0aW9uTXN9IG1zIFx1MDBCNyAke25ldyBEYXRlKG91dHB1dC5yZXN1bHQuZmluaXNoZWRBdCkudG9Mb2NhbGVUaW1lU3RyaW5nKCl9YCk7XHJcblxyXG4gIGNvbnN0IGJvZHkgPSBwYW5lbC5jcmVhdGVEaXYoeyBjbHM6IFwibG9vbS1vdXRwdXQtYm9keVwiIH0pO1xyXG4gIGlmIChvdXRwdXQucmVzdWx0LnN0ZG91dC50cmltKCkpIHtcclxuICAgIGNyZWF0ZVN0cmVhbShib2R5LCBcIlN0ZG91dFwiLCBvdXRwdXQucmVzdWx0LnN0ZG91dCk7XHJcbiAgfVxyXG4gIGlmIChvdXRwdXQucmVzdWx0Lndhcm5pbmc/LnRyaW0oKSkge1xyXG4gICAgY3JlYXRlU3RyZWFtKGJvZHksIFwiV2FybmluZ1wiLCBvdXRwdXQucmVzdWx0Lndhcm5pbmcpO1xyXG4gIH1cclxuICBpZiAob3V0cHV0LnJlc3VsdC5zdGRlcnIudHJpbSgpKSB7XHJcbiAgICBjcmVhdGVTdHJlYW0oYm9keSwgXCJTdGRlcnJcIiwgb3V0cHV0LnJlc3VsdC5zdGRlcnIpO1xyXG4gIH1cclxuICBpZiAoIW91dHB1dC5yZXN1bHQuc3Rkb3V0LnRyaW0oKSAmJiAhb3V0cHV0LnJlc3VsdC53YXJuaW5nPy50cmltKCkgJiYgIW91dHB1dC5yZXN1bHQuc3RkZXJyLnRyaW0oKSkge1xyXG4gICAgY29uc3QgZW1wdHkgPSBib2R5LmNyZWF0ZURpdih7IGNsczogXCJsb29tLW91dHB1dC1lbXB0eVwiIH0pO1xyXG4gICAgZW1wdHkuc2V0VGV4dChcIk5vIG91dHB1dFwiKTtcclxuICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNyZWF0ZVN0cmVhbShjb250YWluZXI6IEhUTUxFbGVtZW50LCBsYWJlbDogc3RyaW5nLCBjb250ZW50OiBzdHJpbmcpOiB2b2lkIHtcclxuICBjb25zdCBzZWN0aW9uID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogXCJsb29tLW91dHB1dC1zdHJlYW1cIiB9KTtcclxuICBzZWN0aW9uLmNyZWF0ZURpdih7IGNsczogXCJsb29tLW91dHB1dC1zdHJlYW0tbGFiZWxcIiwgdGV4dDogbGFiZWwgfSk7XHJcbiAgc2VjdGlvbi5jcmVhdGVFbChcInByZVwiLCB7IGNsczogXCJsb29tLW91dHB1dC1wcmVcIiwgdGV4dDogY29udGVudCB9KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVJ1bm5pbmdQYW5lbCgpOiBIVE1MRGl2RWxlbWVudCB7XHJcbiAgY29uc3QgcGFuZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gIHBhbmVsLmNsYXNzTmFtZSA9IFwibG9vbS1vdXRwdXQtcGFuZWwgaXMtcnVubmluZ1wiO1xyXG5cclxuICBjb25zdCBoZWFkZXIgPSBwYW5lbC5jcmVhdGVEaXYoeyBjbHM6IFwibG9vbS1vdXRwdXQtaGVhZGVyXCIgfSk7XHJcbiAgY29uc3Qgc3Bpbm5lciA9IGhlYWRlci5jcmVhdGVEaXYoeyBjbHM6IFwibG9vbS1zcGlubmVyXCIgfSk7XHJcbiAgc2V0SWNvbihzcGlubmVyLCBcImxvYWRlci1jaXJjbGVcIik7XHJcbiAgY29uc3QgdGl0bGUgPSBoZWFkZXIuY3JlYXRlRGl2KHsgY2xzOiBcImxvb20tb3V0cHV0LXRpdGxlXCIgfSk7XHJcbiAgdGl0bGUuc2V0VGV4dChcIlJ1bm5pbmdcIik7XHJcbiAgY29uc3QgbWV0YSA9IGhlYWRlci5jcmVhdGVEaXYoeyBjbHM6IFwibG9vbS1vdXRwdXQtbWV0YVwiIH0pO1xyXG4gIG1ldGEuc2V0VGV4dChcIkV4ZWN1dGluZy4uLlwiKTtcclxuICBzcGlubmVyLnNldEF0dHJpYnV0ZShcImFyaWEtaGlkZGVuXCIsIFwidHJ1ZVwiKTtcclxuXHJcbiAgcmV0dXJuIHBhbmVsO1xyXG59XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQUFBQSxtQkFRTztBQUNQLG1CQUE2QztBQUM3QyxJQUFBQyxlQUEyRTtBQUMzRSxJQUFBQyxlQUF3Qjs7O0FDWHhCLHNCQUE2QztBQUM3QyxnQkFBMkI7QUFDM0IsSUFBQUMsbUJBQStDO0FBQy9DLElBQUFDLGVBQTZEOzs7QUNIN0Qsc0JBQXVDO0FBQ3ZDLGdCQUF1QjtBQUN2QixrQkFBcUI7QUFDckIsMkJBQXNCO0FBd0J0QixlQUFzQix3QkFDcEIs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O0FBQ2pHLFVBQU0sT0FBTztBQUFBLE1BQ1gsVUFBVSxPQUFPLFVBQVU7QUFBQSxNQUMzQixRQUFRLE9BQU8sWUFBWSxHQUFHO0FBQUEsTUFDOUIsWUFBWSxPQUFPLFVBQVU7QUFBQSxNQUM3QixhQUFhLE9BQU8sVUFBVTtBQUFBLE1BQzlCLE9BQU8sU0FBUztBQUFBLEVBQVksT0FBTyxNQUFNLEtBQUs7QUFBQSxNQUM5QyxPQUFPLFVBQVU7QUFBQSxFQUFhLE9BQU8sT0FBTyxLQUFLO0FBQUEsTUFDakQsT0FBTyxTQUFTO0FBQUEsRUFBWSxPQUFPLE1BQU0sS0FBSztBQUFBLElBQ2hELEVBQ0csT0FBTyxPQUFPLEVBQ2QsS0FBSyxNQUFNO0FBRWQsV0FBTztBQUFBLE1BQ0wsNkJBQTZCLE9BQU87QUFBQSxNQUNwQztBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFFUSx1QkFBdUIsT0FBaUIsU0FBd0Q7QUFDdEcsVUFBTSxjQUFjLDZCQUE2QixPQUFPO0FBQ3hELGFBQVMsSUFBSSxHQUFHLElBQUksTUFBTSxRQUFRLEtBQUssR0FBRztBQUN4QyxVQUFJLE1BQU0sQ0FBQyxFQUFFLEtBQUssTUFBTSxhQUFhO0FBQ25DO0FBQUEsTUFDRjtBQUVBLGVBQVMsSUFBSSxJQUFJLEdBQUcsSUFBSSxNQUFNLFFBQVEsS0FBSyxHQUFHO0FBQzVDLFlBQUksTUFBTSxDQUFDLEVBQUUsS0FBSyxNQUFNLDRCQUE0QjtBQUNsRCxpQkFBTyxFQUFFLE9BQU8sR0FBRyxLQUFLLEVBQUU7QUFBQSxRQUM1QjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQ0EsV0FBTztBQUFBLEVBQ1Q7QUFDRjsiLAogICJuYW1lcyI6IFsiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF92aWV3IiwgImltcG9ydF9wYXRoIiwgImltcG9ydF9wcm9taXNlcyIsICJpbXBvcnRfcGF0aCIsICJub3JtYWxpemVGc1BhdGgiLCAiZ2V0TGVhZGluZ1doaXRlc3BhY2UiLCAibm9ybWFsaXplRXh0ZW5zaW9uIiwgImltcG9ydF9wYXRoIiwgImltcG9ydF9wYXRoIiwgImltcG9ydF9wYXRoIiwgImltcG9ydF9mcyIsICJpbXBvcnRfcGF0aCIsICJpbXBvcnRfb2JzaWRpYW4iLCAibG9vbVBsdWdpbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIl0KfQo=
