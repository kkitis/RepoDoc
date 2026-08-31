/**
 * Member 4 — Markdown / terminal tables.
 * Format scan/analysis results for stdout or markdown.
 *
 * @param {import('./types.js').ScanResult} result
 * @param {{ format?: 'markdown' | 'terminal' }} [options]
 * @returns {string}
 */
export function formatReport(result, options = {}) {
  const format = options.format ?? 'terminal';

  if (!result || !Array.isArray(result.files)) {
    return 'No scan results available.';
  }

  const files = result.files;
  const root = result.root ?? options.root ?? process.cwd();

  if (format === 'markdown') {
    const lines = [
      `# Codebase Report`,
      ``,
      `**Root:** ${root}`,
      ``,
      `## File Statistics`,
      ``,
      `| File | Lines | TODOs |`,
      `| --- | ---: | ---: |`
    ];

    for (const file of files) {
      lines.push(
        `| ${file.path} | ${file.lines} | ${file.todos.length} |`
      );
    }

    lines.push('', '## TODOs / FIXMEs / BUGs', '');

    if (files.every(file => file.todos.length === 0)) {
      lines.push('No TODOs, FIXMEs, or BUGs found.');
    } else {
      lines.push(
        '| File | Line | Text |',
        '| --- | ---: | --- |'
      );

      for (const file of files) {
        for (const todo of file.todos) {
          lines.push(
            `| ${todo.file} | ${todo.line} | ${todo.text} |`
          );
        }
      }
    }

    return lines.join('\n');
  }

  // Terminal format
  const output = [
    'CODEBASE REPORT',
    `Root: ${root}`,
    '',
    'FILE STATISTICS',
    '----------------'
  ];

  if (files.length === 0) {
    output.push('No files found.');
  } else {
    for (const file of files) {
      output.push(
        `${file.path} | ${file.lines} lines | ${file.todos.length} annotations`
      );
    }
  }

  output.push('', 'TODOs / FIXMEs / BUGs', '-------------------');

  const todos = files.flatMap(file => file.todos);

  if (todos.length === 0) {
    output.push('No TODOs, FIXMEs, or BUGs found.');
  } else {
    for (const todo of todos) {
      output.push(`${todo.file}:${todo.line} - ${todo.text}`);
    }
  }

  return output.join('\n');
}
