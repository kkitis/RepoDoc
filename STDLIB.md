# RepoDoc — Standard Library Write-Up

A candid account of how a codebase auditor was built with **zero npm packages**, using only Node.js built-ins. Prepared for the Hackathon Raptors **Zero Dependency | 72-Hour Hackathon** (Package Killer / Best Write-Up tracks).

---

## 1. Executive Summary & Philosophy

RepoDoc is a Node.js CLI that walks a repository, counts lines, and extracts developer action items (`TODO`, `FIXME`, `BUG`). It prints a markdown or terminal report. The entire pipeline—argument parsing, recursive traversal, UTF-8 reads, regex annotation, line classification, colored stdout, file output, unit tests, and process-spawned E2E tests—runs on the Node.js standard library.

`package.json` is the contract:

```json
{
  "type": "module",
  "bin": { "repodoc": "./src/cli.js" },
  "scripts": { "test": "node --test" },
  "dependencies": {}
}
```

There is no `devDependencies` either. Tests are not a second product; they are first-class stdlib.

**Why zero dependencies is not a slogan here:**

| Constraint | What it actually means for this repo |
| --- | --- |
| Instant execution | `node src/cli.js <dir>` starts immediately. No lockfile resolution, no postinstall scripts, no native addon compile. |
| Supply chain | The attack surface is Node itself plus our four modules. We do not inherit hundreds of transitive maintainers for `parseArgs` or `readdir`. |
| 0 KB `node_modules` | `"dependencies": {}` is empty by policy. Install size is the source tree. |
| Language fundamentals | CLI flags, path separators, binary vs text, and comment syntax are *our* problems. That is the point of the track. |

We did not wrap stdlib in a homemade “framework.” Each module maps to one job: `scanner.js` walks, `analyzer.js` tokenizes, `formatter.js` renders strings, `cli.js` wires `process.argv` to that pipeline.

---

## 2. The Package Killer Matrix

These are the libraries a typical “repo stats + TODO CLI” would pull in, and the exact Node APIs that replaced them.

| Problem | Typical npm package | Node.js stdlib replacement | Where it lives |
| --- | --- | --- | --- |
| CLI flags, shorts, help | `commander`, `yargs` | `node:util` → `parseArgs` | `src/cli.js` |
| Colored terminal output | `chalk`, `picocolors`, `kleur` | `node:util` → `styleText` | `src/cli.js` |
| Recursive file discovery | `glob`, `fast-glob`, `globby`, `tree-cli` | `node:fs/promises` `readdir({ withFileTypes: true })` + `node:path` | `src/scanner.js` |
| TODO / FIXME extraction | `leasot`, custom `todo-regex` packages | Native `RegExp` + `String.prototype.split` / `match` | `src/analyzer.js` |
| Line / comment / code counts | `cloc`, `scc` (as a subprocess or binding) | `readFile` + `\r?\n` split + a small state machine | `src/analyzer.js`, `src/cli.js` |
| Markdown / ASCII tables | `cli-table3`, `markdown-table` | Template strings and `Array.join('\n')` | `src/formatter.js` |
| Unit + E2E tests | `jest`, `mocha`, `vitest` | `node:test` + `node:assert/strict` (+ `node:child_process` for E2E) | `test/*.test.js` |

Nothing in that table required a download. Node 20+ already ships `parseArgs` and `styleText`; `node:test` is invoked as `node --test`.

---

## 3. Architecture & Stdlib Deep Dives

Pipeline:

```
argv  →  parseArgs  →  scanDirectory  →  readFile (utf8)  →  analyzeFile  →  formatReport  →  stdout | writeFile
              │                │                                    │
         node:util        node:fs/promises                     native RegExp
                          node:path
```

Shared shapes live in `src/types.js` as JSDoc typedefs (`TodoMatch`, `FileStats`, `ScanResult`)—documentation, not a runtime type package.

### 3.1 Argument parsing & CLI UX (`node:util`)

Many CLIs add `--dir` as a named option. RepoDoc treats the **target directory as a positional** (`node src/cli.js [directory]`). That is what `parseArgs`’s `allowPositionals: true` is for: one optional path, defaults to `.`, resolved with `path.resolve`. Named options stay for output and ignore lists.

