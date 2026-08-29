#!/usr/bin/env node
/**
 * Member 3 — Entry point & flags.
 * Parse `process.argv` with Node stdlib only (no yargs/commander).
 * Stub only; implementation TBD.
 */

function parseFlags(argv) {
  const flags = { _: [] };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      flags[key] = value === undefined ? true : value;
    } else {
      flags._.push(arg);
    }
  }
  return flags;
}

export function main(argv = process.argv) {
  const flags = parseFlags(argv);
  void flags;
}

const isDirectRun =
  Boolean(process.argv[1]) &&
  process.argv[1].replace(/\\/g, '/').endsWith('/src/cli.js');

if (isDirectRun) {
  main();
}
