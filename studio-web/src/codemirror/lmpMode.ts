import {
  StreamLanguage,
  type StreamParser,
  type StringStream,
} from '@codemirror/language';
import { tags } from '@lezer/highlight';

interface LMPState {}

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
  if (stream.sol()) {
    stream.eatSpace();
    if (stream.eat('+')) return 'operator';
    if (stream.eat('|')) return 'operator';
    if (stream.match(RE_REPEATING_RANGE)) return 'number';
    if (stream.match(RE_BEAT)) return 'number';
  }

  if (stream.match(/^\/\/.*/, false)) {
    stream.match(/^\/\/.*/);
    return 'lineComment';
  }

  if (stream.eat('@')) {
    stream.eatWhile(/[A-Za-z_]/);
    return 'keyword';
  }

  if (stream.eat('_')) return 'atom';

  if (stream.match(RE_RESERVED_PITCH, false)) {
    stream.match(RE_RESERVED_PITCH);
    return 'keyword';
  }

  if (stream.match(RE_SPN_PITCH, false)) {
    stream.match(RE_SPN_PITCH);
    return 'string';
  }

  if (stream.eat(',')) return 'punctuation';
  if (stream.eat('=')) return 'punctuation';
  if (stream.eat('[')) return 'punctuation';
  if (stream.eat(']')) return 'punctuation';
  if (stream.eat('-') && !stream.match(RE_FLOAT, false)) return 'punctuation';
  if (stream.eat(':') && !stream.match(RE_FLOAT, false)) return 'punctuation';
  if (stream.eat('/') && !stream.match(/\d/, false)) return 'punctuation';

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

  if (stream.match(RE_FLOAT, false)) {
    const m = stream.match(RE_FLOAT);
    const s = Array.isArray(m) ? m[0] : '';
    return s.includes('.') ? 'number' : 'integer';
  }

  if (stream.match(RE_IDENT, false)) {
    stream.match(RE_IDENT);
    return 'variableName';
  }

  if (stream.eatSpace()) return null;

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