```js
import { parseArgs, styleText } from 'node:util';

function parseFlags(argv = process.argv) {
  const { values, positionals } = parseArgs({
    args: argv.slice(2),
    options: {
      output: { type: 'string', short: 'o' },
      ignore: { type: 'string', multiple: true, short: 'i' },
      help: { type: 'boolean', short: 'h' }
    },
    allowPositionals: true
  });

  return {
    _: positionals,
    output: values.output,
    ignore: values.ignore ?? [],
    help: values.help ?? false
  };
}
```

Mechanics that replace yargs/commander:

- `args: argv.slice(2)` drops `node` and the script path—the same convention as `process.argv` without a framework.
- `short` maps `-o` / `-i` / `-h` without a separate `.option('-o, --output')` DSL.
- `multiple: true` on `ignore` lets the user pass `-i foo -i bar`; `parseArgs` returns an array. No custom accumulator.
- Help is a boolean flag plus a string printed by us. We did not generate a usage tree from a schema.

Color without chalk:

```js
console.log(styleText('bold', 'RepoDoc'));
console.log(styleText('yellow', `Could not read: ${filePath}`));
console.log(styleText('green', `Analyzed ${analyzedFiles.length} files`));
console.error(styleText('red', `Error: ${error.message}`));
```

`styleText` emits ANSI when the stream supports it. We do not maintain our own escape-code map.

`main` is exported so tests can import it later if needed; the process entry is gated so `node --test` does not auto-run the CLI when the module is loaded from the test runner. Direct-run detection has to survive Windows paths (see §4.3).

### 3.2 File system traversal (`node:fs/promises`, `node:path`)

`scanDirectory` returns **paths only**. Contents are read one file at a time in the CLI. That split keeps the walker small and avoids loading a glob library’s matcher.

`readdir` with `withFileTypes: true` is the replacement for `glob('**/*')`:

```js
entries = await fs.readdir(dir, { withFileTypes: true });

for (const entry of entries) {
  if (entry.isSymbolicLink()) continue;

  const fullPath = path.join(dir, entry.name);
  if (shouldIgnore(fullPath, rootDir, patterns)) continue;

  if (entry.isDirectory()) {
    await walk(fullPath, rootDir, patterns, files);
  } else if (entry.isFile()) {
    const extension = path.extname(entry.name).toLowerCase();
    if (!TEXT_EXTENSIONS.has(extension)) continue;
    files.push(fullPath);
  }
}
```

What this buys vs `glob` / `tree-cli`:

- `Dirent` methods (`isFile`, `isDirectory`, `isSymbolicLink`) avoid a second `stat` per name.
- Symlinks are skipped so a looped link cannot recurse forever.
- `EACCES` / `ENOENT` / `EPERM` are swallowed at directory level; other errors propagate. No `graceful-fs`.
- Default ignore names are merged with `-i` via `Set`, then matched with `path.basename` and `path.relative`.

The CLI then reads only those paths:

```js
const source = await fs.readFile(filePath, 'utf8');
const relativePath = path.relative(rootDir, filePath);
analyzedFiles.push(analyzeFile(relativePath, source));
```

`path.relative` is what makes report rows look like `src/cli.js` instead of an absolute Windows or POSIX dump.

### 3.3 Parsing & annotation engine (native `RegExp`)

We did not parse ASTs (`@babel/parser`, `typescript`, `espree`). Annotation hunt is line-oriented on purpose: TODOs live in comments, and comment prefixes are a closed set for this tool (`//`, `/*`, `*`, `#`, `--`, `<!--`).

```js
const lines = source.split(/\r?\n/);
const regex =
  /(?:\/\/|\/\*|\*|#|--|<!--)\s*@?(TODO|FIXME|BUG)\b\s*:?\s*(.*?)\s*(?:\*\/|-->)?$/i;

for (let i = 0; i < lines.length; i++) {
  const match = lines[i].match(regex);
  if (match) {
    annotations.push({
      file: filePath,
      line: i + 1,
      text: `${match[1].toUpperCase()}: ${match[2].trim()}`
    });
  }
}
```

