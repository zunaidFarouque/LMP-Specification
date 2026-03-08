import { HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';

/**
 * LMP-specific syntax highlighting for the dark slate theme.
 * Colors chosen for readability on slate-900 background.
 */
export const lmpHighlight = HighlightStyle.define([
  { tag: tags.lineComment, color: '#6a737d' },
  { tag: tags.keyword, color: '#7dd3fc', fontWeight: 'bold' },
  { tag: tags.number, color: '#93c5fd' },
  { tag: tags.integer, color: '#93c5fd' },
  { tag: tags.string, color: '#86efac' },
  { tag: tags.variableName, color: '#fcd34d' },
  { tag: tags.operator, color: '#7dd3fc' },
  { tag: tags.atom, color: '#94a3b8' },
  { tag: tags.punctuation, color: '#94a3b8' },
  { tag: tags.literal, color: '#a5b4fc' },
  { tag: tags.meta, color: '#94a3b8' },
  { tag: tags.invalid, color: '#f87171' },
]);
