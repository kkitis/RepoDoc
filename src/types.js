/**
 * Shared data contracts (JSDoc). Not owned by a single member.
 * Keep scanner, analyzer, formatter, and CLI aligned to these shapes.
 */

/**
 * @typedef {object} TodoMatch
 * @property {string} file
 * @property {number} line
 * @property {string} text
 */

/**
 * @typedef {object} FileStats
 * @property {string} path
 * @property {number} lines
 * @property {TodoMatch[]} todos
 */

/**
 * @typedef {object} ScanResult
 * @property {string} root
 * @property {FileStats[]} files
 */

export {};