Details that matter:

- `\r?\n` treats CRLF and LF as one line boundary (Windows checkouts vs Git LF).
- Line numbers are **1-based** (`i + 1`), which is what humans and editors expect—no extra library.
- `\b` after the tag avoids matching `TODOING` as `TODO`.
- Optional `@` and optional `:` cover `// @TODO later` and `// FIXME: broken`.
- The same split feeds `countLines`, which is a comment-aware state machine (`insideBlockComment`) rather than `cloc`. It classifies blank vs `//` / `#` / `--` vs `/*` / `<!--` vs code. That is not language-perfect (inline `code; // comment` counts as code), and we are explicit about that: it is a stdlib tokenizer, not a compiler.

`path.extname(filePath).toLowerCase()` groups files without `mime-types` or `file-type`.

### 3.4 Native testing (`node:test`, `node:assert/strict`)

`npm test` is `node --test`. No Jest config, no Mocha `require` hooks, no snapshot serializer.

Unit tests import the analyzer as an ESM module and use strict assertions:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFile, groupByExtension } from '../src/analyzer.js';

it('finds TODO, FIXME, and BUG tags', () => {
  const { todos } = analyzeFile('src/example.js', source);
  assert.deepEqual(kinds, ['TODO', 'FIXME', 'BUG']);
});
```

E2E tests spawn the real CLI with `node:child_process` `exec`, create fixtures with `mkdir` / `writeFile`, and tear down with `rm`:

```js
import { exec } from 'node:child_process';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';

function runCli(argString) {
  return new Promise((resolve) => {
    exec(`node ${cliPath} ${argString}`, { cwd: repoRoot }, (error, stdout, stderr) => {
      resolve({
        code: error && error.code != null ? error.code : 0,
        stdout: stdout ?? '',
        stderr: stderr ?? ''
      });
    });
  });
}
```

That is the replacement for `execa` + Jest: a Promise around `exec`, `assert.match` on stdout, `assert.equal` on exit code. `before` / `after` hooks are provided by `node:test`.

---

## 4. The Edge Cases That Ate an Afternoon

Stdlib does not hide filesystem reality. Three issues showed up on a real JavaScript tree (142 files) and forced small, explicit rules.

### 4.1 Binary file ingestion

**Symptom.** Reports listed rows such as `images/appliance-instructions.png | 1513 | 0`. PNG is not 1,513 lines of code. `readFile(..., 'utf8')` decoded a binary buffer as a string; the PNG format contains `0x0A` bytes. `split(/\r?\n/)` treated those as newlines.

**Fix.** Do not read binaries. The scanner keeps a `Set` of text/code extensions and skips everything else *before* `readFile`:

```js
const TEXT_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx',
  '.html', '.htm', '.css', '.json', '.md', '.txt'
]);

const extension = path.extname(entry.name).toLowerCase();
if (!TEXT_EXTENSIONS.has(extension)) continue;
```

A whitelist is stricter than “skip known image extensions.” New binary types (`.webp`, `.woff2`, `.ico`) stay out by default. `path.extname` + `toLowerCase()` covers `.PNG` vs `.png` without a mime database.

### 4.2 Third-party / vendor noise

**Symptom.** Nine TODOs, all from one file: `tests-jasmine/lib/jasmine-5.1.1/jasmine.js` (~10,800 lines). First-party work was invisible next to a vendored test runner.

**Fix.** Default ignore used to be `node_modules` and `.git` only. It now includes the usual build and vendor directory names:

```js
const DEFAULT_IGNORE = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'vendor',
  'lib',
  'coverage'
];
```

We did **not** special-case the string `tests-jasmine`. Matching is by directory **name** (`path.basename`) or by whether the relative path **contains** the pattern. `lib` in `tests-jasmine/lib/jasmine-5.1.1/` is enough to drop that tree. Extra `-i` flags still merge in via `parseArgs`.

Trade-off we accepted: a first-party folder literally named `lib` is skipped. For a hackathon auditor aimed at *your* source, that is preferable to drowning in Jasmine.

### 4.3 Cross-platform path handling

Windows uses `\`; POSIX uses `/`. Concatenating with `'/'` or splitting on `'/'` is how CLIs break on one OS.

RepoDoc uses `node:path` at every boundary:

| Operation | API | Why |
| --- | --- | --- |
| Absolute scan root | `path.resolve(rootDir)` / `path.resolve(flags._[0] ?? '.')` | `.` and relative args become an absolute root on the host OS. |
| Child paths | `path.join(dir, entry.name)` | One code path for both separators. |
| Report paths | `path.relative(rootDir, filePath)` | Portable relative rows in markdown. |
| Extension filter | `path.extname(entry.name)` | Works whether the name was joined with `\` or `/`. |
| Output file | `path.resolve(flags.output)` | `-o` is not cwd-relative guesswork. |

Direct-run detection cannot use `endsWith('src/cli.js')` on Windows, because `process.argv[1]` looks like `C:\...\src\cli.js`. The CLI normalizes before the check:

```js
const isDirectRun =
  Boolean(process.argv[1]) &&
  process.argv[1].replace(/\\/g, '/').endsWith('/src/cli.js');
