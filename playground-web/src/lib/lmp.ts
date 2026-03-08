/**
 * LMP API wrapper. Uses ESM import when available; falls back to window.LMP when file://
 */

export function getWindowLmp(): { compile: unknown; decompile: unknown; parseMidi?: unknown } | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { LMP?: { compile: unknown; decompile: unknown; parseMidi?: unknown } };
  return w.LMP ?? null;
}
