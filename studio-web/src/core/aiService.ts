export type AiProvider = 'gemini' | 'openai';

export interface AiSettings {
  provider: AiProvider;
  geminiApiKey: string;
  geminiModel: string;
  openaiApiKey: string;
  openaiBaseUrl: string;
  openaiModel: string;
}

const STORAGE_KEY = 'lmp_studio_ai_settings';

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

export function extractLmpCode(raw: string): string {
  if (!raw) return '';
  const lmpBlockMatch = raw.match(/```(?:lmp|midi)?\s*([\s\S]*?)```/i);
  if (lmpBlockMatch && lmpBlockMatch[1].trim()) {
    return lmpBlockMatch[1].trim();
  }
  const genericBlockMatch = raw.match(/```\s*([\s\S]*?)```/);
  if (genericBlockMatch && genericBlockMatch[1].trim()) {
    return genericBlockMatch[1].trim();
  }
  const headerMatch = raw.match(/(@(?:LMP|TRACK|BPM|TIMESIG)[\s\S]*)/i);
  if (headerMatch && headerMatch[1].trim()) {
    return headerMatch[1].trim();
  }
  return raw.trim();
}

export const LMP_STUDIO_SYSTEM_INSTRUCTION = `# LMP — Lean Musical Protocol (DAW AI Copilot)

You are an expert music producer and arranger. Your task is to compose expressive MIDI sequences using LMP syntax.

## FORMATTING RULES:
1. Output your generated LMP code inside a single markdown code block: \`\`\`lmp ... \`\`\`
2. Space-separated columns: [Beat] [Pitch/Chord] [Velocity] [Length]
   - In 4/4 meter, a 4-beat bar spans beat 1.0 to 5.0.
   - Column 3 is ALWAYS Velocity (1-127). Column 4 is ALWAYS Duration.
   - If you omit velocity while specifying duration, use '_' in Column 3: '1.0 C4 _ 2.0'.
   - CRITICAL CHORD RULE: In chords, NEVER put spaces after commas! Write '1.0 C4,E4,G4 80 1.0', NOT '1.0 C4, E4, G4'.
3. Headers:
   @LMP 2.0
   @BPM [tempo]
   @TIMESIG [num]/[den]
   @ORIGIN 1
   @TRACK [id] [Name]
   @CHANNEL [1-16] (Use Channel 10 for drums)
4. Drums (Channel 10):
   36=Kick, 38=Acoustic Snare, 40=Electric Snare, 42=Closed Hat, 46=Open Hat, 49=Crash, 51=Ride.

Output clean, playable, musically rich LMP code.`;

async function callGemini(prompt: string, settings: AiSettings, temperature: number = 0.7): Promise<string> {
  const apiKey = settings.geminiApiKey.trim();
  if (!apiKey) throw new Error('Please enter your Google Gemini API key in Settings.');

  const model = settings.geminiModel.trim() || 'gemini-3.5-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: LMP_STUDIO_SYSTEM_INSTRUCTION }] },
    generationConfig: {
      temperature,
      maxOutputTokens: 8192,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let msg = `Gemini API error (${response.status})`;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.error?.message) msg += `: ${parsed.error.message}`;
    } catch {
      msg += `: ${errorText}`;
    }
    throw new Error(msg);
  }

  const json = await response.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callOpenAI(prompt: string, settings: AiSettings, temperature: number = 0.7): Promise<string> {
  const apiKey = settings.openaiApiKey.trim();
  const baseUrl = (settings.openaiBaseUrl.trim() || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = settings.openaiModel.trim() || 'gpt-4o';

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: LMP_STUDIO_SYSTEM_INSTRUCTION },
        { role: 'user', content: prompt },
      ],
      temperature,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const json = await response.json();
  return json.choices?.[0]?.message?.content || '';
}

/**
 * Generates N musical variations concurrently with slight temperature variance for artistic divergence.
 */
export async function generateVariations(options: {
  prompt: string;
  variationCount: number;
  settings: AiSettings;
  mode: 'new' | 'edit';
  currentLmp?: string;
  bpm: number;
  bars: number;
  keyScale: string;
}): Promise<Array<{ title: string; lmpCode: string; rawText: string }>> {
  const { prompt, variationCount, settings, mode, currentLmp, bpm, bars, keyScale } = options;

  const basePrompt =
    mode === 'edit' && currentLmp
      ? `CURRENT PROJECT LMP CODE:
\`\`\`lmp
${currentLmp.trim()}
\`\`\`

USER MUSICAL REQUEST:
${prompt}
Tempo: ${bpm} BPM, Key: ${keyScale}, Bars: ${bars}
Enhance, add a complementary track, or rewrite variations adhering to the context above. Output full playable LMP in \`\`\`lmp code block.`
      : `COMPOSE FROM SCRATCH:
${prompt}
Tempo: ${bpm} BPM, Key: ${keyScale}, Length: ${bars} bars.
Create a complete multi-track groove (Drums, Bass, Harmony/Melody) in \`\`\`lmp code block.`;

  const temperatures = [0.6, 0.75, 0.9, 1.05];
  const promises: Promise<{ title: string; lmpCode: string; rawText: string }>[] = [];

  for (let i = 0; i < variationCount; i++) {
    const temp = temperatures[i % temperatures.length];
    const p = (async () => {
      const variationPrompt = `${basePrompt}\n\n[Make this Variation #${i + 1} with a unique musical flavor, groove phrasing, or syncopation]`;
      const raw =
        settings.provider === 'gemini'
          ? await callGemini(variationPrompt, settings, temp)
          : await callOpenAI(variationPrompt, settings, temp);
      const code = extractLmpCode(raw);
      return {
        title: `Variation ${String.fromCharCode(65 + i)}`, // Variation A, B, C, D
        lmpCode: code,
        rawText: raw,
      };
    })();
    promises.push(p);
  }

  return await Promise.all(promises);
}
