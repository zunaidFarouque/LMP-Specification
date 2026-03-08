import { useState, useEffect, useCallback } from 'react';
import { getWindowLmp } from '../lib/lmp';

export type ParsedMidi = {
  header?: { ticksPerBeat?: number };
  tracks: Array<Array<{ deltaTime?: number; type: string; channel?: number; noteNumber?: number; velocity?: number; text?: string; microsecondsPerBeat?: number }>>;
};

export type SourceMap = Map<string, number>;

type LmpApi = {
  compile: (text: string, opts?: { loose?: boolean; sourceMap?: boolean }) => Uint8Array | { midi: Uint8Array; warnings?: string[]; sourceMap?: SourceMap };
  decompile: (buffer: Uint8Array) => string;
  parseMidi: (buffer: Uint8Array) => ParsedMidi | null;
};

export function useLmpCore() {
  const [lmpApi, setLmpApi] = useState<LmpApi | null>(null);
  const [isReady, setIsReady] = useState(false);

  const loadEsm = useCallback(async () => {
    try {
      const mod = await import('lmp-core');
      if (mod.compile && mod.decompile) {
        setLmpApi({
          compile: mod.compile,
          decompile: mod.decompile,
          parseMidi: (mod.parseMidi ?? (() => null)) as LmpApi['parseMidi'],
        });
        setIsReady(true);
        return true;
      }
    } catch {
      // ESM failed (file:// CORS)
    }
    return false;
  }, []);

  const loadFromWindow = useCallback(() => {
    const w = getWindowLmp();
    if (w?.compile && w?.decompile) {
      setLmpApi({
        compile: w.compile as LmpApi['compile'],
        decompile: w.decompile as LmpApi['decompile'],
        parseMidi: (w.parseMidi ?? (() => null)) as LmpApi['parseMidi'],
      });
      setIsReady(true);
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    loadEsm().then((ok) => {
      if (ok) return;
      if (loadFromWindow()) return;
      // Try cached IIFE (file:// flow)
      const cached = localStorage.getItem('lmp-core-cache');
      if (cached) {
        try {
          const script = document.createElement('script');
          script.textContent = cached;
          document.body.appendChild(script);
          loadFromWindow();
        } catch {
          localStorage.removeItem('lmp-core-cache');
        }
      }
    });
  }, [loadEsm, loadFromWindow]);

  const onLibraryLoaded = useCallback(() => {
    loadFromWindow();
  }, [loadFromWindow]);

  const compile = useCallback(
    (text: string, opts?: { loose?: boolean; sourceMap?: boolean }) => {
      if (!lmpApi) return null;
      const result = lmpApi.compile(text, opts);
      if (opts?.sourceMap && result && typeof result === 'object' && 'midi' in result) {
        return result as { midi: Uint8Array; sourceMap?: SourceMap };
      }
      return result && typeof result === 'object' && 'midi' in result ? result.midi : (result as Uint8Array);
    },
    [lmpApi]
  );

  const decompile = useCallback(
    (buffer: Uint8Array) => {
      if (!lmpApi) return '';
      return lmpApi.decompile(buffer);
    },
    [lmpApi]
  );

  const parseMidi = useCallback(
    (buffer: Uint8Array): ParsedMidi | null => {
      if (!lmpApi?.parseMidi) return null;
      return lmpApi.parseMidi(buffer);
    },
    [lmpApi]
  );

  return {
    isReady,
    compile,
    decompile,
    parseMidi,
    onLibraryLoaded,
    needsLoader: !isReady && typeof window !== 'undefined' && window.location?.protocol === 'file:',
  };
}
