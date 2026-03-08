declare module 'lmp-core' {
  export function compile(
    text: string,
    opts?: { loose?: boolean; sourceMap?: boolean }
  ): Uint8Array | { midi: Uint8Array; warnings?: string[]; sourceMap?: Map<string, number> };
  export function decompile(buffer: Uint8Array): string;
  export function parseMidi(buffer: Uint8Array): {
    header?: { ticksPerBeat?: number };
    tracks: Array<Array<{ deltaTime?: number; type: string; channel?: number; noteNumber?: number; velocity?: number; text?: string; microsecondsPerBeat?: number }>>;
  };
}
