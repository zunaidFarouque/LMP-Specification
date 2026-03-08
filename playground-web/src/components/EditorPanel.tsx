import { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { syntaxHighlighting } from '@codemirror/language';
import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, type DecorationSet } from '@codemirror/view';
import { useDebounce } from '../hooks/useDebounce';
import { lmpLanguage, lmpHighlight } from '../codemirror';

const SetHighlightEffect = StateEffect.define<number | null>();

const highlightLineField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(SetHighlightEffect)) {
        const lineNum = e.value;
        if (lineNum == null || lineNum < 1) return Decoration.none;
        const doc = tr.state.doc;
        if (lineNum > doc.lines) return Decoration.none;
        const line = doc.line(lineNum);
        return Decoration.set([Decoration.line({ class: 'cm-lmp-highlighted-line' }).range(line.from)]);
      }
    }
    return value;
  },
  provide: (f) => EditorView.decorations.from(f),
});

type Props = {
  value: string;
  onChange: (v: string) => void;
  onCompile: (v: string) => void;
  status: string;
  statusError: boolean;
  highlightedLine?: number | null;
};

export function EditorPanel({ value, onChange, onCompile, status, statusError, highlightedLine = null }: Props) {
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
        highlightLineField,
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
    if (!view) return;
    view.dispatch({ effects: SetHighlightEffect.of(highlightedLine ?? null) });
  }, [highlightedLine]);

  useEffect(() => {
    const view = viewRef.current;
    if (view && value !== view.state.doc.toString()) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      });
    }
  }, [value]);

  return (
    <section className="flex flex-col min-h-[300px] lg:min-h-0 flex-1 min-w-0 border-b lg:border-b-0 lg:border-r border-slate-800">
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
