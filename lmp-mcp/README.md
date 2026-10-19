# lmp-mcp: Official Model Context Protocol Server for Lean Musical Protocol

Official Model Context Protocol (MCP) server for compiling, decompiling, and validating [Lean Musical Protocol (LMP)](https://github.com/zunaidFarouque/LMP-Specification) compositions over stdio.

## Features

- `compile_lmp`: Compiles LMP source text into Standard MIDI format (base64-encoded binary).
- `decompile_midi`: Converts binary MIDI files (base64) into clean, human-readable LMP text.
- `validate_lmp`: Statically analyzes LMP code, returning AST statistics and precise line/column syntax error diagnostics.

## Configuration

### Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "lmp": {
      "command": "node",
      "args": ["/path/to/LMP-Specification/lmp-mcp/bin/lmp-mcp.js"]
    }
  }
}
```

### Cursor (`~/.cursor/mcp.json` or Workspace Settings)
```json
{
  "mcpServers": {
    "lmp": {
      "command": "node",
      "args": ["${workspaceFolder}/lmp-mcp/bin/lmp-mcp.js"]
    }
  }
}
```

## Running Standalone
```bash
node bin/lmp-mcp.js
```
The server reads JSON-RPC 2.0 messages from `stdin` and writes responses to `stdout`.
