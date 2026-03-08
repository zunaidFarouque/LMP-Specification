import { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { useDebounce } from '../hooks/useDebounce';

type Props = {
  value: string;
  onChange: (v: string) => void;
  onCompile: (v: string) => void;
  status: string;
  statusError: boolean;
};

export function EditorPanel({ value, onChange, onCompile, status, statusError }: Props) {
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

  return (
    <section className="flex flex-col min-h-[300px] lg:min-h-0 lg:w-1/2 border-b lg:border-b-0 lg:border-r border-slate-800">
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