```

That is the one place we rewrite separators by hand: comparing a *script identity* string, not walking the disk.

A related UI bug: `formatReport` printed `**Root:** undefined` because `ScanResult.root` was omitted. Formatter now resolves `result.root ?? options.root ?? process.cwd()`; the CLI passes the same `rootDir` it scanned. No path library required—just not dropping the field.

---

## 5. Performance & Overhead Comparison

Numbers that matter for this track are **install graph** and **startup**, not a synthetic LOC/s bake-off against `scc`.

### 5.1 Dependency graph

| Metric | RepoDoc | Typical CLI stack (illustrative) |
| --- | --- | --- |
| Direct dependencies | **0** | `commander` + `chalk` + `glob` + `leasot` + test runner ≈ 5–8 |
| Transitive packages | **0** | Commonly **50+** once glob, color, and Jest/Mocha trees expand |
| `node_modules` size | **0 KB** (directory unused) | Multi-megabyte; Jest alone is a large tree |
| `package-lock.json` purpose | Records empty install | Pins dozens of nested versions |

A lockfile with no packages is still a lockfile; it does not pull tarballs.

### 5.2 Install and run

| Step | RepoDoc | Traditional |
| --- | --- | --- |
| `npm install` | Completes with nothing to fetch (**0.00s** of package extraction) | Network + extract + optional native builds |
| Time-to-first-scan | `node src/cli.js .` | `npm install` then binary or `npx` |
| Test run | `node --test` | `jest` / `mocha` after installing the runner |

Runtime of the scan itself is sequential `readFile` over the whitelist. That is simpler than a worker pool and fast enough for the trees we measured (on the order of low hundreds of text files). Parallelism would still be `Promise` + stdlib, not `p-limit` from npm.

### 5.3 What we refused to add

- No `fast-glob` for ignore globs; directory-name ignore is enough for `node_modules` / `dist` / `lib`.
- No `ignore` package for `.gitignore` parsing; defaults plus `-i` are the policy.
- No `marked` or HTML report stack; markdown is assembled as strings.
- No `ora` / `cli-spinners`; status lines are `console.log`.

If a feature needed a package, it was out of scope for this hackathon.

---

## Stdlib index (this repository)

| Module | Built-ins |
| --- | --- |
| `src/cli.js` | `node:util` (`parseArgs`, `styleText`), `node:path`, `node:fs/promises`, `process` |
| `src/scanner.js` | `node:fs/promises`, `node:path` |
| `src/analyzer.js` | `node:path`, `RegExp`, `String` |
| `src/formatter.js` | `process.cwd()`, string assembly |
| `test/analyzer.test.js` | `node:test`, `node:assert/strict` |
| `test/e2e.test.js` | `node:test`, `node:assert/strict`, `node:child_process`, `node:path`, `node:fs/promises` |

That is the whole product: Node’s standard library, applied until the report is honest about binaries, vendor trees, and Windows paths.
