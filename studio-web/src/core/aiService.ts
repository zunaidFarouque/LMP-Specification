import { soundFontSpecManager, type SpecDocument } from './soundfontSpecManager';
import type { StudioTrack } from './types';

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

export const INDIAN_PERCUSSION_AI_REFERENCE = `
## INDIAN PERCUSSION & TABLA (Fluid Indian Percussion):
When composing or editing Indian percussion rhythms (Channel 10 or Bank 41), you can map and use authentic bols with @MAP:
- Bayān (Bass Drum):
  @MAP Ge=36 (Deep singing resonant open bass, fundamental downbeat)
  @MAP ClsGe=37 (Closed soft bass)
  @MAP Ke=38 (or Ka) (Flat damped palm slap)
  @MAP SldGe=39 (Sliding bass meend)
  @MAP SldGeLong=43 (Extended sliding meend)
- Dayān (Treble Drum):
  @MAP Na=48 (or Ta) (Crisp ringing rim strike / chanti)
  @MAP Tin=50 (or Tun) (Sweet resonant center bell / sur)
  @MAP Te=52 (or Ti) (Dry staccato center tap for tirakita / fast rolls)
  @MAP Tu=53 (Open ringing bell)
  @MAP Re=54 (Subdivision tap)
- Compound Strokes (Both Hands):
  @MAP Dha=60 (Ge 36 + Na 48 - Primary heavy Sam downbeat)
  @MAP Dhin=62 (Ge 36 + Tin 50 - Warm singing combo)
  @MAP Ra=61 (Fast Dayan roll)
  @MAP Tak=64 (Sharp muted cutoff)
- Auxiliary Percussion:
  @MAP Manjeera=69 (Damped metallic click)
  @MAP ManjeeraOpen=70 (Open ringing silver clash)
  @MAP Chimta=71 (Metallic fire-tong jingle accent)

Expression & Meter Guidelines:
- Only declare the @MAP entries you actually use in the track!
- Accent the Sam (Matra 1) with strong velocity (110-125).
- Keep Khali (unstressed Matras) lighter with unaccented Dayan or Ka (vel 70-85).
- In Keherwa (8 Matras in 4/4): 2 bars = 8 beats. Sam at 1.0 (Dha), Khali at 5.0 (Tin/Ka).
- In Teental (16 Matras in 4/4): 4 bars = 16 beats. Sam at 1.0, Khali at 9.0.
- In Roopak (7 Matras): Use @TIMESIG 7/8, 1 bar = 3.5 beats (Tin Tin Na | Dhe Na | Dhe Na).
`;

export function getEffectiveSystemInstruction(context?: {
  currentLmp?: string;
  userPrompt?: string;
  targetTrack?: Partial<StudioTrack> | null;
  selectedSpecId?: string | null;
  targetKit?: 'auto' | 'gm' | 'indian_percussion' | 'trap808';
}): { systemInstruction: string; attachedSpec: SpecDocument | null; reason: string } {
  let attachedSpec: SpecDocument | null = null;
  let reason = '';

  // 1. Resolve from soundfontSpecManager (handles explicit override or track-based auto-matching)
  const matchResult = soundFontSpecManager.matchSpecForTrack(
    context?.targetTrack,
    context?.selectedSpecId
  );
  attachedSpec = matchResult.spec;
  reason = matchResult.reason;

  // 2. If no track was provided but targetKit or prompt keywords imply an instrument
  if (!attachedSpec && context?.selectedSpecId !== 'none') {
    if (context?.targetKit === 'trap808') {
      attachedSpec = soundFontSpecManager.getSpec('spec_gm_drums');
      reason = 'Trap 808 kit selected';
    } else if (context?.targetKit === 'indian_percussion') {
      attachedSpec = soundFontSpecManager.getSpec('spec_tabla');
      reason = 'Indian Percussion default';
    } else if (context?.userPrompt) {
      const p = context.userPrompt.toLowerCase();
      if (p.includes('dholak')) {
        attachedSpec = soundFontSpecManager.getSpec('spec_dholak');
        reason = 'Prompt mentions Dholak';
      } else if (p.includes('khol')) {
        attachedSpec = soundFontSpecManager.getSpec('spec_khol');
        reason = 'Prompt mentions Khol';
      } else if (p.includes('mridangam')) {
        attachedSpec = soundFontSpecManager.getSpec('spec_mridangam');
        reason = 'Prompt mentions Mridangam';
      } else if (p.includes('pakhawaj')) {
        attachedSpec = soundFontSpecManager.getSpec('spec_pakhawaj');
        reason = 'Prompt mentions Pakhawaj';
      } else if (p.includes('kanjeera') || p.includes('ghatam')) {
        attachedSpec = soundFontSpecManager.getSpec('spec_kanjeera_ghatam');
        reason = 'Prompt mentions Kanjeera / Ghatam';
      } else if (p.includes('tabla') || p.includes('teental') || p.includes('keherwa') || p.includes('bol')) {
        attachedSpec = soundFontSpecManager.getSpec('spec_tabla');
        reason = 'Prompt mentions Tabla / Indian bols';
      } else if (context?.targetKit === 'gm' || p.includes('drum') || p.includes('beat') || p.includes('groove')) {
        attachedSpec = soundFontSpecManager.getSpec('spec_gm_drums');
        reason = 'Percussion groove requested';
      }
    }
  }

  // 3. Construct system prompt: CORE LMP + ONLY the targeted instrument specification
  let promptText = LMP_STUDIO_SYSTEM_INSTRUCTION;
  if (attachedSpec) {
    promptText += `\n\n## ATTACHED INSTRUMENT SPECIFICATION: ${attachedSpec.title} (${attachedSpec.fileName})\n${attachedSpec.content}`;
  }

  return {
    systemInstruction: promptText,
    attachedSpec,
    reason,
  };
}

