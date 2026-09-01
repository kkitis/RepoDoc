/**
 * Member 4 — node:test suite for the analyzer.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFile, groupByExtension } from '../src/analyzer.js';

describe('annotation extraction', () => {
  it('finds TODO, FIXME, and BUG tags', () => {
    const source = `
const ready = true;
// TODO: wire up the scanner
function broken() {
  // FIXME: handle empty input
  return null;
}
# BUG: off-by-one in the walker
`;

    const { todos } = analyzeFile('src/example.js', source);
    const kinds = todos.map((todo) => todo.text.split(':')[0]);

    assert.deepEqual(kinds, ['TODO', 'FIXME', 'BUG']);
    assert.equal(todos.length, 3);
  });

  it('captures 1-based line numbers for each annotation', () => {
    const source = `const a = 1;
// TODO: first
const b = 2;
/* FIXME: second */
const c = 3;
-- BUG: third`;

    const { todos } = analyzeFile('lib/mod.js', source);

    assert.equal(todos[0].line, 2);
    assert.equal(todos[1].line, 4);
    assert.equal(todos[2].line, 6);
    assert.equal(todos[0].file, 'lib/mod.js');
    assert.equal(todos[1].file, 'lib/mod.js');
    assert.equal(todos[2].file, 'lib/mod.js');
  });

  it('stores tag and remainder in TodoMatch.text', () => {
    const source = `// TODO: later
// FIXME: broken parser
<!-- BUG: layout shift -->`;

    const { todos } = analyzeFile('app.vue', source);

    assert.equal(todos[0].text, 'TODO: later');
    assert.equal(todos[1].text, 'FIXME: broken parser');
    assert.equal(todos[2].text, 'BUG: layout shift');
  });

  it('ignores comments that do not contain TODO, FIXME, or BUG', () => {
    const source = `
// NOTE: not an annotation
# just a heading comment
-- sql style note
/* block without a tag */
const value = 1; // ordinary inline comment
`;

    const { todos } = analyzeFile('src/plain.js', source);
    assert.deepEqual(todos, []);
  });

  it('ignores TODO-like words that are not in comments', () => {
    const source = `const message = 'TODO: not a comment';
export function FIXME() {}
`;

    const { todos } = analyzeFile('src/words.js', source);
    assert.deepEqual(todos, []);
  });

  it('accepts optional @ and optional colon on tags', () => {
    const source = `// @TODO no colon
// FIXME: with colon
`;

    const { todos } = analyzeFile('src/tags.js', source);
    assert.equal(todos.length, 2);
    assert.equal(todos[0].text, 'TODO: no colon');
    assert.equal(todos[1].text, 'FIXME: with colon');
  });
});

describe('line counting', () => {
  it('treats an empty file as zero lines', () => {
    const stats = analyzeFile('empty.js', '');

    assert.equal(stats.lines, 0);
    assert.equal(stats.blankLines, 0);
    assert.equal(stats.commentLines, 0);
    assert.equal(stats.codeLines, 0);
    assert.deepEqual(stats.todos, []);
  });

  it('counts a single line of code', () => {
    const stats = analyzeFile('one.js', 'const x = 1;');

    assert.equal(stats.lines, 1);
    assert.equal(stats.codeLines, 1);
    assert.equal(stats.blankLines, 0);
    assert.equal(stats.commentLines, 0);
  });

  it('counts a single comment line', () => {
    const stats = analyzeFile('one.js', '// TODO: only line');

    assert.equal(stats.lines, 1);
    assert.equal(stats.commentLines, 1);
    assert.equal(stats.codeLines, 0);
    assert.equal(stats.todos.length, 1);
  });

  it('counts code, comments, and blanks in a multi-line file', () => {
    const source = `const a = 1;

// TODO: fill this in
function run() {
  return a;
}
`;

    const stats = analyzeFile('multi.js', source);

    assert.equal(stats.lines, 7);
    assert.equal(stats.blankLines, 2);
    assert.equal(stats.commentLines, 1);
    assert.equal(stats.codeLines, 4);
  });

  it('counts block comments as comment lines', () => {
    const source = `const a = 1;
/*
 * helper
 */
const b = 2;`;

    const stats = analyzeFile('block.js', source);

    assert.equal(stats.lines, 5);
    assert.equal(stats.codeLines, 2);
    assert.equal(stats.commentLines, 3);
    assert.equal(stats.blankLines, 0);
  });

  it('sets path and extension on FileStats', () => {
    const stats = analyzeFile('src/app.TS', 'export {};');

    assert.equal(stats.path, 'src/app.TS');
    assert.equal(stats.extension, '.ts');
  });
});

describe('groupByExtension', () => {
  it('tallies files, lines, and codeLines per extension', () => {
    const js = analyzeFile('a.js', 'const a = 1;');
    const ts = analyzeFile('b.ts', 'const b = 1;\nconst c = 2;');
    const jsAgain = analyzeFile('c.js', '// TODO: later');

    const groups = groupByExtension([js, ts, jsAgain]);

    assert.equal(groups['.js'].files, 2);
    assert.equal(groups['.js'].lines, js.lines + jsAgain.lines);
    assert.equal(groups['.js'].codeLines, js.codeLines + jsAgain.codeLines);
    assert.equal(groups['.ts'].files, 1);
    assert.equal(groups['.ts'].lines, ts.lines);
    assert.equal(groups['.ts'].codeLines, ts.codeLines);
  });
});
