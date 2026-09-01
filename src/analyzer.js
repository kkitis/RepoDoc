import path from 'node:path';

function extractAnnotations(filePath, source) {
  const annotations = [];
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

  return annotations;
}

function countLines(source) {
  if (!source) {
    return {
      lines: 0,
      blankLines: 0,
      commentLines: 0,
      codeLines: 0
    };
  }

  const lines = source.split(/\r?\n/);
  let blankLines = 0;
  let commentLines = 0;
  let codeLines = 0;
  let insideBlockComment = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      blankLines++;
      continue;
    }

    if (insideBlockComment) {
      commentLines++;

      if (line.includes('*/') || line.includes('-->')) {
        insideBlockComment = false;
      }

      continue;
    }

    if (line.startsWith('/*') || line.startsWith('<!--')) {
      commentLines++;

      const closingTag = line.startsWith('<!--') ? '-->' : '*/';

      if (!line.includes(closingTag)) {
        insideBlockComment = true;
      }

      continue;
    }

    if (
      line.startsWith('//') ||
      line.startsWith('#') ||
      line.startsWith('--')
    ) {
      commentLines++;
      continue;
    }

    codeLines++;
  }

  return {
    lines: lines.length,
    blankLines,
    commentLines,
    codeLines
  };
}

function getExtension(filePath) {
  if (typeof filePath !== 'string' || !filePath) {
    return '';
  }

  return path.extname(filePath).toLowerCase();
}

export function analyzeFile(filePath, source = '') {
  if (typeof source !== 'string') {
    source = '';
  }

  const stats = countLines(source);

  return {
    path: filePath,
    lines: stats.lines,
    todos: extractAnnotations(filePath, source),
    extension: getExtension(filePath),
    blankLines: stats.blankLines,
    commentLines: stats.commentLines,
    codeLines: stats.codeLines
  };
}

export function groupByExtension(files) {
  const groups = {};

  for (const file of files) {
    const extension = file.extension || '[no extension]';

    if (!groups[extension]) {
      groups[extension] = {
        files: 0,
        lines: 0,
        codeLines: 0
      };
    }

    groups[extension].files++;
    groups[extension].lines += file.lines;
    groups[extension].codeLines += file.codeLines;
  }

  return groups;
}
