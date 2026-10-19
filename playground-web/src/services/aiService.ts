export type AiProvider = 'gemini' | 'openai';

export interface AiSettings {
  provider: AiProvider;
  geminiApiKey: string;
  geminiModel: string;
  openaiApiKey: string;
  openaiBaseUrl: string;
  openaiModel: string;
}

const STORAGE_KEY = 'lmp_playground_ai_settings';

export const DEFAULT_SETTINGS: AiSettings = {
  provider: 'gemini',
  geminiApiKey: '',
  geminiModel: 'gemini-3.5-flash-lite',
  openaiApiKey: '',
  openaiBaseUrl: 'https://api.openai.com/v1',
  openaiModel: 'gpt-4o',
};

export function loadAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    const loaded = { ...DEFAULT_SETTINGS, ...parsed };
    // Upgrade legacy default to gemini-3.5-flash-lite
    if (loaded.geminiModel === 'gemini-2.5-flash') {
      loaded.geminiModel = 'gemini-3.5-flash-lite';
    }
    return loaded;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveAiSettings(settings: AiSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save AI settings to localStorage', err);
  }
}

export interface GenerateOptions {
  prompt: string;
  systemInstruction: string;
  settings: AiSettings;
  signal?: AbortSignal;
  onChunk?: (accumulatedText: string) => void;
}

/**
 * Extracts pure LMP code from LLM markdown response.
 */
export function extractLmpCode(raw: string): string {
  if (!raw) return '';

  // 1. Look for ```lmp ... ```
  const lmpBlockMatch = raw.match(/```(?:lmp|midi)?\s*([\s\S]*?)```/i);
  if (lmpBlockMatch && lmpBlockMatch[1].trim()) {
    return lmpBlockMatch[1].trim();
  }

  // 2. Look for any code block ``` ... ```
  const genericBlockMatch = raw.match(/```\s*([\s\S]*?)```/);
  if (genericBlockMatch && genericBlockMatch[1].trim()) {
    return genericBlockMatch[1].trim();
  }

  // 3. If no code blocks, look for where @LMP, @TRACK, or @BPM starts
  const headerMatch = raw.match(/(@(?:LMP|TRACK|BPM|TIMESIG)[\s\S]*)/i);
  if (headerMatch && headerMatch[1].trim()) {
    return headerMatch[1].trim();
  }

  return raw.trim();
}

/**
 * Generate music via Google Gemini REST API (Supports streaming SSE).
 */
async function generateGemini(options: GenerateOptions): Promise<string> {
  const { prompt, systemInstruction, settings, signal, onChunk } = options;
  const apiKey = settings.geminiApiKey.trim();
  if (!apiKey) {
    throw new Error('Please enter your Google Gemini API key in Settings.');
  }

  const model = settings.geminiModel.trim() || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let msg = `Gemini API error (${response.status})`;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.error?.message) {
        msg += `: ${parsed.error.message}`;
      }
    } catch {
      msg += `: ${errorText}`;
    }
    throw new Error(msg);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Unable to read Gemini response stream.');
  }

  const decoder = new TextDecoder('utf-8');
  let accumulated = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const jsonStr = trimmed.slice(6);
      if (jsonStr === '[DONE]') continue;

      try {
        const parsed = JSON.parse(jsonStr);
        const textChunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textChunk) {
          accumulated += textChunk;
          onChunk?.(accumulated);
        }
      } catch {
        // Skip unparseable chunks
      }
    }
  }

  return accumulated;
}

/**
 * Generate music via OpenAI / OpenRouter / Ollama-compatible REST API.
 */
async function generateOpenAI(options: GenerateOptions): Promise<string> {
  const { prompt, systemInstruction, settings, signal, onChunk } = options;
  const apiKey = settings.openaiApiKey.trim();
  const baseUrl = (settings.openaiBaseUrl.trim() || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = settings.openaiModel.trim() || 'gpt-4o';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const url = `${baseUrl}/chat/completions`;
  const body = {
    model,
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    stream: true,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let msg = `OpenAI API error (${response.status})`;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.error?.message) {
        msg += `: ${parsed.error.message}`;
      }
    } catch {
      msg += `: ${errorText}`;
    }
    throw new Error(msg);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Unable to read OpenAI response stream.');
  }

  const decoder = new TextDecoder('utf-8');
  let accumulated = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const jsonStr = trimmed.slice(6);
      if (jsonStr === '[DONE]') continue;

      try {
        const parsed = JSON.parse(jsonStr);
        const textChunk = parsed.choices?.[0]?.delta?.content;
        if (textChunk) {
          accumulated += textChunk;
          onChunk?.(accumulated);
        }
      } catch {
        // Skip unparseable chunks
      }
    }
  }

  return accumulated;
}

/**
 * Universal Generate Dispatcher
 */
export async function generateLmpMusic(options: GenerateOptions): Promise<{ rawText: string; lmpCode: string }> {
  const provider = options.settings.provider;
  let rawText = '';

  if (provider === 'gemini') {
    rawText = await generateGemini(options);
  } else if (provider === 'openai') {
    rawText = await generateOpenAI(options);
  } else {
    throw new Error(`Unsupported AI provider: ${provider}`);
  }

  const lmpCode = extractLmpCode(rawText);
  return { rawText, lmpCode };
}
