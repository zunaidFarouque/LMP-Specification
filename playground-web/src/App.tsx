import { useState, useCallback } from 'react';
import { Header } from './components/Header';
import { EditorPanel } from './components/EditorPanel';
import { PreviewPanel } from './components/PreviewPanel';
import { ResizableSplit } from './components/ResizableSplit';
import { LibraryLoader } from './components/LibraryLoader';
import { useLmpCore } from './hooks/useLmpCore';
import { EXAMPLES } from './constants/examples';

function App() {
  const { isReady, compile, decompile, parseMidi, onLibraryLoaded } = useLmpCore();
  const [lmpText, setLmpText] = useState<string>(EXAMPLES.chords);
  const [midi, setMidi] = useState<Uint8Array | null>(null);
  const [sourceMap, setSourceMap] = useState<Map<string, number> | null>(null);
  const [status, setStatus] = useState('');
  const [statusError, setStatusError] = useState(false);
  const [drumMap, setDrumMap] = useState<{ noteToName: Map<number, string>; displayOrder: number[] } | null>(null);
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);

  const handleCompile = useCallback(
    (text: string) => {
      if (!compile) return;
      const t = text.trim();
      if (!t) {
        setMidi(null);
        setSourceMap(null);
        setStatus('');
        return;
      }
      try {
        const result = compile(t, { sourceMap: true });
        if (result && typeof result === 'object' && 'midi' in result) {
          const { midi: m, sourceMap: sm } = result;
          setMidi(m);
          setSourceMap(sm ?? null);
          setStatus(m ? `Compiled: ${m.length} bytes` : '');
        } else {
          setMidi(result as Uint8Array);
          setSourceMap(null);
          setStatus(result ? `Compiled: ${(result as Uint8Array).length} bytes` : '');
        }
        setStatusError(false);
      } catch (err) {
        setStatus((err as Error).message || String(err));
        setStatusError(true);
        setMidi(null);
        setSourceMap(null);
      }
    },
    [compile]
  );

  const handleDecompile = useCallback(
    (buf: Uint8Array) => {
      if (!decompile) return;
      try {
        const lmp = decompile(buf);
        setLmpText(lmp);
        setStatus('Decompiled to LMP');
        setStatusError(false);
        handleCompile(lmp);
      } catch (err) {
        setStatus('Decompile error: ' + ((err as Error).message || String(err)));
        setStatusError(true);
      }
    },
    [decompile, handleCompile]
  );

  const handleDownload = useCallback(() => {
    if (!midi) return;
    const blob = new Blob([new Uint8Array(midi)], { type: 'audio/midi' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'output.mid';
    a.click();
    URL.revokeObjectURL(a.href);
  }, [midi]);

  if (!isReady) {
    return <LibraryLoader onLoaded={onLibraryLoaded} />;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        onExampleSelect={(lmp) => {
          setLmpText(lmp);
          handleCompile(lmp);
        }}
        onDownload={handleDownload}
        canDownload={!!midi}
      />
      <main className="flex-1 flex flex-col lg:flex-row min-h-0">
        <ResizableSplit
          left={
            <EditorPanel
              value={lmpText}
              onChange={(v) => setLmpText(v)}
              onCompile={handleCompile}
              status={status}
              statusError={statusError}
              highlightedLine={highlightedLine}
            />
          }
          right={
            <PreviewPanel
              midi={midi}
              sourceMap={sourceMap}
              drumMap={drumMap}
              onDrumMapChange={setDrumMap}
              onDecompile={handleDecompile}
              parseMidi={parseMidi}
              onNoteHover={setHighlightedLine}
              lmpText={lmpText}
            />
          }
        />
      </main>
    </div>
  );
}

export default App;
