#!/usr/bin/env node
import readline from 'readline';
import { handleRpcMessage, TOOLS, handleToolCall } from './server.js';

export { handleRpcMessage, TOOLS, handleToolCall };

export function startStdioServer() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  process.stderr.write('[lmp-mcp] Lean Musical Protocol MCP server started on stdio\n');

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const msg = JSON.parse(trimmed);
      const res = handleRpcMessage(msg);
      if (res) {
        process.stdout.write(JSON.stringify(res) + '\n');
      }
    } catch (err) {
      const errRes = {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: 'Parse error: ' + (err.message || String(err))
        }
      };
      process.stdout.write(JSON.stringify(errRes) + '\n');
    }
  });

  rl.on('close', () => {
    process.stderr.write('[lmp-mcp] Stdio stream closed, exiting.\n');
    process.exit(0);
  });
}

// If executed directly, start the stdio server
if (process.argv[1] && (process.argv[1].endsWith('index.js') || process.argv[1].endsWith('lmp-mcp.js'))) {
  startStdioServer();
}
