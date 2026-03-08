import { useRef } from 'react';

const CACHE_KEY = 'lmp-core-cache';

type Props = {
  onLoaded: () => void;
};

export function LibraryLoader({ onLoaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      localStorage.setItem(CACHE_KEY, content);
      const script = document.createElement('script');
      script.textContent = content;
      document.body.appendChild(script);
      onLoaded();
    } catch (err) {
      alert('Failed to load: ' + ((err as Error)?.message ?? String(err)));
    }
    e.target.value = '';
  };

  const handleClearCache = (e: React.MouseEvent) => {
    e.preventDefault();
    localStorage.removeItem(CACHE_KEY);
    location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f1419]/95">
      <div className="text-center max-w-md px-6">
        <h1 className="text-2xl font-bold mb-4">LMP Playground</h1>
        <p className="text-slate-400 mb-6">
          Load the LMP library to get started. Select{' '}
          <code className="bg-slate-800 px-1.5 py-0.5 rounded text-sm">lmp-core.v1.iife.min.js</code>
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".js"
          className="hidden"
          onChange={handleLoad}
        />
        <button
          onClick={() => inputRef.current?.click()}
          className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold px-6 py-3 rounded-lg transition-colors"
        >
          Load LMP library
        </button>
        <p className="mt-4 text-sm text-slate-500">
          <a href="#" onClick={handleClearCache} className="text-slate-400 hover:text-slate-300">
            Clear cache
          </a>
        </p>
      </div>
    </div>
  );
}
