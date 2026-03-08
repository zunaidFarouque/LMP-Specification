export type PianoRollViewport = {
  pixelsPerBeat: number;
  scrollBeat: number;
  /** Fixed height of each pitch row (same for all tracks). */
  pitchRowHeight: number;
  scrollTrackY: number;
};

const MIN_PX_PER_BEAT = 20;
const MAX_PX_PER_BEAT = 400;
const DEFAULT_PX_PER_BEAT = 60;
const MIN_PITCH_ROW_HEIGHT = 12;
const MAX_PITCH_ROW_HEIGHT = 36;
const DEFAULT_PITCH_ROW_HEIGHT = 18;

export function createDefaultViewport(): PianoRollViewport {
  return {
    pixelsPerBeat: DEFAULT_PX_PER_BEAT,
    scrollBeat: 0,
    pitchRowHeight: DEFAULT_PITCH_ROW_HEIGHT,
    scrollTrackY: 0,
  };
}

export function zoomHorizontal(
  v: PianoRollViewport,
  delta: number,
  centerBeat: number
): PianoRollViewport {
  const factor = delta > 0 ? 1.2 : 1 / 1.2;
  let next = v.pixelsPerBeat * factor;
  next = Math.max(MIN_PX_PER_BEAT, Math.min(MAX_PX_PER_BEAT, next));
  const scrollBeat = centerBeat - (centerBeat - v.scrollBeat) * (v.pixelsPerBeat / next);
  return { ...v, pixelsPerBeat: next, scrollBeat: Math.max(0, scrollBeat) };
}

export function zoomVertical(v: PianoRollViewport, delta: number): PianoRollViewport {
  const factor = delta > 0 ? 1.2 : 1 / 1.2;
  let next = v.pitchRowHeight * factor;
  next = Math.max(MIN_PITCH_ROW_HEIGHT, Math.min(MAX_PITCH_ROW_HEIGHT, next));
  return { ...v, pitchRowHeight: next };
}

export function panHorizontal(v: PianoRollViewport, deltaBeats: number): PianoRollViewport {
  return { ...v, scrollBeat: Math.max(0, v.scrollBeat + deltaBeats) };
}

export function panVertical(v: PianoRollViewport, deltaPx: number): PianoRollViewport {
  return { ...v, scrollTrackY: Math.max(0, v.scrollTrackY + deltaPx) };
}

export function resetViewport(contentStartBeat: number): PianoRollViewport {
  return {
    pixelsPerBeat: DEFAULT_PX_PER_BEAT,
    scrollBeat: Math.max(0, contentStartBeat - 0.5),
    pitchRowHeight: DEFAULT_PITCH_ROW_HEIGHT,
    scrollTrackY: 0,
  };
}
