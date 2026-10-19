declare module 'lmp-core' {
  export interface CompileResult {
    midi: Uint8Array;
    warnings?: string[];
    sourceMap?: Map<string, number>;
  }

  export function compile(
    lmpText: string,
    options?: { loose?: boolean; sourceMap?: boolean }
  ): Uint8Array | CompileResult;

  export function decompile(midiBuffer: Uint8Array, options?: any): string;

  const _default: {
    compile: typeof compile;
    decompile: typeof decompile;
  };
  export default _default;
}