async function callGemini(
  prompt: string,
  settings: AiSettings,
  temperature: number = 0.7,
  systemPrompt: string = LMP_STUDIO_SYSTEM_INSTRUCTION
): Promise<string> {
  const apiKey = settings.geminiApiKey.trim();
  if (!apiKey) throw new Error('Please enter your Google Gemini API key in Settings.');

  const model = settings.geminiModel.trim() || 'gemini-3.5-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
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

async function callOpenAI(
  prompt: string,
  settings: AiSettings,
  temperature: number = 0.7,
  systemPrompt: string = LMP_STUDIO_SYSTEM_INSTRUCTION
): Promise<string> {
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
        { role: 'system', content: systemPrompt },
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
  targetKit?: 'auto' | 'gm' | 'indian_percussion' | 'trap808';
  targetTrackId?: 'all' | number | 'new';
  targetTrack?: StudioTrack | null;
  selectedSpecId?: string | null;
  trackName?: string;
}): Promise<Array<{ title: string; lmpCode: string; rawText: string }>> {
  const {
    prompt,
    variationCount,
    settings,
    mode,
    currentLmp,
    bpm,
    bars,
    keyScale,
    targetKit = 'auto',
    targetTrackId = 'all',
    targetTrack,
    selectedSpecId,
    trackName,
  } = options;

  let kitGuidance = '';
  if (targetKit === 'indian_percussion') {
    kitGuidance = '\n[KIT REQUIREMENT: Use Indian Percussion with @SF2 Fluid_Indian_Percussion on Channel 10 and declare only used @MAP bols like Dha=60, Ge=36, Na=48, Tin=50, Ka=38 (or use raw MIDI integers 36, 48, 60)].';
  } else if (targetKit === 'gm') {
    kitGuidance = '\n[KIT REQUIREMENT: Use General MIDI with standard Channel 10 GM drum notes: 36=Kick, 38=Snare, 42=Closed Hat, 46=Open Hat].';
  } else if (targetKit === 'trap808') {
    kitGuidance = '\n[KIT REQUIREMENT: Use 808 Trap drum kit on Channel 10 with declared @MAP sub_kick=36, @MAP snare=38, @MAP closed_hat=42].';
  }

  let trackFocusGuidance = '';
  if (targetTrackId === 'new') {
    trackFocusGuidance = '\n[TARGET: Create a complementary new track to add to the song. Output starting with @TRACK ...].';
  } else if (typeof targetTrackId === 'number') {
    trackFocusGuidance = `\n[TARGET: Generate/update ONLY Track ${targetTrackId}${trackName ? ` (${trackName})` : ''}. Output starting with @TRACK ${targetTrackId} ... keeping the rest of the song context in mind].`;
  }

  const basePrompt =
    mode === 'edit' && currentLmp
      ? `CURRENT PROJECT LMP CODE:
\`\`\`lmp
${currentLmp.trim()}
\`\`\`

USER MUSICAL REQUEST:
${prompt}
Tempo: ${bpm} BPM, Key: ${keyScale}, Bars: ${bars}${kitGuidance}${trackFocusGuidance}
Enhance, add a complementary track, or rewrite variations adhering to the context above. Output full playable LMP in \`\`\`lmp code block.`
      : `COMPOSE FROM SCRATCH:
${prompt}
Tempo: ${bpm} BPM, Key: ${keyScale}, Length: ${bars} bars.${kitGuidance}${trackFocusGuidance}
Create a complete multi-track groove (Drums, Bass, Harmony/Melody) in \`\`\`lmp code block.`;

  const temperatures = [0.6, 0.75, 0.9, 1.05];
  const promises: Promise<{ title: string; lmpCode: string; rawText: string }>[] = [];
  const effectivePromptResult = getEffectiveSystemInstruction({
    currentLmp,
    userPrompt: prompt,
    targetTrack,
    selectedSpecId,
    targetKit,
  });
  const effectiveSystemPrompt = effectivePromptResult.systemInstruction;

  for (let i = 0; i < variationCount; i++) {
    const temp = temperatures[i % temperatures.length];
    const p = (async () => {
      const variationPrompt = `${basePrompt}\n\n[Make this Variation #${i + 1} with a unique musical flavor, groove phrasing, or syncopation]`;
      const raw =
        settings.provider === 'gemini'
          ? await callGemini(variationPrompt, settings, temp, effectiveSystemPrompt)
          : await callOpenAI(variationPrompt, settings, temp, effectiveSystemPrompt);
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
