import {
  StreamLanguage,
  type StreamParser,
  type StringStream,
} from '@codemirror/language';
import { tags } from '@lezer/highlight';

interface LMPState {
  // Minimal state; context inferred from line position
}

const RE_REPEATING_RANGE = /^\d+\.?\d*-\d+\.?\d*:\d+(\/\d+)?/;
const RE_BEAT = /^\d+\.?\d*/;
const RE_RESERVED_PITCH = /^(R|CC|PB|TEMPO|TS)\b/i;
const RE_SPN_PITCH = /^[A-G][#b]?\d/;
const RE_FLOAT = /^\d+\.?\d*/;
const RE_IDENT = /^[A-Za-z_][A-Za-z0-9_]*/;
const RE_RULE_VEL = /^VEL=\d+-\d+/;
const RE_RULE_DUR = /^DUR=\d+\.?\d*/;
const RE_RULE_LEGATO = /^LEGATO=(TRUE|FALSE)/i;

function token(stream: StringStream, _state: LMPState): string | null {
  // 1. Line-start tokens (after optional whitespace)
  if (stream.sol()) {
    stream.eatSpace();
    if (stream.eat('+')) return 'operator';
    if (stream.eat('|')) return 'operator';
    if (stream.match(RE_REPEATING_RANGE)) return 'number';
    if (stream.match(RE_BEAT)) return 'number';
  }

  // 2. Comment (entire rest of line)
  if (stream.match(/^\/\/.*/, false)) {
    stream.match(/^\/\/.*/);
    return 'lineComment';
  }

  // 3. Directive: @Name
  if (stream.eat('@')) {
    stream.eatWhile(/[A-Za-z_]/);
    return 'keyword';
  }

  // 4. Placeholder
  if (stream.eat('_')) return 'atom';

  // 5. Reserved pitch tokens (R, CC, PB, TEMPO, TS)
  if (stream.match(RE_RESERVED_PITCH, false)) {
    stream.match(RE_RESERVED_PITCH);
    return 'keyword';
  }

  // 6. SPN pitch (C4, F#3, Bb2) - also handles chord parts
  if (stream.match(RE_SPN_PITCH, false)) {
    stream.match(RE_SPN_PITCH);
    return 'string';
  }

  // 7. Punctuation (comma, equals, brackets)
  if (stream.eat(',')) return 'punctuation';
  if (stream.eat('=')) return 'punctuation';
  if (stream.eat('[')) return 'punctuation';
  if (stream.eat(']')) return 'punctuation';
  if (stream.eat('-') && !stream.match(RE_FLOAT, false)) return 'punctuation';
  if (stream.eat(':') && !stream.match(RE_FLOAT, false)) return 'punctuation';
  if (stream.eat('/') && !stream.match(/\d/, false)) return 'punctuation';

  // 8. Rule values: VEL=70-80, DUR=1.0, LEGATO=TRUE
  if (stream.match(RE_RULE_VEL, false)) {
    stream.match(RE_RULE_VEL);
    return 'literal';
  }
  if (stream.match(RE_RULE_DUR, false)) {
    stream.match(RE_RULE_DUR);
    return 'literal';
  }
  if (stream.match(RE_RULE_LEGATO, false)) {
    stream.match(RE_RULE_LEGATO);
    return 'literal';
  }

  // 9. Numbers (velocity, GM pitch, duration, beat in modifier args)
  if (stream.match(RE_FLOAT, false)) {
    const m = stream.match(RE_FLOAT);
    const s = Array.isArray(m) ? m[0] : '';
    return s.includes('.') ? 'number' : 'integer';
  }

  // 10. Identifier (map name, track name, directive arg)
  if (stream.match(RE_IDENT, false)) {
    stream.match(RE_IDENT);
    return 'variableName';
  }

  // 11. Whitespace - skip
  if (stream.eatSpace()) return null;

  // 12. Unknown - advance to avoid infinite loop
  stream.next();
  return null;
}

const lmpParser: StreamParser<LMPState> = {
  name: 'lmp',
  token,
  startState: () => ({}),
  tokenTable: {
    keyword: tags.keyword,
    lineComment: tags.lineComment,
    number: tags.number,
    integer: tags.integer,
    string: tags.string,
    variableName: tags.variableName,
    operator: tags.operator,
    atom: tags.atom,
    punctuation: tags.punctuation,
    literal: tags.literal,
  },
};

export const lmpLanguage = StreamLanguage.define(lmpParser);
