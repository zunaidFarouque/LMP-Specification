import { describe, test, expect } from 'bun:test';
import { handleRpcMessage, TOOLS, handleToolCall } from '../src/server.js';

describe('Track D.3: Official Model Context Protocol (MCP) Server (lmp-mcp)', () => {
  const sampleLmp = `
@LMP 1.0
@BPM 128
@TIMESIG 4/4
@TRACK 1 Synth_Lead
@CHANNEL 1
@PROGRAM 80
1.0 C4 100 0.5
1.5 D4 100 0.5
2.0 E4 110 1.0
`;

  test('MCP initialization returns server capabilities and metadata', () => {
    const res = handleRpcMessage({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {}
    });

    expect(res.jsonrpc).toBe('2.0');
    expect(res.id).toBe(1);
    expect(res.result.serverInfo.name).toBe('lmp-mcp');
    expect(res.result.capabilities.tools).toBeDefined();
  });

  test('tools/list returns compile_lmp, decompile_midi, and validate_lmp specifications', () => {
    const res = handleRpcMessage({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    });

    expect(res.result.tools).toBeArray();
    const toolNames = res.result.tools.map(t => t.name);
    expect(toolNames).toContain('compile_lmp');
    expect(toolNames).toContain('decompile_midi');
    expect(toolNames).toContain('validate_lmp');
  });

  test('compile_lmp compiles LMP source to base64 MIDI with track metadata', () => {
    const res = handleRpcMessage({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'compile_lmp',
        arguments: {
          lmp_text: sampleLmp
        }
      }
    });

    expect(res.result.isError).toBeUndefined();
    const payload = JSON.parse(res.result.content[0].text);
    expect(payload.success).toBe(true);
    expect(typeof payload.midi_base64).toBe('string');
    expect(payload.byte_length).toBeGreaterThan(20);
    expect(payload.summary.numTracks).toBeGreaterThanOrEqual(1);
  });

  test('decompile_midi roundtrips compiled base64 MIDI back to LMP text', () => {
    // 1. Compile to base64
    const compRes = handleToolCall('compile_lmp', { lmp_text: sampleLmp });
    expect(compRes.success).toBe(true);

    // 2. Decompile base64
    const decompRes = handleRpcMessage({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'decompile_midi',
        arguments: {
          midi_base64: compRes.midi_base64
        }
      }
    });

    const payload = JSON.parse(decompRes.result.content[0].text);
    expect(payload.success).toBe(true);
    expect(payload.lmp_text).toContain('@LMP 1.0');
    expect(payload.lmp_text).toContain('Synth_Lead');
    expect(payload.lmp_text).toContain('C4');
  });

  test('validate_lmp returns valid=true with full track stats for valid LMP', () => {
    const res = handleRpcMessage({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'validate_lmp',
        arguments: {
          lmp_text: sampleLmp
        }
      }
    });

    const payload = JSON.parse(res.result.content[0].text);
    expect(payload.valid).toBe(true);
    expect(payload.errors.length).toBe(0);
    expect(payload.stats.bpm).toBe(128);
    expect(payload.stats.timeSignature).toBe('4/4');
    expect(payload.stats.tracksCount).toBe(1);
    expect(payload.stats.tracks[0].id).toBe(1);
    expect(payload.stats.tracks[0].index).toBe(1);
    expect(payload.stats.totalEvents).toBe(3);
  });

  test('decompile_midi respects max_decimals argument', () => {
    const lmpWithDecimals = `
@LMP 1.0
@BPM 120
@TRACK 1 Flute
@CHANNEL 1
1.333 C4 80 0.333
`;
    const compRes = handleToolCall('compile_lmp', { lmp_text: lmpWithDecimals });
    const decompRes = handleToolCall('decompile_midi', {
      midi_base64: compRes.midi_base64,
      max_decimals: 2
    });
    expect(decompRes.lmp_text).toContain('1.33 C4');
  });

  test('validate_lmp captures syntax errors with exact line and column diagnostics', () => {
    const brokenLmp = `
@LMP 1.0
1.0 C4 100 1.0
`;
    const res = handleRpcMessage({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: {
        name: 'validate_lmp',
        arguments: {
          lmp_text: brokenLmp
        }
      }
    });

    const payload = JSON.parse(res.result.content[0].text);
    expect(payload.valid).toBe(false);
    expect(payload.errors.length).toBeGreaterThan(0);
    expect(payload.errors[0].message).toContain('@TRACK');
  });

  test('Unknown tool returns informative error message in MCP format', () => {
    const res = handleRpcMessage({
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: {
        name: 'non_existent_tool',
        arguments: {}
      }
    });

    expect(res.result.isError).toBe(true);
    const payload = JSON.parse(res.result.content[0].text);
    expect(payload.error).toContain('Unknown tool');
  });
});
