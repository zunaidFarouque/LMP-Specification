import { useState, useCallback, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { EditorPanel } from './components/EditorPanel';
import { PreviewPanel } from './components/PreviewPanel';
import { LibraryLoader } from './components/LibraryLoader';
import { AiComposerDrawer } from './components/AiComposerDrawer';
import { useLmpCore } from './hooks/useLmpCore';
import type { SourceMap } from './hooks/useLmpCore';
import { EXAMPLES } from './constants/examples';
import { audioEngine, type TransportState } from './utils/audioEngine';

function App() {
  const { isReady, compile, decompile, onLibraryLoaded } = useLmpCore();
  const [lmpText, setLmpText] = useState<string>(EXAMPLES.chords);
  const [midi, setMidi] = useState<Uint8Array | null>(null);
  const [sourceMap, setSourceMap] = useState<SourceMap | null>(null);
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);
  const [status, setStatus] = useState('');
  const [statusError, setStatusError] = useState(false);
  const [isAiComposerOpen, setIsAiComposerOpen] = useState(false);
  const [leftPanelPercent, setLeftPanelPercent] = useState(50);
  const [transport, setTransport] = useState<TransportState>({
    state: 'stopped',
    currentBeat: 1.0,
    totalBeats: 4.0,
    bpm: 120,
    tempoMultiplier: 1.0,
    isLooping: false,
  });
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const unsub = audioEngine.subscribe((st) => setTransport(st));
    return unsub;
  }, []);

  useEffect(() => {
    audioEngine.loadMidi(midi);
  }, [midi]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    const main = mainRef.current;
    if (!main) return;
    const rect = main.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setLeftPanelPercent(Math.min(80, Math.max(20, pct)));
  }, []);

  const handleResizeStart = useCallback(() => {
    const onUp = () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', onUp);
  }, [handleResizeMove]);

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
          const { midi: bytes, sourceMap: sm } = result as { midi: Uint8Array; sourceMap?: SourceMap };
          setMidi(bytes ?? null);
          setSourceMap(sm ?? null);
          setStatus(bytes ? `Compiled: ${bytes.length} bytes` : '');
        } else {
          const bytes = result as Uint8Array | null;
          setMidi(bytes ?? null);
          setSourceMap(null);
          setStatus(bytes ? `Compiled: ${bytes.length} bytes` : '');
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

  const handleValidateLmp = useCallback(
    (text: string) => {
      if (!compile) return { success: false, error: 'Compiler not ready' };
      try {
        const res = compile(text.trim());
        if (res && typeof res === 'object' && 'midi' in res) {
          const bytes = (res as { midi: Uint8Array }).midi;
          return { success: true, bytes: bytes?.length || 0 };
        }
        if (res instanceof Uint8Array) {
          return { success: true, bytes: res.length };
        }
        return { success: false, error: 'No MIDI generated' };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
    [compile]
  );

  const handleApplyLmp = useCallback(
    (code: string, autoPlay: boolean = false) => {
      setLmpText(code);
      handleCompile(code);
      if (autoPlay) {
        setTimeout(() => {
          audioEngine.play();
        }, 150);
      }
    },
    [handleCompile]
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
        playbackState={transport.state}
        onPlay={() => audioEngine.play()}
        onPause={() => audioEngine.pause()}
        onStop={() => audioEngine.stop()}
        isLooping={transport.isLooping}
        onToggleLoop={() => audioEngine.setLoop(!transport.isLooping)}
        tempoMultiplier={transport.tempoMultiplier}
        onTempoMultiplierChange={(m) => audioEngine.setTempoMultiplier(m)}
        currentBpm={transport.bpm}
        canPlay={!!midi && midi.length > 0}
        onOpenAiComposer={() => setIsAiComposerOpen(true)}
      />
      <main ref={mainRef} className="flex-1 flex flex-row min-h-0 min-w-0 relative">
        <div className="flex flex-col min-h-0 shrink-0" style={{ width: `${leftPanelPercent}%` }}>
          <EditorPanel
            value={lmpText}
            onChange={(v) => setLmpText(v)}
            onCompile={handleCompile}
            status={status}
            statusError={statusError}
            highlightedLine={highlightedLine}
          />
        </div>
        <div
          role="separator"
          aria-label="Resize panels"
          onMouseDown={handleResizeStart}
          className="w-1 shrink-0 bg-slate-700 hover:bg-slate-500 cursor-col-resize active:bg-slate-400 transition-colors"
        />
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <PreviewPanel
            midi={midi}
            sourceMap={sourceMap}
            onDecompiledLmp={(text) => {
              setLmpText(text);
              handleCompile(text);
            }}
            decompile={decompile}
            lmpText={lmpText}
            onHighlightLine={setHighlightedLine}
            currentBeat={transport.currentBeat}
            isPlaying={transport.state === 'playing'}
          />
        </div>
      </main>

      {/* AI Music Composer Drawer */}
      <AiComposerDrawer
        isOpen={isAiComposerOpen}
        onClose={() => setIsAiComposerOpen(false)}
        currentLmp={lmpText}
        onApplyLmp={handleApplyLmp}
        onCompileValidation={handleValidateLmp}
      />
    </div>
  );
}

export default App;
