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

/**
 * @param {string} lmpText - Raw LMP source
 * @returns {{ type: string, tokens: string[] }[]}
 */
export function preprocess(lmpText) {
  const lines = lmpText.split(/\n/);
  const result = [];
  let trailing = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = stripComment(lines[i]);
    const trimmed = raw.trim();
    const tokens = trimmed ? trimmed.split(/\s+/) : [];

    if (isBlank(raw)) {
      trailing = true;
      continue;
    }

    if (trailing) {
      const startsLMP = /^\s*@|^\s*\d|^\s*\+|^\s*\|/.test(raw);
      if (!startsLMP) continue;
      trailing = false;
    }

    if (tokens.length === 0) continue;

    const type = classify(tokens);
    result.push({ type, tokens });
  }

  return result;
}
