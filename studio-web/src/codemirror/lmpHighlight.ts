import { HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { EditorView } from 'codemirror';

export const lmpEditorTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: '#0d1117',
      color: '#e2e8f0',
      height: '100%',
    },
    '.cm-content': {
      caretColor: '#f59e0b',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
    },
    '&.cm-focused .cm-cursor': {
      borderLeftColor: '#f59e0b',
      borderLeftWidth: '2px',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#f59e0b',
      borderLeftWidth: '2px',
    },
    '&.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(59, 130, 246, 0.35)',
    },
    '.cm-selectionBackground': {
      backgroundColor: 'rgba(59, 130, 246, 0.25) !important',
    },
  },
  { dark: true }
);

export const lmpHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: '#f59e0b', fontWeight: 'bold' }, // Directives & reserved tokens (amber)
  { tag: tags.lineComment, color: '#6b7280', fontStyle: 'italic' }, // Comments (gray)
  { tag: tags.number, color: '#38bdf8' }, // Beats & fractional durations (sky)
  { tag: tags.integer, color: '#a78bfa' }, // Velocities & GM integers (purple)
  { tag: tags.string, color: '#34d399', fontWeight: 'semibold' }, // SPN notes: C4, F#3 (emerald)
  { tag: tags.variableName, color: '#e2e8f0' }, // Identifiers, track names
  { tag: tags.operator, color: '#f97316', fontWeight: 'bold' }, // + and | operators (orange)
  { tag: tags.atom, color: '#ec4899' }, // _ placeholders (pink)
  { tag: tags.punctuation, color: '#94a3b8' }, // , = [ ]
  { tag: tags.literal, color: '#fbbf24' }, // Rule values
]);
