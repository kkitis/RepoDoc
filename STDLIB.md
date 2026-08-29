# RepoDoc — stdlib hackathon write-up

RepoDoc is a **zero-dependency** Node.js CLI: it walks a repo, finds TODOs, and prints simple documentation/stats using **only the Node.js standard library** (no npm packages).

## Why stdlib only

- No `npm install` beyond Node itself.
- `package.json` keeps `"dependencies": {}`.
- Flags via `process.argv` (not yargs/commander).
- Tests via `node --test` (not Jest/Vitest).

## Intended pipeline (to be implemented in member modules)

1. **Scanner** — traverse directories (`node:fs` / `node:path`).
2. **Analyzer** — TODO regex and line stats.
3. **Formatter** — markdown and terminal tables.
4. **CLI** — entry point and flags.

This file is a placeholder write-up; expand it as the hackathon implementation lands.
