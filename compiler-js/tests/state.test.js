/**
 * LMP Pass 2: State (headers) — unit tests.
 */
import { describe, test, expect } from 'bun:test';
import { preprocess } from '../src/preprocess.js';
import { buildState } from '../src/state.js';

function parse(lines) {
  const pre = lines.map((l) => ({ type: l.startsWith('@') ? 'header' : 'event', tokens: l.split(/\s+/) }));
  return buildState(pre);
}

describe('buildState', () => {
  test('@LMP 1.0 sets version', () => {
    const s = parse(['@LMP 1.0']);
    expect(s.version).toBe('1.0');
  });

  test('@BPM sets global tempo', () => {
    const s = parse(['@LMP 1.0', '@BPM 120']);
    expect(s.bpm).toBe(120);
  });

  test('@TIMESIG sets time signature', () => {
    const s = parse(['@TIMESIG 7/8']);
    expect(s.timesig).toEqual({ num: 7, denom: 8 });
  });

  test('default time signature is 4/4', () => {
    const s = parse(['@LMP 1.0']);
    expect(s.timesig).toEqual({ num: 4, denom: 4 });
  });

  test('@PPQN sets resolution', () => {
    const s = parse(['@PPQN 960']);
    expect(s.ppqn).toBe(960);
  });

  test('default PPQN is 480', () => {
    const s = parse(['@LMP 1.0']);
    expect(s.ppqn).toBe(480);
  });

  test('global defaults when only @LMP', () => {
    const s = parse(['@LMP 1.0']);
    expect(s.bpm).toBeUndefined();
    expect(s.timesig).toEqual({ num: 4, denom: 4 });
    expect(s.ppqn).toBe(480);
  });

  test('@TRACK N Name creates track with mandatory name', () => {
    const s = parse(['@TRACK 1 Piano']);
    expect(s.tracks).toHaveLength(1);
    expect(s.tracks[0]).toMatchObject({ id: 1, name: 'Piano' });
  });

  test('@TRACK without name throws', () => {
    expect(() => parse(['@TRACK 1'])).toThrow(/track.*name|name.*mandatory|invalid/i);
  });

  test('@CHANNEL sets channel (1-16)', () => {
    const s = parse(['@TRACK 1 Piano', '@CHANNEL 1']);
    expect(s.tracks[0].channel).toBe(1);
  });

  test('@PROGRAM sets patch (0-127)', () => {
    const s = parse(['@TRACK 1 Piano', '@CHANNEL 1', '@PROGRAM 0']);
    expect(s.tracks[0].program).toBe(0);
  });

  test('@PBRANGE sets pitch bend range, default 2', () => {
    const s = parse(['@TRACK 1 Piano', '@CHANNEL 1', '@PBRANGE 12']);
    expect(s.tracks[0].pbrange).toBe(12);
  });

  test('new track gets default PBRANGE 2', () => {
    const s = parse(['@TRACK 1 Piano', '@CHANNEL 1', '@TRACK 2 Drums', '@CHANNEL 10']);
    expect(s.tracks[0].pbrange).toBe(2);
    expect(s.tracks[1].pbrange).toBe(2);
  });

  test('event before first @TRACK throws', () => {
    expect(() => parse(['@LMP 1.0', '1.0 C4'])).toThrow(/TRACK|event/i);
  });

  test('@CHANNEL required per track — second track without channel throws when event is used', () => {
    const s = parse(['@TRACK 1 Piano', '@CHANNEL 1', '@TRACK 2 Bass']);
    expect(s.tracks[1].channel).toBeUndefined();
    // Validation that event on track 2 requires channel can be in expand; state just builds. So no throw in state for "missing channel". Plan says "each new track must declare @CHANNEL". So we could throw in buildState when we switch to a new track and later see an event - we need to have channel set. So when we process an event line we need current track to have channel. So in buildState when we see event/continuation/modifier we require currentTrack.channel !== undefined. So add test: two tracks, second has no @CHANNEL, then event line -> throw.
    const lines = [
      { type: 'header', tokens: ['@TRACK', '1', 'Piano'] },
      { type: 'header', tokens: ['@CHANNEL', '1'] },
      { type: 'header', tokens: ['@TRACK', '2', 'Bass'] },
      { type: 'event', tokens: ['1.0', 'C2'] },
    ];
    expect(() => buildState(lines)).toThrow(/channel|CHANNEL/i);
  });

  test('@DEFAULT_VEL and @DEFAULT_DUR set track defaults', () => {
    const s = parse(['@TRACK 1 Piano', '@CHANNEL 1', '@DEFAULT_VEL 80', '@DEFAULT_DUR 1.0']);
    expect(s.tracks[0].defaultVel).toBe(80);
    expect(s.tracks[0].defaultDur).toBe(1);
  });

  test('@MAP name=midi persists globally', () => {
    const s = parse(['@MAP kick=36', '@MAP snare=38', '@TRACK 1 Drums', '@CHANNEL 10']);
    expect(s.map.kick).toBe(36);
    expect(s.map.snare).toBe(38);
  });

  test('@MAP invalid name (leading digit) throws', () => {
    expect(() => parse(['@MAP 1=36'])).toThrow(/MAP|invalid|name/i);
  });

  test('@INHERIT 1 copies from track 1', () => {
    const lines = [
      { type: 'header', tokens: ['@TRACK', '1', 'Piano'] },
      { type: 'header', tokens: ['@CHANNEL', '1'] },
      { type: 'header', tokens: ['@DEFAULT_VEL', '80'] },
      { type: 'header', tokens: ['@TRACK', '2', 'Piano_LH'] },
      { type: 'header', tokens: ['@INHERIT', '1'] },
      { type: 'header', tokens: ['@CHANNEL', '1'] },
    ];
    const s = buildState(lines);
    expect(s.tracks[1].defaultVel).toBe(80);
  });

  test('@INHERIT from non-existent track throws', () => {
    const lines = [
      { type: 'header', tokens: ['@TRACK', '2', 'Bass'] },
      { type: 'header', tokens: ['@INHERIT', '1'] },
      { type: 'header', tokens: ['@CHANNEL', '1'] },
    ];
    expect(() => buildState(lines)).toThrow(/INHERIT|track/i);
  });
});
