/**
 * Member 1 — Directory traversal.
 * Walk a tree with Node stdlib (`node:fs/promises`, `node:path`) and collect file paths.
 * Paths only — file contents are read one-at-a-time by the CLI.
 *
 * @param {string} rootDir
 * @param {{ ignore?: string[] }} [options]
 * @returns {Promise<string[]>}
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_IGNORE = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'vendor',
  'lib',
  'coverage'
];

const TEXT_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.jsx',
  '.html',
  '.htm',
  '.css',
  '.json',
  '.md',
  '.txt'
]);

function shouldIgnore(fullPath, rootDir, patterns) {
  const relative = path.relative(rootDir, fullPath);
  const base = path.basename(fullPath);
  return patterns.some(
    (pattern) => base === pattern || relative.includes(pattern)
  );
}

async function walk(dir, rootDir, patterns, files) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (
      error.code === 'EACCES' ||
      error.code === 'ENOENT' ||
      error.code === 'EPERM'
    ) {
      return;
    }
    throw error;
  }

  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (shouldIgnore(fullPath, rootDir, patterns)) {
      continue;
    }

    if (entry.isDirectory()) {
      await walk(fullPath, rootDir, patterns, files);
    } else if (entry.isFile()) {
      const extension = path.extname(entry.name).toLowerCase();
      if (!TEXT_EXTENSIONS.has(extension)) {
        continue;
      }
      files.push(fullPath);
    }
  }
}

export async function scanDirectory(rootDir, { ignore = [] } = {}) {
  const resolved = path.resolve(rootDir);
  const patterns = [...new Set([...DEFAULT_IGNORE, ...ignore])];
  const files = [];
  await walk(resolved, resolved, patterns, files);
  return files;
}
