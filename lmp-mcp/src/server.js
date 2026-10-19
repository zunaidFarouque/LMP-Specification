import { compile, decompile, parseMidi } from '../../compiler-js/src/index.js';
import { preprocess } from '../../compiler-js/src/preprocess.js';
import { buildState } from '../../compiler-js/src/state.js';
import { expand } from '../../compiler-js/src/expand.js';

export const TOOLS = [
  {
    name: 'compile_lmp',
    description: 'Compiles Lean Musical Protocol (LMP) text notation into standard MIDI binary and returns base64-encoded MIDI data with track metadata and warnings.',
    inputSchema: {
      type: 'object',
      properties: {
        lmp_text: {
          type: 'string',
          description: 'The complete LMP source code text to compile.'
        },
        loose: {
          type: 'boolean',
          description: 'If true, enables fault-tolerant loose compilation mode which recovers from minor formatting issues.'
        }
      },
      required: ['lmp_text']
    }
  },
  {
    name: 'decompile_midi',
    description: 'Decompiles a base64-encoded Standard MIDI file into clean, human-readable Lean Musical Protocol (LMP) notation.',
    inputSchema: {
      type: 'object',
      properties: {
        midi_base64: {
          type: 'string',
          description: 'Base64-encoded binary MIDI file data.'
        },
        max_decimals: {
          type: 'integer',
          description: 'Maximum decimal places for beat and duration formatting (default: 3).'
        }
      },
      required: ['midi_base64']
    }
  },
  {
    name: 'validate_lmp',
    description: 'Validates LMP source code syntax, returning syntactic correctness status, detailed error diagnostics (with line and column), warnings, and structural composition metrics.',
    inputSchema: {
      type: 'object',
      properties: {
        lmp_text: {
          type: 'string',
          description: 'LMP source text to validate.'
        }
      },
      required: ['lmp_text']
    }
  }
];

export function handleToolCall(name, args) {
  if (name === 'compile_lmp') {
    const { lmp_text, loose = false } = args;
    if (!lmp_text) throw new Error('Missing required argument: lmp_text');

    const result = compile(lmp_text, { loose });
    const midiBytes = result.midi || result;
    const warnings = result.warnings || [];
    const base64 = Buffer.from(midiBytes).toString('base64');

    let summary = {};
    try {
      const parsed = parseMidi(midiBytes);
      summary = {
        format: parsed.header.format,
        numTracks: parsed.tracks.length,
        ticksPerBeat: parsed.header.ticksPerBeat,
        byteLength: midiBytes.length
      };
    } catch (e) {
      summary = { byteLength: midiBytes.length };
    }

    return {
      success: true,
      midi_base64: base64,
      byte_length: midiBytes.length,
      warnings,
      summary
    };
  }

  if (name === 'decompile_midi') {
    const { midi_base64, max_decimals = 3 } = args;
    if (!midi_base64) throw new Error('Missing required argument: midi_base64');

    const buffer = Buffer.from(midi_base64, 'base64');
    const lmpText = decompile(buffer, { precision: max_decimals, maxDecimals: max_decimals });
    return {
      success: true,
      lmp_text: lmpText
    };
  }

  if (name === 'validate_lmp') {
    const { lmp_text } = args;
    if (typeof lmp_text !== 'string') throw new Error('Missing required argument: lmp_text');

    const warnings = [];
    const errors = [];
    let state = null;
    let events = null;

    try {
      const lines = preprocess(lmp_text);
      state = buildState(lines, { loose: true, warnings });
      events = expand(lines, state, { loose: true, warnings });
    } catch (err) {
      errors.push({
        message: err.message || String(err),
        line: err.line ?? null,
        col: err.col ?? null
      });
    }

    const valid = errors.length === 0;
    const stats = state ? {
      version: state.version,
      bpm: state.bpm,
      timeSignature: state.timesig ? `${state.timesig.num}/${state.timesig.denom}` : '4/4',
      ppqn: state.ppqn,
      origin: state.origin,
      tracksCount: state.tracks.length,
      tracks: state.tracks.map(t => ({
        id: t.id,
        index: t.id,
        name: t.name,
        channel: t.channel,
        program: t.program
      })),
      totalEvents: events ? events.length : 0
    } : null;

    return {
      valid,
      errors,
      warnings,
      stats
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}

export function handleRpcMessage(msg) {
  const { id, method, params } = msg;

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: 'lmp-mcp',
          version: '1.0.0'
        }
      }
    };
  }

  if (method === 'notifications/initialized') {
    return null;
  }

  if (method === 'ping') {
    return { jsonrpc: '2.0', id, result: {} };
  }

  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: TOOLS
      }
    };
  }

  if (method === 'tools/call') {
    const { name, arguments: toolArgs } = params || {};
    try {
      const toolResult = handleToolCall(name, toolArgs || {});
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(toolResult, null, 2)
            }
          ]
        }
      };
    } catch (err) {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: err.message || String(err) })
            }
          ]
        }
      };
    }
  }

  return {
    jsonrpc: '2.0',
    id,
    error: {
      code: -32601,
      message: `Method not found: ${method}`
    }
  };
}
