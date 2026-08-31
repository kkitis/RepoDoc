/**
 * End-to-end CLI tests: spawn `src/cli.js` as a child process.
 * The CLI takes a positional directory and `-o, --output <file>` (not `--dir`).
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { exec } from 'node:child_process';
import path from 'node:path';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';

const repoRoot = process.cwd();
const fixtureDir = path.join(repoRoot, 'test', 'fixtures', 'e2e-dummy');
const overviewPath = path.join(repoRoot, 'CODEBASE_OVERVIEW.md');
const cliPath = path.join('src', 'cli.js');

function runCli(argString) {
  const command = `node ${cliPath} ${argString}`;

  return new Promise((resolve) => {
    exec(command, { cwd: repoRoot }, (error, stdout, stderr) => {
      resolve({
        code: error && error.code != null ? error.code : 0,
        stdout: stdout ?? '',
        stderr: stderr ?? ''
      });
    });
  });
}

describe('RepoDoc CLI e2e', () => {
  before(async () => {
    await mkdir(fixtureDir, { recursive: true });
    await writeFile(
      path.join(fixtureDir, 'app.js'),
      '// TODO: test this\n',
      'utf8'
    );
    await writeFile(
      path.join(fixtureDir, 'data.json'),
      JSON.stringify({ ok: true }, null, 2),
      'utf8'
    );
  });

  after(async () => {
    await rm(fixtureDir, { recursive: true, force: true });
    await rm(overviewPath, { force: true });
  });

  it('prints TODO and app.js on stdout with exit code 0', async () => {
    const result = await runCli('./test/fixtures/e2e-dummy');

    assert.equal(result.code, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /TODO/);
    assert.match(result.stdout, /app\.js/);
  });

  it('writes CODEBASE_OVERVIEW.md with --output and exit code 0', async () => {
    const result = await runCli(
      `./test/fixtures/e2e-dummy --output ${JSON.stringify(overviewPath)}`
    );

    assert.equal(result.code, 0, result.stderr || result.stdout);

    const markdown = await readFile(overviewPath, 'utf8');
    assert.match(markdown, /app\.js/);
    assert.match(markdown, /TODO/);
    assert.match(markdown, /\*\*Root:\*\* /);
    assert.doesNotMatch(markdown, /\*\*Root:\*\* undefined/);
  });
});
