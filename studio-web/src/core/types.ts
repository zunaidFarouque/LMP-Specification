export type ToolMode = 'pointer' | 'pencil' | 'eraser';

export type SnapResolution = '1/4' | '1/8' | '1/16' | '1/32' | '1/12' | 'free';

export interface StudioNote {
  id: string;
  trackId: number;
  pitch: string; // SPN, e.g. "C4"
  midiNumber: number; // 0-127
  beat: number; // 1-based, e.g. 1.0, 1.5
  duration: number; // in beats, e.g. 1.0
  velocity: number; // 1-127
  line: number; // 1-based source code line
  colStart: number;
  colEnd: number;
  rawText?: string;
  isGhost?: boolean; // For AI suggestion overlay
}

export interface StudioTrack {
  id: number;
  name: string;
  channel: number; // 1-16
  program: number; // 0-127 GM patch
  volume: number; // 0-127 (CC 7)
  pan: number; // 0-127 (CC 10, 64 is center)
  isMuted: boolean;
  isSolo: boolean;
  color: string;
  notes: StudioNote[];
  soundfont?: string | null;
}

export interface TransportState {
  state: 'stopped' | 'playing' | 'paused';
  currentBeat: number;
  totalBeats: number;
  bpm: number;
  timeSig: [number, number];
  isLooping: boolean;
  loopStartBeat: number;
  loopEndBeat: number;
  masterVolume: number; // 0-1
}

export interface AiVariation {
  id: string;
  variationIndex: number;
  title: string;
  description: string;
  fullLmpCode: string;
  changedTrackId?: number;
  ghostNotes: StudioNote[];
  bpm: number;
  bars: number;
}
