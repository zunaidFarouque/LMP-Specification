import { useState, useEffect, useCallback } from 'react';
import { compile } from 'lmp-core';
import { TransportBar } from './components/Transport/TransportBar';
import { TrackMixer } from './components/Arranger/TrackMixer';
import { PianoRoll } from './components/PianoRoll/PianoRoll';
import { CodeEditor } from './components/Editor/CodeEditor';
import { AiMusicalFriend } from './components/AiCopilot/AiMusicalFriend';
import { DockableWorkspace } from './components/Layout/DockableWorkspace';
import { studioAudioEngine } from './core/audioEngine';
import {
  parseLmpDocument,
  patchNote,
  insertNote,
  deleteNote,
  patchTrackHeader,
  createNewTrackBlock,
  extractTrackDrumMaps,
  patchTrackDrumMap,
  spnToMidi,
} from './core/sourceMapBridge';
import type {
  StudioTrack,
  StudioNote,
  ToolMode,
  SnapResolution,
  TransportState,
} from './core/types';

const INITIAL_LMP_CODE = `@LMP 2.0
@BPM 118
@TIMESIG 4/4
@ORIGIN 1

@TRACK 1 Rhodes_Chords
@CHANNEL 1
@PROGRAM 4
1.0   F3,A3,C4,E4   85   2.0
3.0   D3,F3,A3,C4   80   2.0
5.0   G3,B3,D4,F4   88   2.0
7.0   C3,E3,G3,B3   82   2.0

@TRACK 2 Slap_Bass
@CHANNEL 2
@PROGRAM 36
1.0   F2   100   0.5
1.75  F2   80    0.25
2.5   C3   95    0.5
3.0   D2   105   0.5
3.75  D2   85    0.25
4.5   A2   90    0.5
5.0   G2   100   0.5
5.75  G2   80    0.25
6.5   D3   95    0.5
7.0   C2   105   0.5
7.75  C2   85    0.25
8.5   G2   90    0.5

@TRACK 3 Drums
@CHANNEL 10
// Four-on-the-floor kick & snare groove
1.0-9.0:2 36
2.0-9.0:2 38
1.0-9.0:1/2 42
| V [1.0, 3.0, 5.0, 7.0] 115
`;

