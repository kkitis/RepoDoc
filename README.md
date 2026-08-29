# RepoDoc

zero-dependency Node.js CLI tool

Placeholder scaffolding for a repo documentation / TODO scanner. Modules are stubs only; behavior is not implemented yet.

## Layout

```
.cursorrules
STDLIB.md
README.md
package.json
src/cli.js          # entry point & flags
src/scanner.js      # directory traversal
src/analyzer.js     # TODO regex & line stats
src/formatter.js    # markdown / terminal tables
src/types.js        # shared JSDoc contracts
test/analyzer.test.js
```

## Run

```bash
node src/cli.js
npm test
```

`npm test` runs `node --test`. No third-party npm dependencies (`"dependencies": {}`).
