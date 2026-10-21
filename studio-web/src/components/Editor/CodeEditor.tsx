import { useEffect, useRef } from 'react';
import { basicSetup } from 'codemirror';
import { syntaxHighlighting } from '@codemirror/language';
import { StateEffect, StateField } from '@codemirror/state';
import { EditorView, Decoration, type DecorationSet } from '@codemirror/view';
import { linter, lintGutter } from '@codemirror/lint';
import { lmpLanguage, lmpHighlight, lmpEditorTheme } from '../../codemirror';
import { lintLmpDocument } from '../../core/linter';

const SetHighlightLineEffect = StateEffect.define<number | null>();
const SetHoverLineEffect = StateEffect.define<number | null>();
const SetHoverTokenEffect = StateEffect.define<{ line: number; pitch: string } | null>();

// Selected line highlight decoration
const highlightLineField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(SetHighlightLineEffect)) {
        const lineNum = e.value;
        if (lineNum == null || lineNum < 1) return Decoration.none;
        const doc = tr.state.doc;
        if (lineNum > doc.lines) return Decoration.none;
        const line = doc.line(lineNum);
        return Decoration.set([
          Decoration.line({ class: 'cm-selected-line-highlight' }).range(line.from),
        ]);
      }
    }
    return value;
  },
  provide: (f) => EditorView.decorations.from(f),
});

// Hovered line highlight decoration (bidirectional sync with PianoRoll)
const hoverLineField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(SetHoverLineEffect)) {
        const lineNum = e.value;
        if (lineNum == null || lineNum < 1) return Decoration.none;
        const doc = tr.state.doc;
        if (lineNum > doc.lines) return Decoration.none;
        const line = doc.line(lineNum);
        return Decoration.set([
          Decoration.line({ class: 'cm-hovered-line-highlight' }).range(line.from),
        ]);
      }
    }
    return value;
  },
  provide: (f) => EditorView.decorations.from(f),
});

// Exact pitch token decoration (badge / background highlight when hovering specific note)
const hoverTokenField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(SetHoverTokenEffect)) {
        const info = e.value;
        if (!info || !info.line || !info.pitch || info.line < 1) return Decoration.none;
        const doc = tr.state.doc;
        if (info.line > doc.lines) return Decoration.none;
        const line = doc.line(info.line);
        const lineText = line.text;

        // Escape regex special chars
        const escaped = info.pitch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(^|[\\s,])(${escaped})([\\s,]|$)`, 'i');
        const match = regex.exec(lineText);

        if (match && match.index !== undefined) {
          const prefixLen = match[1].length;
          const from = line.from + match.index + prefixLen;
          const to = from + match[2].length;
          return Decoration.set([
            Decoration.mark({ class: 'cm-hovered-token-highlight' }).range(from, to),
          ]);
        }
        return Decoration.none;
      }
    }
    return value;
  },
  provide: (f) => EditorView.decorations.from(f),
});

interface Props {
  value: string;
  onChange: (val: string) => void;
  selectedLine: number | null;
  hoveredLine?: number | null;
  hoveredPitch?: string | null;
  scrollLock: boolean;
  onCursorLineChange?: (line: number) => void;
  onHoverLine?: (line: number | null) => void;
  statusText?: string;
  hasError?: boolean;
}

export function CodeEditor({
  value,
  onChange,
  selectedLine,
  hoveredLine = null,
  hoveredPitch = null,
  scrollLock,
  onCursorLineChange,
  onHoverLine,
  statusText,
  hasError,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const onCursorLineChangeRef = useRef(onCursorLineChange);
  onCursorLineChangeRef.current = onCursorLineChange;

  const onHoverLineRef = useRef(onHoverLine);
  onHoverLineRef.current = onHoverLine;

  // Initialize CodeMirror instance with Linter, Syntax Highlights, and Hover Handlers
  useEffect(() => {
    if (!containerRef.current) return;

    const view = new EditorView({
      doc: value,
      extensions: [
        basicSetup,
        lmpEditorTheme,
        lmpLanguage,
        syntaxHighlighting(lmpHighlight),
        highlightLineField,
        hoverLineField,
        hoverTokenField,
        lintGutter(),
        linter((v) => {
          const docStr = v.state.doc.toString();
          const diagnostics = lintLmpDocument(docStr);
          const maxLen = v.state.doc.length;

          return diagnostics.map((d) => ({
            from: Math.min(Math.max(0, d.from), maxLen),
            to: Math.min(Math.max(0, d.to), maxLen),
            severity: d.severity,
            message: d.message,
          }));
        }),
        EditorView.domEventHandlers({
          mousemove: (event, v) => {
            const pos = v.posAtCoords({ x: event.clientX, y: event.clientY });
            if (pos !== null) {
              const line = v.state.doc.lineAt(pos).number;
              onHoverLineRef.current?.(line);
            } else {
              onHoverLineRef.current?.(null);
            }
          },
          mouseleave: () => {
            onHoverLineRef.current?.(null);
          },
        }),
        EditorView.updateListener.of((v) => {
          if (v.docChanged) {
            onChangeRef.current?.(v.state.doc.toString());
          }
          if (v.selectionSet && onCursorLineChangeRef.current) {
            const head = v.state.selection.main.head;
            const line = v.state.doc.lineAt(head).number;
            onCursorLineChangeRef.current(line);
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

  // Update text from outside if changed
  useEffect(() => {
    const view = viewRef.current;
    if (view && value !== view.state.doc.toString()) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      });
    }
  }, [value]);

  // Sync line selection highlight and smart scroll lock
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: SetHighlightLineEffect.of(selectedLine),
    });

    if (scrollLock && selectedLine !== null && selectedLine >= 1) {
      const doc = view.state.doc;
      if (selectedLine <= doc.lines) {
        const line = doc.line(selectedLine);
        view.dispatch({
          effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
        });
      }
    }
  }, [selectedLine, scrollLock]);

  // Sync line & token hover highlight from PianoRoll preview
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: [
        SetHoverLineEffect.of(hoveredLine ?? null),
        SetHoverTokenEffect.of(
          hoveredLine && hoveredPitch ? { line: hoveredLine, pitch: hoveredPitch } : null
        ),
      ],
    });
  }, [hoveredLine, hoveredPitch]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d1117] border-l border-[#1e2738] min-w-0 select-text">
      {/* Editor Header Bar */}
      <div className="h-7 bg-[#131926] border-b border-[#1e2738] flex items-center justify-between px-3 text-xs select-none">
        <span className="font-semibold text-slate-300 flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${hasError ? 'bg-red-500 animate-pulse' : 'bg-emerald-400'}`} />
          LMP Document
        </span>
        <span className="text-[10px] font-mono text-slate-400">
          {value.split('\n').length} lines
        </span>
      </div>

      {/* Editor Scroller */}
      <div ref={containerRef} className="flex-1 overflow-hidden" />

      {/* Status Bar */}
      {statusText && (
        <div
          className={`h-6 px-3 flex items-center text-[11px] font-mono border-t border-[#1e2738] truncate ${
            hasError ? 'bg-red-950/80 text-red-300 font-semibold' : 'bg-[#101520] text-emerald-400'
          }`}
          title={statusText}
        >
          {statusText}
        </div>
      )}
    </div>
  );
}