export function App() {
  const [lmpText, setLmpText] = useState<string>(INITIAL_LMP_CODE);
  const [tracks, setTracks] = useState<StudioTrack[]>([]);
  const [activeTrackId, setActiveTrackId] = useState<number>(1);
  const [selectedNote, setSelectedNote] = useState<StudioNote | null>(null);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const [hoveredNoteId, setHoveredNoteId] = useState<string | null>(null);
  const [hoveredPitch, setHoveredPitch] = useState<string | null>(null);
  const [collapseCommons, setCollapseCommons] = useState<boolean>(true);

  const [activeTool, setActiveTool] = useState<ToolMode>('pointer');
  const [snap, setSnap] = useState<SnapResolution>('1/16');
  const [soundPreviewEnabled, setSoundPreviewEnabled] = useState<boolean>(true);
  const [scrollLock, setScrollLock] = useState<boolean>(true); // Selection-only focus
  const [isAiFriendOpen, setIsAiFriendOpen] = useState<boolean>(false);
  const [ghostNotes, setGhostNotes] = useState<StudioNote[]>([]);

  const [midiBytes, setMidiBytes] = useState<Uint8Array | null>(null);
  const [compileStatus, setCompileStatus] = useState<string>('');
  const [hasError, setHasError] = useState<boolean>(false);

  const [transport, setTransport] = useState<TransportState>({
    state: 'stopped',
    currentBeat: 1.0,
    totalBeats: 8.0,
    bpm: 118,
    timeSig: [4, 4],
    isLooping: true,
    loopStartBeat: 1.0,
    loopEndBeat: 9.0,
    masterVolume: 0.85,
  });

  // Recompile and parse document
  const compileDocument = useCallback((code: string) => {
    try {
      const res = compile(code, { sourceMap: true, loose: true });
      let bytes: Uint8Array;
      let smData: any = null;

      if (res && typeof res === 'object' && 'midi' in res) {
        bytes = (res as any).midi;
        smData = (res as any).sourceMap;
      } else {
        bytes = res as Uint8Array;
      }

      setMidiBytes(bytes);
      setHasError(false);
      setCompileStatus(`✓ Compiled: ${bytes?.length || 0} bytes MIDI`);

      // Parse structured tracks & notes
      const parsed = parseLmpDocument(code, smData);
      setTracks(parsed.tracks);

      // Load into audio engine
      studioAudioEngine.loadProject(parsed.tracks, parsed.bpm, parsed.timeSig, parsed.totalBeats);
      return parsed;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setHasError(true);
      setCompileStatus(`Compilation Error: ${msg}`);
      setMidiBytes(null);
      return null;
    }
  }, []);

  // Initial compilation on mount
  useEffect(() => {
    compileDocument(lmpText);
  }, []);

  // Subscribe to WebAudio transport changes
  useEffect(() => {
    const unsub = studioAudioEngine.subscribe((st) => setTransport(st));
    return unsub;
  }, []);

  // Keyboard shortcuts (Space = Play/Pause, V = Pointer, B = Pencil, E = Eraser)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return; // Don't intercept when typing in inputs
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (transport.state === 'playing') {
          studioAudioEngine.pause();
        } else {
          studioAudioEngine.play();
        }
      } else if (e.key === 'v' || e.key === 'V') {
        setActiveTool('pointer');
      } else if (e.key === 'b' || e.key === 'B') {
        setActiveTool('pencil');
      } else if (e.key === 'e' || e.key === 'E') {
        setActiveTool('eraser');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [transport.state]);

  // Code editor manual text change
  const handleCodeChange = (newCode: string) => {
    setLmpText(newCode);
    compileDocument(newCode);
  };

  // Note clicked in Piano Roll -> Select note and focus line
  const handleSelectNote = (note: StudioNote | null) => {
    setSelectedNote(note);
    if (note) {
      setSelectedLine(note.line);
    }
  };

  // Cursor line changed in CodeMirror -> Highlight corresponding note in Piano Roll
  const handleCursorLineChange = (line: number) => {
    setSelectedLine(line);
    const matchingNote = tracks.flatMap((t) => t.notes).find((n) => n.line === line);
    if (matchingNote) {
      setSelectedNote(matchingNote);
    }
  };

  // Hovering line in CodeMirror -> highlight ALL matching notes in Piano Roll
  const handleHoverLine = useCallback((line: number | null) => {
    setHoveredLine(line);
    setHoveredNoteId(null);
    setHoveredPitch(null);
  }, []);

  // Hovering note in Piano Roll -> highlight line and specific pitch token in CodeMirror
  const handleHoverNote = useCallback((note: StudioNote | null) => {
    setHoveredNoteId(note?.id || null);
    setHoveredLine(note?.line || null);
    setHoveredPitch(note?.pitch || null);
  }, []);

  // Visual Note Edited (moved or resized or velocity changed)
  const handleNoteChange = (
    note: StudioNote,
    updates: { pitch?: string; beat?: number; duration?: number; velocity?: number }
  ): StudioNote | null => {
    const updatedCode = patchNote(lmpText, note, updates, { collapseCommons });
    setLmpText(updatedCode);
    const parsed = compileDocument(updatedCode);

    if (parsed) {
      const targetMidi = updates.pitch ? spnToMidi(updates.pitch) : note.midiNumber;
      const targetBeat = updates.beat !== undefined ? updates.beat : note.beat;
      const track = parsed.tracks.find((t) => t.id === note.trackId);
      if (track) {
        let match = track.notes.find(
          (n) => n.midiNumber === targetMidi && Math.abs(n.beat - targetBeat) < 0.05
        );
        if (!match) {
          match =
            track.notes.find((n) => Math.abs(n.beat - targetBeat) < 0.05) ||
            track.notes.find((n) => n.midiNumber === targetMidi);
        }
        if (match) {
          setSelectedNote(match);
          setSelectedLine(match.line);
          setHoveredNoteId(match.id);
          setHoveredLine(match.line);
          setHoveredPitch(match.pitch);
          return match;
        }
      }
    }

    const fallback: StudioNote = {
      ...note,
      ...updates,
      midiNumber: updates.pitch ? spnToMidi(updates.pitch) : note.midiNumber,
    };
    setSelectedNote(fallback);
    return fallback;
  };

  // Visual Note Drawn with Pencil Tool
  const handleNoteCreate = (trackId: number, pitch: string, beat: number, duration: number) => {
    const updatedCode = insertNote(lmpText, trackId, pitch, beat, duration, 90, { collapseCommons });
    setLmpText(updatedCode);
    const parsed = compileDocument(updatedCode);

    if (parsed) {
      const targetMidi = spnToMidi(pitch);
      const track = parsed.tracks.find((t) => t.id === trackId);
      if (track) {
        const match = track.notes.find(
          (n) => (n.midiNumber === targetMidi || n.pitch === pitch) && Math.abs(n.beat - beat) < 0.05
        );
        if (match) {
          setSelectedNote(match);
          setSelectedLine(match.line);
          setHoveredNoteId(match.id);
          setHoveredLine(match.line);
          setHoveredPitch(match.pitch);
        }
      }
    }
  };

  // Note Deleted with Eraser Tool
  const handleNoteDelete = (note: StudioNote) => {
    const updatedCode = deleteNote(lmpText, note);
    setLmpText(updatedCode);
    compileDocument(updatedCode);
    if (selectedNote?.id === note.id) {
      setSelectedNote(null);
    }
  };

  // Track Mixer property updated (volume, pan, instrument, mute, solo)
  const handleTrackUpdate = (trackId: number, updates: Partial<StudioTrack>) => {
    const updatedTracks = tracks.map((t) => (t.id === trackId ? { ...t, ...updates } : t));
    setTracks(updatedTracks);

    // Sync audio engine mixer
    const trk = updatedTracks.find((t) => t.id === trackId);
    if (trk) {
      studioAudioEngine.updateTrackMixer(trk);
    }

    // Sync code header
    const updatedCode = patchTrackHeader(lmpText, trackId, {
      name: updates.name,
      channel: updates.channel,
      program: updates.program,
      volume: updates.volume,
      pan: updates.pan,
    });
    if (updatedCode !== lmpText) {
      setLmpText(updatedCode);
      compileDocument(updatedCode);
    }
  };

  // Add new track with proper blank line organization
  const handleAddTrack = (template: { name: string; channel: number; program: number }) => {
    const nextId = Math.max(0, ...tracks.map((t) => t.id)) + 1;
    const newTrackBlock = createNewTrackBlock(nextId, template.name, template.channel, template.program);
    const updatedCode = lmpText.trimEnd() + newTrackBlock;
    setLmpText(updatedCode);
    compileDocument(updatedCode);
    setActiveTrackId(nextId);
  };

  // Export MIDI
  const handleDownloadMidi = () => {
    if (!midiBytes) return;
    const blob = new Blob([new Uint8Array(midiBytes)], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lmp-studio-composition.mid';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Compute which track owns the currently hovered line for cross-track highlighting
  const hoveredTrackId = (() => {
    if (hoveredLine === null) return null;
    const matchingNote = tracks.flatMap((t) => t.notes).find((n) => n.line === hoveredLine);
    if (matchingNote) return matchingNote.trackId;
    const lines = lmpText.split('\n');
    let tid: number | null = null;
    for (let i = 0; i < Math.min(hoveredLine, lines.length); i++) {
      const stripped = lines[i].split('//')[0].trim();
      if (stripped.startsWith('@TRACK')) {
        const parsedTid = parseInt(stripped.split(/\s+/)[1], 10);
        if (!isNaN(parsedTid)) tid = parsedTid;
      }
    }
    return tid;
  })();

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0d12]">
      {/* 1. DAW Transport Bar */}
      <TransportBar
        transport={transport}
        onPlay={() => studioAudioEngine.play()}
        onPause={() => studioAudioEngine.pause()}
        onStop={() => studioAudioEngine.stop()}
        onToggleLoop={() => studioAudioEngine.setLoop(!transport.isLooping)}
        onBpmChange={(bpm) => {
          studioAudioEngine.setBpm(bpm);
          const updatedCode = lmpText.replace(/@BPM\s+\d+(\.\d+)?/i, `@BPM ${bpm}`);
          setLmpText(updatedCode);
          compileDocument(updatedCode);
        }}
        onMasterVolumeChange={(vol) => studioAudioEngine.setMasterVolume(vol)}
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        snap={snap}
        onSnapChange={setSnap}
        soundPreview={soundPreviewEnabled}
        onToggleSoundPreview={() => setSoundPreviewEnabled(!soundPreviewEnabled)}
        collapseCommons={collapseCommons}
        onToggleCollapseCommons={() => setCollapseCommons((prev) => !prev)}
        scrollLock={scrollLock}
        onToggleScrollLock={() => setScrollLock(!scrollLock)}
        onOpenAiFriend={() => setIsAiFriendOpen(true)}
        onDownloadMidi={handleDownloadMidi}
        canDownload={!!midiBytes && midiBytes.length > 0}
      />

      {/* 2. Dockable DAW Workspace */}
      <DockableWorkspace
        arrangerNode={
          <TrackMixer
            tracks={tracks}
            activeTrackId={activeTrackId}
            hoveredTrackId={hoveredTrackId}
            onSelectActiveTrack={setActiveTrackId}
            onTrackUpdate={handleTrackUpdate}
            onAddTrack={handleAddTrack}
            getTrackDrumMaps={(trackId) => extractTrackDrumMaps(lmpText, trackId)}
            onApplyDrumMap={(trackId, maps) => {
              const updatedCode = patchTrackDrumMap(lmpText, trackId, maps);
              setLmpText(updatedCode);
              compileDocument(updatedCode);
            }}
          />
        }
        pianoRollNode={
          <PianoRoll
            tracks={tracks}
            activeTrackId={activeTrackId}
            totalBeats={transport.totalBeats}
            currentBeat={transport.currentBeat}
            activeTool={activeTool}
            snap={snap}
            selectedNoteId={selectedNote?.id || null}
            hoveredLine={hoveredLine}
            hoveredNoteId={hoveredNoteId}
            soundPreviewEnabled={soundPreviewEnabled}
            onSelectNote={handleSelectNote}
            onHoverNote={handleHoverNote}
            onNoteChange={handleNoteChange}
            onNoteCreate={handleNoteCreate}
            onNoteDelete={handleNoteDelete}
            ghostNotes={ghostNotes}
          />
        }
        editorNode={
          <CodeEditor
            value={lmpText}
            onChange={handleCodeChange}
            selectedLine={selectedLine}
            hoveredLine={hoveredLine}
            hoveredPitch={hoveredPitch}
            scrollLock={scrollLock}
            onCursorLineChange={handleCursorLineChange}
            onHoverLine={handleHoverLine}
            statusText={compileStatus}
            hasError={hasError}
          />
        }
      />

      {/* 3. AI Musical Friend & Copilot Drawer */}
      <AiMusicalFriend
        isOpen={isAiFriendOpen}
        onClose={() => setIsAiFriendOpen(false)}
        currentLmp={lmpText}
        onApplyVariation={(code) => {
          setLmpText(code);
          compileDocument(code);
          setIsAiFriendOpen(false);
          setGhostNotes([]);
        }}
        onAuditionContext={(notes) => {
          studioAudioEngine.auditionVariation(notes, false);
        }}
        onAuditionSolo={(notes) => {
          studioAudioEngine.auditionVariation(notes, true);
        }}
        onHoverVariation={(notes) => {
          setGhostNotes(notes || []);
        }}
      />
    </div>
  );
}

export default App;
