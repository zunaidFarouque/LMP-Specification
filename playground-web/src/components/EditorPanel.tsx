import { useEffect, useRef } from 'react';
import { StateEffect, StateField } from '@codemirror/state';
import { EditorView, basicSetup } from 'codemirror';
import { Decoration, ViewPlugin } from '@codemirror/view';
import { syntaxHighlighting } from '@codemirror/language';
import { useDebounce } from '../hooks/useDebounce';
import { lmpLanguage, lmpHighlight } from '../codemirror';

const highlightLineEffect = StateEffect.define<number | null>();
const highlightLineField = StateField.define<number | null>({
  create: () => null,
  update: (val, tr) => {
    for (const e of tr.effects) if (e.is(highlightLineEffect)) return e.value;
    return val;
  },
});

const highlightLinePlugin = ViewPlugin.fromClass(
  class {
    decorations: import('@codemirror/view').DecorationSet;
    constructor(readonly view: EditorView) {
      this.decorations = this.buildDeco();
    }
    update(update: import('@codemirror/view').ViewUpdate) {
      if (update.state.field(highlightLineField) !== update.startState.field(highlightLineField)) {
        this.decorations = this.buildDeco();
      }
    }
    buildDeco() {
      const line = this.view.state.field(highlightLineField);
      if (line == null || line < 1) return Decoration.none;
      const doc = this.view.state.doc;
      if (line > doc.lines) return Decoration.none;
      const { from } = doc.line(line);
      return Decoration.set([
        Decoration.line({ class: 'cm-piano-roll-highlight' }).range(from),
      ]);
    }
  },
  { decorations: (v) => v.decorations }
);

const highlightLineExtension = [
  highlightLineField,
  highlightLinePlugin,
];

type Props = {
  value: string;
  onChange: (v: string) => void;
  onCompile: (v: string) => void;
  status: string;
  statusError: boolean;
  highlightedLine?: number | null;
};

export function EditorPanel({ value, onChange, onCompile, status, statusError, highlightedLine }: Props) {
  const debouncedValue = useDebounce(value, 200);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    onCompile(debouncedValue);
  }, [debouncedValue, onCompile]);

  useEffect(() => {
    if (!containerRef.current) return;
    const view = new EditorView({
      doc: value,
      extensions: [
        basicSetup,
        lmpLanguage,
        syntaxHighlighting(lmpHighlight),
        highlightLineExtension,
        EditorView.updateListener.of((v) => {
          if (v.docChanged) {
            onChange(v.state.doc.toString());
          }
        }),
      ],
      parent: containerRef.current,
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (view && value !== view.state.doc.toString()) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      });
    }
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (view) {
      view.dispatch({ effects: highlightLineEffect.of(highlightedLine ?? null) });
    }
  }, [highlightedLine]);

  return (
    <section className="flex flex-col min-h-[300px] lg:min-h-0 w-full border-b lg:border-b-0 lg:border-r border-slate-800">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/50">
        <label className="text-sm font-medium text-slate-400">LMP Source</label>
      </div>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div ref={containerRef} className="flex-1 min-h-[200px] overflow-auto" />
        <div
          className={`px-4 py-2 text-sm min-h-[2.5rem] border-t border-slate-800 bg-slate-900/30 ${
            statusError ? 'text-red-400' : status ? 'text-emerald-400' : ''
          }`}
        >
          {status}
        </div>
      </div>
    </section>
  );
}
