// System prompts and prompt builders for LMP AI Composer

export const LMP_SYSTEM_INSTRUCTION = `# LMP — Lean Musical Protocol (AI Music Generation)

You are an expert music producer, composer, and music theorist. Your task is to compose expressive MIDI sequences using LMP (Lean Musical Protocol) syntax.

## CRITICAL FORMATTING & SYNTAX RULES:
1. Output your generated LMP code inside a single markdown code block: \`\`\`lmp ... \`\`\`
2. Space-separated columns: [Beat] [Pitch/Chord] [Velocity] [Length]
   - Beat: 1.0 = beat 1, 2.0 = beat 2. In 4/4 meter, a 4-beat bar spans 1.0 to 5.0.
   - Column 3 is ALWAYS Velocity (1-127). Column 4 is ALWAYS Duration.
   - CRITICAL: If you omit velocity while specifying duration, use '_' in Column 3: '1.0 C4 _ 2.0'.
   - CRITICAL CHORD RULE: In chords, NEVER put spaces after commas! Write '1.0 C4,E4,G4 80 1.0', NOT '1.0 C4, E4, G4'.
3. Headers:
   @LMP 2.0
   @BPM [tempo]
   @TIMESIG [num]/[den]
   @ORIGIN 1
   @TRACK [id] [Name]
   @CHANNEL [1-16] (Use Channel 10 for drums)
4. Modifiers & Repeats:
   - Repeating: '1.0-5.0:1/2 42' (Closed hi-hat 8th notes from beat 1 to 5)
   - Modifiers on repeats: '| V [1.0 3.0] 110' (Accent beats 1 and 3)
   - Pitch bend: '1.0 PB 1.0' (bend up 1 semitone) or 'PB 0.0' (center)
   - Expression/Sustain: '1.0 CC 64 127' (sustain down), '1.0 CC 11 100' (expression swell)
5. Drums (Channel 10):
   36=Kick, 38=Acoustic Snare, 40=Electric Snare, 42=Closed Hat, 46=Open Hat, 49=Crash, 51=Ride.
   Use ghost notes (velocity 35-50) and accents (velocity 100-120) for human groove!

Output clean, playable, musically rich LMP code.`;

export type GenerationMode = 'new' | 'layer' | 'transform';

export function buildUserPrompt(options: {
  prompt: string;
  mode: GenerationMode;
  loopBars: number;
  bpm: number;
  keyScale: string;
  genreName?: string;
  currentLmp?: string;
}): string {
  const { prompt, mode, loopBars, bpm, keyScale, genreName, currentLmp } = options;

  if (mode === 'layer' && currentLmp) {
    return `Here is my current LMP musical composition:
\`\`\`lmp
${currentLmp.trim()}
\`\`\`

USER REQUEST:
Add a complementary new track (e.g., matching bassline, rhythmic drum groove, or counter-melody) that harmonizes with the tracks above.
Genre / Style: ${genreName || 'Complementary'}
Key/Scale: ${keyScale}
Tempo: ${bpm} BPM
Loop length: ${loopBars} bars
User instructions: ${prompt}

Output the FULL composition including existing tracks plus your new complementary track in \`\`\`lmp code block.`;
  }

  if (mode === 'transform' && currentLmp) {
    return `Here is my current LMP musical piece:
\`\`\`lmp
${currentLmp.trim()}
\`\`\`

USER REQUEST:
Transform, humanize, and enhance this composition:
- Add dynamic velocity variations and accents (| V)
- Add expressive pitch bends (PB) or CC automation (e.g. CC 11, CC 64)
- Tighten voice leading or embellish with passing notes
Key/Scale: ${keyScale}
User instructions: ${prompt}

Output the enhanced composition in a \`\`\`lmp code block.`;
  }

  // Default: New composition
  return `Create a complete, loopable ${loopBars}-bar musical composition in LMP format.

Genre / Style: ${genreName || 'Custom'}
Key / Scale: ${keyScale}
Tempo: ${bpm} BPM
Loop Length: ${loopBars} bars (e.g. in 4/4 meter, ${loopBars} bars = beat 1.0 to ${loopBars * 4 + 1}.0)
Description & Details: ${prompt}

Requirements:
- Multi-track arrangement (e.g. Drums on Channel 10, Bass on Channel 1/2, Chords/Melody on Channel 3/4).
- Use dynamic velocities, groove, and syncopation.
- Make it seamlessly loopable.
- Enclose the final LMP code in a \`\`\`lmp ... \`\`\` markdown code block.`;
}
