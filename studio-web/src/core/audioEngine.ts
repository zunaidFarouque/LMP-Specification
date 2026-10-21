import type { StudioNote, StudioTrack, TransportState } from './types';
import { soundFontEngine } from './soundfontEngine';

type Listener = (state: TransportState) => void;

class StudioAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private trackMixers: Map<number, { gain: GainNode; panner: StereoPannerNode }> = new Map();

  private transport: TransportState = {
    state: 'stopped',
    currentBeat: 1.0,
    totalBeats: 4.0,
    bpm: 120,
    timeSig: [4, 4],
    isLooping: true,
    loopStartBeat: 1.0,
    loopEndBeat: 5.0,
    masterVolume: 0.85,
  };

  private listeners: Set<Listener> = new Set();
  private tracks: StudioTrack[] = [];
  private soloedNotes: StudioNote[] | null = null; // When solo auditioning an AI variation

  private schedulerTimer: number | null = null;
  private startTime: number = 0;
  private pausedBeatOffset: number = 1.0;
  private scheduledNotes: Set<string> = new Set();

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.transport.masterVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.transport);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    for (const fn of this.listeners) {
      fn({ ...this.transport });
    }
  }

  public setMasterVolume(vol: number) {
    this.transport.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.transport.masterVolume, this.ctx.currentTime, 0.02);
    }
    this.notify();
  }

  public setBpm(bpm: number) {
    this.transport.bpm = Math.max(40, Math.min(300, bpm));
    this.notify();
  }

  public setLoop(looping: boolean, startBeat?: number, endBeat?: number) {
    this.transport.isLooping = looping;
    if (startBeat !== undefined) this.transport.loopStartBeat = startBeat;
    if (endBeat !== undefined) this.transport.loopEndBeat = endBeat;
    this.notify();
  }

  public loadProject(tracks: StudioTrack[], bpm: number, timeSig: [number, number], totalBeats: number) {
    this.tracks = tracks;
    this.transport.bpm = bpm;
    this.transport.timeSig = timeSig;
    this.transport.totalBeats = totalBeats;
    this.transport.loopStartBeat = 1.0;
    this.transport.loopEndBeat = totalBeats + 1.0;

    // Initialize soundfont engine (detects local fluid percussion, stored fonts, restores user preference)
    soundFontEngine.init();

    // Setup track mixer nodes
    const ctx = this.ensureContext();
    for (const t of tracks) {
      if (!this.trackMixers.has(t.id)) {
        const gain = ctx.createGain();
        const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : (null as any);
        if (panner) {
          gain.connect(panner);
          panner.connect(this.masterGain!);
        } else {
          gain.connect(this.masterGain!);
        }
        this.trackMixers.set(t.id, { gain, panner });
      }
      this.updateTrackMixer(t);
    }

    this.notify();
  }

  public updateTrackMixer(t: StudioTrack) {
    const mixer = this.trackMixers.get(t.id);
    if (!mixer || !this.ctx) return;

    // Check solo logic across all tracks
    const hasSolo = this.tracks.some((trk) => trk.isSolo);
    const isAudible = hasSolo ? t.isSolo : !t.isMuted;

    const targetGain = isAudible ? (t.volume / 127) : 0;
    mixer.gain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.02);

    if (mixer.panner && mixer.panner.pan) {
      const panVal = ((t.pan - 64) / 64); // -1 to 1
      mixer.panner.pan.setTargetAtTime(panVal, this.ctx.currentTime, 0.02);
    }
  }

  public play() {
    const ctx = this.ensureContext();
    if (this.transport.state === 'playing') return;

    this.scheduledNotes.clear();
    this.transport.state = 'playing';
    this.startTime = ctx.currentTime - this.beatToSeconds(this.pausedBeatOffset - 1.0);
    this.notify();

    this.startScheduler();
  }

  public pause() {
    if (this.transport.state !== 'playing') return;
    this.transport.state = 'paused';
    this.stopScheduler();
    this.pausedBeatOffset = this.transport.currentBeat;
    this.notify();
  }

  public stop() {
    this.transport.state = 'stopped';
    this.stopScheduler();
    this.transport.currentBeat = this.transport.loopStartBeat;
    this.pausedBeatOffset = this.transport.loopStartBeat;
    this.scheduledNotes.clear();
    this.soloedNotes = null;
    this.notify();
  }

  public seek(beat: number) {
    this.transport.currentBeat = beat;
    this.pausedBeatOffset = beat;
    if (this.transport.state === 'playing' && this.ctx) {
      this.scheduledNotes.clear();
      this.startTime = this.ctx.currentTime - this.beatToSeconds(beat - 1.0);
    }
    this.notify();
  }

  /**
   * Solo-audition an AI variation or isolated sequence
   */
  public auditionVariation(notes: StudioNote[], soloOnly: boolean = false) {
    if (soloOnly) {
      this.soloedNotes = notes;
    } else {
      this.soloedNotes = null;
    }
    this.stop();
    this.play();
  }

  private beatToSeconds(beats: number): number {
    return (beats * 60) / this.transport.bpm;
  }

  private startScheduler() {
    this.stopScheduler();
    const interval = 25; // ms
    const lookahead = 0.15; // 150ms

    this.schedulerTimer = window.setInterval(() => {
      if (!this.ctx || this.transport.state !== 'playing') return;

      const elapsedSec = this.ctx.currentTime - this.startTime;
      let currentBeat = 1.0 + (elapsedSec * this.transport.bpm) / 60;

      // Handle looping
      if (this.transport.isLooping && currentBeat >= this.transport.loopEndBeat) {
        const loopLenBeats = this.transport.loopEndBeat - this.transport.loopStartBeat;
        const overBeats = (currentBeat - this.transport.loopStartBeat) % loopLenBeats;
        currentBeat = this.transport.loopStartBeat + overBeats;
        this.startTime = this.ctx.currentTime - this.beatToSeconds(currentBeat - 1.0);
        this.scheduledNotes.clear();
      }

      this.transport.currentBeat = currentBeat;
      this.notify();

      // Schedule notes inside lookahead window
      const scheduleHorizonBeat = currentBeat + ((lookahead * this.transport.bpm) / 60);

      const notesToPlay = this.soloedNotes ? this.soloedNotes : this.tracks.flatMap((t) => t.notes);

      for (const n of notesToPlay) {
        if (n.beat >= currentBeat - 0.05 && n.beat < scheduleHorizonBeat) {
          const noteKey = `${n.id}_${Math.floor(currentBeat / (this.transport.loopEndBeat || 100))}`;
          if (!this.scheduledNotes.has(noteKey)) {
            this.scheduledNotes.add(noteKey);
            const noteStartTime = this.startTime + this.beatToSeconds(n.beat - 1.0);
            const noteDuration = Math.max(0.05, this.beatToSeconds(n.duration));
            this.triggerVoice(n, noteStartTime, noteDuration);
          }
        }
      }
    }, interval);
  }

  private stopScheduler() {
    if (this.schedulerTimer !== null) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  /**
   * Sound Synthesis Engine for Melodic and Percussive instruments
   */
  public triggerVoice(note: StudioNote, when: number, duration: number) {
    const ctx = this.ensureContext();
    if (when < ctx.currentTime - 0.1) return;

    const trk = this.tracks.find((t) => t.id === note.trackId);
    const channel = trk ? trk.channel : 1;
    const program = trk ? trk.program : 0;
    const mixer = trk ? this.trackMixers.get(trk.id) : null;
    const dest = mixer ? mixer.gain : this.masterGain!;

    // Check if SoundFont should handle this note for this track
    if (trk) {
      const handled = soundFontEngine.playNoteForTrack(
        ctx,
        dest,
        note.midiNumber,
        note.velocity,
        duration,
        when,
        trk
      );
      if (handled) return;
    }

    const normVel = Math.max(0.1, Math.min(1.0, note.velocity / 127));

    if (channel === 10) {
      // General MIDI Drums
      this.synthesizeDrum(note.midiNumber, normVel, when, dest);
    } else {
      // Tonal GM Instruments
      this.synthesizeInstrument(note.midiNumber, normVel, when, duration, program, dest);
    }
  }

  /**
   * Play a single test note immediately (e.g. clicking piano roll keyboard)
   */
  public playSingleNote(
    midiNumber: number,
    velocity: number = 90,
    channel: number = 1,
    program: number = 0,
    trackId?: number
  ) {
    const ctx = this.ensureContext();
    const trk = trackId !== undefined ? this.tracks.find((t) => t.id === trackId) : null;
    const mixer = trk ? this.trackMixers.get(trk.id) : null;
    const dest = mixer ? mixer.gain : this.masterGain!;
    const normVel = Math.max(0.1, Math.min(1.0, velocity / 127));

    if (trk) {
      const handled = soundFontEngine.playNoteForTrack(
        ctx,
        dest,
        midiNumber,
        velocity,
        0.8,
        ctx.currentTime,
        trk
      );
      if (handled) return;
    } else if (soundFontEngine.isSoundFontActive()) {
      const played = soundFontEngine.playNote(
        ctx,
        dest,
        midiNumber,
        velocity,
        0.8,
        ctx.currentTime,
        {
          bank: channel === 10 ? 128 : 41,
          preset: program || 116,
        }
      );
      if (played) return;
    }

    if (channel === 10) {
      this.synthesizeDrum(midiNumber, normVel, ctx.currentTime, dest);
    } else {
      this.synthesizeInstrument(midiNumber, normVel, ctx.currentTime, 0.8, program, dest);
    }
  }

  private synthesizeInstrument(
    midi: number,
    vel: number,
    when: number,
    duration: number,
    program: number,
    dest: AudioNode
  ) {
    const ctx = this.ctx!;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);

    const voiceGain = ctx.createGain();
    voiceGain.connect(dest);

    // Instrument Patches
    if (program >= 32 && program <= 39) {
      // Bass (Slap, Finger, Picked)
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, when);

      osc2.type = 'square';
      osc2.frequency.setValueAtTime(freq, when);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1800 * vel, when);
      filter.frequency.exponentialRampToValueAtTime(300, when + Math.min(0.3, duration));

      voiceGain.gain.setValueAtTime(0, when);
      voiceGain.gain.linearRampToValueAtTime(0.4 * vel, when + 0.01);
      voiceGain.gain.exponentialRampToValueAtTime(0.001, when + duration + 0.05);

      osc.connect(filter);
      osc2.connect(filter);
      filter.connect(voiceGain);

      osc.start(when);
      osc2.start(when);
      osc.stop(when + duration + 0.1);
      osc2.stop(when + duration + 0.1);
    } else if (program >= 48 && program <= 55) {
      // Strings / Pad (Soft attack, warm sustain)
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc2.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, when);
      osc2.frequency.setValueAtTime(freq * 1.004, when); // Chorus detune

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2200, when);

      const attack = 0.15;
      const release = 0.3;
      voiceGain.gain.setValueAtTime(0, when);
      voiceGain.gain.linearRampToValueAtTime(0.25 * vel, when + attack);
      voiceGain.gain.setValueAtTime(0.25 * vel, when + duration);
      voiceGain.gain.exponentialRampToValueAtTime(0.0001, when + duration + release);

      osc.connect(filter);
      osc2.connect(filter);
      filter.connect(voiceGain);

      osc.start(when);
      osc2.start(when);
      osc.stop(when + duration + release + 0.05);
      osc2.stop(when + duration + release + 0.05);
    } else {
      // Acoustic Grand Piano & Electric Rhodes (Default)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'triangle';
      osc2.type = 'sine';

      osc1.frequency.setValueAtTime(freq, when);
      osc2.frequency.setValueAtTime(freq * 2, when); // 2nd harmonic sparkle

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3200 * vel, when);
      filter.frequency.exponentialRampToValueAtTime(400, when + Math.min(1.5, duration));

      voiceGain.gain.setValueAtTime(0, when);
      voiceGain.gain.linearRampToValueAtTime(0.45 * vel, when + 0.005);
      voiceGain.gain.exponentialRampToValueAtTime(0.0005, when + duration + 0.2);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(voiceGain);

      osc1.start(when);
      osc2.start(when);
      osc1.stop(when + duration + 0.25);
      osc2.stop(when + duration + 0.25);
    }
  }

  private synthesizeDrum(midi: number, vel: number, when: number, dest: AudioNode) {
    const ctx = this.ctx!;
    const voiceGain = ctx.createGain();
    voiceGain.connect(dest);

    if (midi === 35 || midi === 36) {
      // Kick Drum: Rapid pitch drop sine
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, when);
      osc.frequency.exponentialRampToValueAtTime(38, when + 0.12);

      voiceGain.gain.setValueAtTime(0.85 * vel, when);
      voiceGain.gain.exponentialRampToValueAtTime(0.001, when + 0.28);

      osc.connect(voiceGain);
      osc.start(when);
      osc.stop(when + 0.3);
    } else if (midi === 38 || midi === 40) {
      // Snare Drum: Tone + Noise burst
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(190, when);
      osc.frequency.exponentialRampToValueAtTime(80, when + 0.08);

      const toneGain = ctx.createGain();
      toneGain.gain.setValueAtTime(0.5 * vel, when);
      toneGain.gain.exponentialRampToValueAtTime(0.001, when + 0.15);
      osc.connect(toneGain);
      toneGain.connect(dest);

      // Noise burst
      const noise = this.createNoiseBuffer(0.2);
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noise;

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(900, when);

      voiceGain.gain.setValueAtTime(0.6 * vel, when);
      voiceGain.gain.exponentialRampToValueAtTime(0.001, when + 0.2);

      noiseSource.connect(filter);
      filter.connect(voiceGain);

      osc.start(when);
      noiseSource.start(when);
      osc.stop(when + 0.22);
      noiseSource.stop(when + 0.22);
    } else if (midi === 42 || midi === 44) {
      // Closed Hi-Hat: Short high-pass noise
      const noise = this.createNoiseBuffer(0.08);
      const src = ctx.createBufferSource();
      src.buffer = noise;

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(7500, when);

      voiceGain.gain.setValueAtTime(0.4 * vel, when);
      voiceGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);

      src.connect(filter);
      filter.connect(voiceGain);
      src.start(when);
      src.stop(when + 0.07);
    } else if (midi === 46) {
      // Open Hi-Hat: Longer high-pass noise
      const noise = this.createNoiseBuffer(0.35);
      const src = ctx.createBufferSource();
      src.buffer = noise;

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(6500, when);

      voiceGain.gain.setValueAtTime(0.45 * vel, when);
      voiceGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.32);

      src.connect(filter);
      filter.connect(voiceGain);
      src.start(when);
      src.stop(when + 0.35);
    } else {
      // Generic Tom / Percussion
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, when);
      osc.frequency.exponentialRampToValueAtTime(70, when + 0.2);

      voiceGain.gain.setValueAtTime(0.6 * vel, when);
      voiceGain.gain.exponentialRampToValueAtTime(0.001, when + 0.25);

      osc.connect(voiceGain);
      osc.start(when);
      osc.stop(when + 0.28);
    }
  }

  private createNoiseBuffer(duration: number): AudioBuffer {
    const ctx = this.ctx!;
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }
}

export const studioAudioEngine = new StudioAudioEngine();
