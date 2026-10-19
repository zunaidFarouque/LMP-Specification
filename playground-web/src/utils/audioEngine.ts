import { Midi } from '@tonejs/midi';

export type PlaybackState = 'stopped' | 'playing' | 'paused';

export interface TransportState {
  state: PlaybackState;
  currentBeat: number;
  totalBeats: number;
  bpm: number;
  tempoMultiplier: number;
  isLooping: boolean;
}

export type PlaybackCallback = (state: TransportState) => void;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private activeNodes: { stop: (when: number) => void }[] = [];
  private state: PlaybackState = 'stopped';
  private midiData: Midi | null = null;
  private startCtxTime = 0;
  private pauseOffsetSec = 0;
  private tempoMultiplier = 1.0;
  private isLooping = false;
  private rafId: number | null = null;
  private listeners: Set<PlaybackCallback> = new Set();
  private baseBpm = 120;
  private totalDurationSec = 0;
  private startBeat = 1.0;
  private totalBeats = 4.0;

  private initContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * 2; // 2 seconds of white noise
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  public subscribe(cb: PlaybackCallback): () => void {
    this.listeners.add(cb);
    this.notify();
    return () => this.listeners.delete(cb);
  }

  private notify() {
    const transport: TransportState = {
      state: this.state,
      currentBeat: this.getCurrentBeat(),
      totalBeats: this.totalBeats,
      bpm: Math.round(this.baseBpm * this.tempoMultiplier),
      tempoMultiplier: this.tempoMultiplier,
      isLooping: this.isLooping,
    };
    for (const cb of this.listeners) {
      cb(transport);
    }
  }

  public loadMidi(midiBytes: Uint8Array | null) {
    this.stop();
    if (!midiBytes) {
      this.midiData = null;
      this.totalDurationSec = 0;
      this.totalBeats = 4.0;
      this.notify();
      return;
    }
    try {
      this.midiData = new Midi(midiBytes);
      this.baseBpm = this.midiData.header.tempos[0]?.bpm ?? 120;
      this.totalDurationSec = this.midiData.duration;
      const ppq = this.midiData.header.ppq || 480;
      let maxTicks = 0;
      for (const track of this.midiData.tracks) {
        for (const note of track.notes) {
          const endTick = note.ticks + note.durationTicks;
          if (endTick > maxTicks) maxTicks = endTick;
        }
      }
      this.totalBeats = Math.max(1, maxTicks / ppq + 1);
    } catch {
      this.midiData = null;
    }
    this.notify();
  }

  public play() {
    if (!this.midiData || this.midiData.tracks.length === 0) return;
    this.initContext();

    if (this.state === 'paused') {
      this.schedulePlayback(this.pauseOffsetSec);
    } else {
      this.schedulePlayback(0);
    }
    this.state = 'playing';
    this.startTracking();
    this.notify();
  }

  public pause() {
    if (this.state !== 'playing' || !this.ctx) return;
    const elapsedSec = (this.ctx.currentTime - this.startCtxTime) * this.tempoMultiplier;
    this.pauseOffsetSec = elapsedSec;
    this.stopActiveNodes();
    this.state = 'paused';
    this.stopTracking();
    this.notify();
  }

  public stop() {
    this.stopActiveNodes();
    this.pauseOffsetSec = 0;
    this.state = 'stopped';
    this.stopTracking();
    this.notify();
  }

  public togglePlay() {
    if (this.state === 'playing') {
      this.pause();
    } else {
      this.play();
    }
  }

  public setLoop(loop: boolean) {
    this.isLooping = loop;
    this.notify();
  }

  public setTempoMultiplier(multiplier: number) {
    const wasPlaying = this.state === 'playing';
    const currentBeat = this.getCurrentBeat();
    if (wasPlaying) {
      this.pause();
    }
    this.tempoMultiplier = Math.max(0.25, Math.min(3.0, multiplier));
    if (wasPlaying) {
      const beatProgress = Math.max(0, currentBeat - this.startBeat);
      const musicalElapsedSec = (beatProgress * 60) / this.baseBpm;
      this.pauseOffsetSec = musicalElapsedSec;
      this.play();
    } else {
      this.notify();
    }
  }

  public getCurrentBeat(): number {
    if (this.state === 'stopped' || !this.ctx) return this.startBeat;
    const musicalElapsedSec = this.state === 'playing'
      ? (this.ctx.currentTime - this.startCtxTime) * this.tempoMultiplier
      : this.pauseOffsetSec;
    const beatsElapsed = (musicalElapsedSec * this.baseBpm) / 60;
    return Math.min(this.totalBeats, Math.round((this.startBeat + beatsElapsed) * 100) / 100);
  }

  private stopActiveNodes() {
    const now = this.ctx ? this.ctx.currentTime : 0;
    for (const node of this.activeNodes) {
      try {
        node.stop(now);
      } catch {
        // Already stopped
      }
    }
    this.activeNodes = [];
  }

  private schedulePlayback(offsetSec: number) {
    if (!this.ctx || !this.midiData) return;
    this.stopActiveNodes();

    const ctx = this.ctx;
    this.startCtxTime = ctx.currentTime - offsetSec / this.tempoMultiplier;
    const now = ctx.currentTime;
    const noise = this.getNoiseBuffer(ctx);

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.5, now);
    masterGain.connect(ctx.destination);

    for (const track of this.midiData.tracks) {
      const isDrum = track.channel === 9; // channel 10 is 0-indexed 9

      for (const note of track.notes) {
        // Scaled timing
        const noteStartSec = (note.time - offsetSec) / this.tempoMultiplier;
        const noteDurSec = Math.max(0.04, note.duration / this.tempoMultiplier);

        if (noteStartSec + noteDurSec < 0) continue; // Already passed
        const startTime = now + Math.max(0, noteStartSec);
        const stopTime = startTime + noteDurSec;

        const vel = Math.max(0.1, Math.min(1.0, note.velocity));

        if (isDrum) {
          this.scheduleDrumNote(ctx, masterGain, noise, note.midi, startTime, vel);
        } else {
          this.scheduleMelodicNote(ctx, masterGain, note.midi, startTime, stopTime, vel);
        }
      }
    }
  }

  private scheduleMelodicNote(
    ctx: AudioContext,
    destination: AudioNode,
    midi: number,
    startTime: number,
    stopTime: number,
    velocity: number
  ) {
    const freq = 440 * Math.pow(2, (midi - 69) / 12);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Warm, pleasing synth tone with triangle and lowpass
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(12000, freq * 6), startTime);

    // ADSR envelope
    const attack = 0.015;
    const release = 0.08;
    const peak = velocity * 0.45;
    const sustain = peak * 0.7;

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(peak, startTime + attack);
    gain.gain.linearRampToValueAtTime(sustain, startTime + attack + 0.05);
    gain.gain.setValueAtTime(sustain, Math.max(startTime + attack + 0.05, stopTime - release));
    gain.gain.exponentialRampToValueAtTime(0.0001, stopTime);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(destination);

    osc.start(startTime);
    osc.stop(stopTime + 0.05);

    this.activeNodes.push({
      stop: (when) => {
        try {
          gain.gain.cancelScheduledValues(when);
          gain.gain.setValueAtTime(gain.gain.value, when);
          gain.gain.linearRampToValueAtTime(0.0001, when + 0.02);
          osc.stop(when + 0.03);
        } catch {
          // ignore
        }
      },
    });
  }

  private scheduleDrumNote(
    ctx: AudioContext,
    destination: AudioNode,
    noiseBuffer: AudioBuffer,
    midi: number,
    startTime: number,
    velocity: number
  ) {
    // Bass Drum / Kick (35, 36)
    if (midi === 35 || midi === 36) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, startTime);
      osc.frequency.exponentialRampToValueAtTime(42, startTime + 0.12);

      gain.gain.setValueAtTime(velocity * 0.8, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

      osc.connect(gain);
      gain.connect(destination);
      osc.start(startTime);
      osc.stop(startTime + 0.26);

      this.activeNodes.push({ stop: (w) => { try { osc.stop(w); } catch {} } });
      return;
    }

    // Snare (38, 40)
    if (midi === 38 || midi === 40) {
      // Noise component
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(1200, startTime);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(velocity * 0.6, startTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(destination);

      // Body tone
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, startTime);
      osc.frequency.exponentialRampToValueAtTime(80, startTime + 0.08);
      oscGain.gain.setValueAtTime(velocity * 0.4, startTime);
      oscGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.12);

      osc.connect(oscGain);
      oscGain.connect(destination);

      noise.start(startTime);
      noise.stop(startTime + 0.2);
      osc.start(startTime);
      osc.stop(startTime + 0.15);

      this.activeNodes.push({
        stop: (w) => {
          try { noise.stop(w); osc.stop(w); } catch {}
        },
      });
      return;
    }

    // Hi-Hats & Cymbals (42, 44: closed; 46: open; 49, 51: cymbal/ride)
    if (midi === 42 || midi === 44 || midi === 46 || midi === 49 || midi === 51) {
      const isLong = midi === 46 || midi === 49 || midi === 51;
      const duration = isLong ? 0.35 : 0.06;
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(6500, startTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(velocity * (isLong ? 0.4 : 0.5), startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(destination);

      noise.start(startTime);
      noise.stop(startTime + duration + 0.02);

      this.activeNodes.push({ stop: (w) => { try { noise.stop(w); } catch {} } });
      return;
    }

    // Generic percussion / Tabla / Toms: resonant bandpass noise + decaying tone
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const freq = 110 * Math.pow(2, (midi % 12) / 12);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.5, startTime);
    osc.frequency.exponentialRampToValueAtTime(freq, startTime + 0.1);

    gain.gain.setValueAtTime(velocity * 0.5, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.22);

    osc.connect(gain);
    gain.connect(destination);
    osc.start(startTime);
    osc.stop(startTime + 0.25);

    this.activeNodes.push({ stop: (w) => { try { osc.stop(w); } catch {} } });
  }

  private startTracking() {
    this.stopTracking();
    const tick = () => {
      if (this.state !== 'playing' || !this.ctx) return;
      const musicalElapsedSec = (this.ctx.currentTime - this.startCtxTime) * this.tempoMultiplier;

      if (musicalElapsedSec >= this.totalDurationSec + 0.2) {
        if (this.isLooping) {
          this.play();
        } else {
          this.stop();
        }
        return;
      }
      this.notify();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stopTracking() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}

export const audioEngine = new AudioEngine();
