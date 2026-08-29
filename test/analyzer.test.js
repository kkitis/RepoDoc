/**
 * Member 4 — node:test suite for the analyzer (placeholder).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFile } from '../src/analyzer.js';

describe('analyzeFile', () => {
  it('returns a FileStats-shaped stub', () => {
    const stats = analyzeFile('example.js', '// TODO: later');
    assert.equal(stats.path, 'example.js');
    assert.equal(stats.lines, 0);
    assert.deepEqual(stats.todos, []);
  });

  it.skip('matches TODO comments (not implemented)', () => {
    const stats = analyzeFile('example.js', '// TODO: later');
    assert.ok(stats.todos.length > 0);
  });
});
