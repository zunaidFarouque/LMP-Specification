/**
 * LMP Pass 1: Preprocess.
 * Strip // comments, handle blank lines and trailing mode, split on /\s+/.
 * Returns list of { type, tokens } for each LMP-relevant line.
 */

function isBlank(line) {
  return line.trim() === '';
}

function stripComment(line) {
  const i = line.indexOf('//');
  return i === -1 ? line : line.slice(0, i);
}

function classify(tokens) {
  if (!tokens.length) return 'blank';
  const first = tokens[0];
  if (first.startsWith('@')) return 'header';
  if (first === '+') return 'continuation';
  if (first === '|') return 'modifier';
  return 'event';
}

const MARKDOWN_LIST_PREFIX_REGEX = /^\s*\d+[\.)](?!\d)/;

/**
 * @param {string} lmpText - Raw LMP source
 * @returns {{ type: string, tokens: string[], sourceLine: number, sourceCol: number, blankBefore: boolean }[]}
 */
export function preprocess(lmpText) {
  const lines = lmpText.split(/\r?\n/);
  const result = [];
  let trailing = false;
  let hadBlank = false;
  const hasDirectives = /^@[A-Za-z]/im.test(lmpText);
  let seenDirective = !hasDirectives;
  const hasCodeFences = /^(`{3,}|~{3,})/m.test(lmpText);
  let inCodeFence = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const isPureBlank = rawLine.trim() === '';

    if (isPureBlank) {
      trailing = true;
      hadBlank = true;
      continue;
    }

    const raw = stripComment(rawLine);
    const trimmed = raw.trim();

    // Comment-only lines do not end continuations or modifiers per spec
    if (!trimmed) {
      continue;
    }

    // Filter out markdown code block delimiters (```lmp, ```, ~~~lmp, ~~~)
    if (/^(`{3,}|~{3,})/.test(trimmed)) {
      inCodeFence = !inCodeFence;
      trailing = true;
      hadBlank = true;
      continue;
    }

    // If document has code fences, ignore all conversational prose outside fences
    if (hasCodeFences && !inCodeFence) {
      continue;
    }

    // Skip conversational preamble lines before the first directive
    if (!seenDirective) {
      if (trimmed.startsWith('@')) {
        seenDirective = true;
      } else {
        continue;
      }
    }

    if (trailing) {
      // Filter out markdown numbered list prefixes (e.g. "1. ", "2) ") to stop phantom note injection
      if (MARKDOWN_LIST_PREFIX_REGEX.test(raw)) {
        continue;
      }
      const startsLMP = /^\s*(@|\d|\+|\|)/.test(raw);
      if (!startsLMP) continue;
      trailing = false;
    }

    // Allow natural spaces after commas in chords for event and continuation lines
    let lineToTokenize = trimmed;
    if (!trimmed.startsWith('|')) {
      lineToTokenize = trimmed.replace(/\s*,\s*/g, ',');
    }

    const tokens = lineToTokenize.split(/\s+/);
    if (tokens.length === 0) continue;

    const type = classify(tokens);
    const colMatch = rawLine.match(/^\s*/);
    const sourceCol = (colMatch ? colMatch[0].length : 0) + 1;

    result.push({
      type,
      tokens,
      sourceLine: i + 1,
      sourceCol,
      blankBefore: hadBlank,
    });
    hadBlank = false;
  }

  return result;
}

