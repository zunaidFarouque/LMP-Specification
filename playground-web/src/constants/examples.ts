// Templates: minimal starting points for new tracks/projects
export const TEMPLATES = {
  blank_piano: `// Single piano track — add chords, melody, or bass
@LMP 1.0
@BPM 120
@TRACK 1 Piano
@CHANNEL 1
@PROGRAM 0
@DEFAULT_VEL 80
@DEFAULT_DUR 1.0

1.0 C4
`,
  blank_drums: `// Single drum track — add kick, snare, hi-hat patterns
@LMP 1.0
@BPM 120
@TRACK 1 Drums
@CHANNEL 10
@DEFAULT_VEL 90
@DEFAULT_DUR 0.25

1.0 36
`,
  blank_multi: `// Piano + Drums — two tracks ready for arrangement
@LMP 1.0
@BPM 120
@TRACK 1 Piano
@CHANNEL 1
@PROGRAM 0
@DEFAULT_VEL 80
@DEFAULT_DUR 1.0

1.0 C4

@TRACK 2 Drums
@CHANNEL 10
@DEFAULT_VEL 90
@DEFAULT_DUR 0.25

1.0 36
`,
  minimal_headers: `// Headers only — minimal structure, add your events below
@LMP 1.0
@BPM 120
@TIMESIG 4/4
@TRACK 1 Track_Name
@CHANNEL 1

1.0 C4
`,
} as const;

// Examples: showcase protocol capabilities
export const EXAMPLES = {
  minimal: `@LMP 1.0
@BPM 120
@TRACK 1 Test
@CHANNEL 1

1.0 C4
`,
  chords: `@LMP 1.0
@BPM 120
@TRACK 1 Piano_Chords
@CHANNEL 1
@PROGRAM 0
@DEFAULT_VEL 80
@DEFAULT_DUR 1.0

// Block Chords
1.0 C4,E4,G4
2.0 D4,F4,A4 95
3.0 C4,E4,G4 _ 2.0

@TRACK 2 Solo_Flute
@CHANNEL 2
@PROGRAM 73
@DEFAULT_VEL 90
@RULE LEGATO=TRUE

1.0 C5
1.5 D5
2.0 E5
3.0 C5 _ 2.0
`,
  drums: `@LMP 1.0
@BPM 120
@TRACK 1 Drums
@CHANNEL 10
@DEFAULT_VEL 90
@DEFAULT_DUR 0.25

1.0 36,42
1.25 42
1.5 36,42
1.75 42
2.0 36,38,42
2.25 42
2.5 36,42
2.75 42
`,
  repeating_velocity: `@LMP 1.0
@BPM 110
@TRACK 1 Drum_Kit
@CHANNEL 10
@DEFAULT_DUR 0.25
@DEFAULT_VEL 100
@RULE 42 VEL=70-85
@RULE 38 VEL=105-115

1.0-5.0:1/2 42
1.0 36 110
2.0 38
2.75 36 80
3.0 36 110
4.0 38
4.75 38 40
`,
  custom_map: `@LMP 1.0
@BPM 90
@TRACK 1 Indian_Tabla
@CHANNEL 10
@DEFAULT_DUR 0.25
@DEFAULT_VEL 95

@MAP dha=84
@MAP ge=36
@MAP te=70
@MAP ne=50

1.0 dha 110
1.5 ge _ 0.5
2.0 te
2.5 ge
3.0 dha 110
3.5 ne
4.0 te,ge
`,
  voice_leading: `@LMP 1.0
@BPM 100
@TRACK 1 Piano
@CHANNEL 1
@PROGRAM 0
@DEFAULT_VEL 85
@DEFAULT_DUR 1.0

1.0 C2 _ 4.0
+ C4,E4,G4 _ 2.0
2.0 D2 _ 4.0
+ D4,F4,A4 _ 2.0
4.0 C2 _ 4.0
+ C4,E4,G4 _ 2.0
`,
  repeating_modifiers: `@LMP 1.0
@BPM 120
@TRACK 1 Drums
@CHANNEL 10
@DEFAULT_DUR 0.25
@DEFAULT_VEL 90

1.0-5.0:1/2 42
| R 2.0 4.0
| V [1.0 3.0] 110

1.0 36 110
3.0 36 110
`,
  control_change: `@LMP 1.0
@BPM 120
@TRACK 1 Piano
@CHANNEL 1
@PROGRAM 0
@DEFAULT_VEL 80
@DEFAULT_DUR 1.0

1.0 CC 64 127
1.0 C4,E4,G4
2.0 D4,F4,A4
3.0 CC 64 0
3.0 C4,E4,G4 _ 2.0
`,
  pitch_bend: `@LMP 1.0
@BPM 120
@TRACK 1 Lead
@CHANNEL 1
@PROGRAM 81
@PBRANGE 12
@DEFAULT_VEL 90
@DEFAULT_DUR 0.5

1.0 C5
1.5 PB 1.0
2.0 E5
2.5 PB 0.0
3.0 C5 _ 1.0
`,
  tempo_timesig: `@LMP 1.0
@BPM 120
@TRACK 1 Piano
@CHANNEL 1
@PROGRAM 0
@DEFAULT_VEL 80
@DEFAULT_DUR 1.0

1.0 C4
2.0 D4
4.0 E4
8.0 TEMPO 90.0
8.0 C4
12.0 TS 3 4
12.0 F4 _ 2.0
`,
  rest: `@LMP 1.0
@BPM 120
@TRACK 1 Melody
@CHANNEL 1
@PROGRAM 0
@DEFAULT_VEL 85
@DEFAULT_DUR 0.5

1.0 C4
1.5 D4
2.0 R
2.5 E4
3.0 F4
3.5 R
4.0 G4 _ 1.0
`,
  inherit: `@LMP 1.0
@BPM 120
@TRACK 1 Piano_LH
@CHANNEL 1
@PROGRAM 0
@DEFAULT_VEL 80
@DEFAULT_DUR 1.0

1.0 C2 _ 4.0
2.0 D2 _ 2.0
4.0 C2 _ 4.0

@TRACK 2 Piano_RH @INHERIT 1
@CHANNEL 1
1.0 C4,E4,G4
2.0 D4,F4,A4
4.0 C4,E4,G4 _ 2.0
`,
} as const;
