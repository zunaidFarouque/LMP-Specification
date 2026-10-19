/**
 * LMP-Bench Corpus: Standardized musical compositions across diverse genres and idioms
 */

export const BENCHMARK_CORPUS = [
  {
    id: 'pop-chords-lead',
    title: 'Pop Progression & Vocal Lead',
    genre: 'Pop',
    timeSignature: '4/4',
    bpm: 120,
    lmp: `@LMP 1.0
@BPM 120
@TIMESIG 4/4
@TRACK 1 Piano_Chords
@CHANNEL 1
@PROGRAM 0
@DEFAULT_VEL 85
@DEFAULT_DUR 1.0

1.0 C4,E4,G4
2.0 G3,B3,D4
3.0 A3,C4,E4
4.0 F3,A3,C4
5.0 C4,E4,G4 _ 2.0
7.0 G3,B3,D4 _ 2.0

@TRACK 2 Vocal_Lead
@CHANNEL 2
@PROGRAM 54
@DEFAULT_VEL 95
@RULE LEGATO=TRUE

1.0 G4
1.75 A4
2.0 B4
2.5 C5
3.0 A4 _ 1.0
4.0 F4
4.5 G4
5.0 E4 _ 2.0
7.0 D4 _ 2.0
`
  },
  {
    id: 'edm-club-groove',
    title: 'EDM Four-on-the-Floor with Rolling Hi-Hats',
    genre: 'Electronic',
    timeSignature: '4/4',
    bpm: 128,
    lmp: `@LMP 1.0
@BPM 128
@TIMESIG 4/4
@TRACK 1 Drums
@CHANNEL 10
@DEFAULT_DUR 0.25
@DEFAULT_VEL 100
@RULE 42 VEL=75-90

// Four-on-the-floor kick & backbeat snare
1.0 36 120
2.0 38 115
3.0 36 118
4.0 38 115
5.0 36 120
6.0 38 115
7.0 36 118
8.0 38 115

// Rolling 16th-note closed hi-hats with accents on offbeats
1.0-9.0:1/4 42
| V [1.5 2.5 3.5 4.5 5.5 6.5 7.5 8.5] 110

@TRACK 2 Acid_Bass
@CHANNEL 1
@PROGRAM 38
@DEFAULT_VEL 105
@DEFAULT_DUR 0.5

1.0 C2
1.5 C2
2.0 Eb2
2.5 F2
3.0 G2
3.5 Bb2
4.0 C3
4.5 Bb2
5.0 C2 _ 1.0
`
  },
  {
    id: 'classical-invention',
    title: 'Bach Two-Part Polyphonic Invention',
    genre: 'Classical',
    timeSignature: '4/4',
    bpm: 96,
    lmp: `@LMP 1.0
@BPM 96
@TIMESIG 4/4
@TRACK 1 Upper_Voice
@CHANNEL 1
@PROGRAM 6
@DEFAULT_VEL 80
@DEFAULT_DUR 0.5

1.0 C4
1.5 D4
2.0 E4
2.5 F4
3.0 G4
3.5 E4
4.0 C4
4.5 G4
5.0 A4
5.5 G4
6.0 F4
6.5 E4
7.0 D4 _ 1.0
8.0 C4 _ 1.0

@TRACK 2 Lower_Voice
@CHANNEL 2
@PROGRAM 6
@DEFAULT_VEL 80
@DEFAULT_DUR 0.5

1.0 R
3.0 C3
3.5 D3
4.0 E3
4.5 F3
5.0 G3
5.5 E3
6.0 C3
6.5 G3
7.0 F3 _ 1.0
8.0 E3 _ 1.0
`
  },
  {
    id: 'jazz-blues-comping',
    title: 'Jazz Blues Swing & Syncopated Comping',
    genre: 'Jazz',
    timeSignature: '4/4',
    bpm: 140,
    lmp: `@LMP 1.0
@BPM 140
@TIMESIG 4/4
@TRACK 1 Piano_Comping
@CHANNEL 1
@PROGRAM 0
@DEFAULT_VEL 85
@DEFAULT_DUR 0.5

1.0 C3,E3,G3,Bb3
2.5 C3,E3,G3,Bb3 _ 0.75
3.667 F3,A3,C4,Eb4
4.5 F3,A3,C4,Eb4 _ 0.5
5.0 C3,E3,G3,Bb3
6.5 G3,B3,D4,F4 _ 0.75
7.667 C3,E3,G3,Bb3 _ 1.333

@TRACK 2 Walking_Bass
@CHANNEL 2
@PROGRAM 32
@DEFAULT_VEL 95
@DEFAULT_DUR 0.95

1.0 C2
2.0 E2
3.0 G2
4.0 A2
5.0 Bb2
6.0 A2
7.0 Ab2
8.0 G2
`
  },
  {
    id: 'tabla-keherwa-groove',
    title: 'Indian Classical Tabla (Keherwa Taal)',
    genre: 'World / Indian',
    timeSignature: '4/4',
    bpm: 92,
    lmp: `@LMP 1.0
@BPM 92
@TIMESIG 4/4
@SEED 108
@TRACK 1 Tabla
@CHANNEL 10
@DEFAULT_DUR 0.25
@DEFAULT_VEL 95

@MAP dha_sam=84
@MAP ge_open=36
@MAP ne_kinar=50
@MAP te_center=71
@MAP ka_closed=24
@MAP dhin_res=88

@RULE ge_open VEL=65-80
@RULE ne_kinar VEL=80-92

// Vibhag 1: Sam (Heavy)
1.0 dha_sam 115
2.0 ge_open
3.0 ne_kinar
4.0 te_center

// Vibhag 2: Khali (Empty)
5.0 ne_kinar
6.0 ka_closed 75
7.0 dhin_res 105
8.0 ne_kinar
`
  },
  {
    id: 'metal-polyrhythm-seven-eight',
    title: 'Polyrhythmic Metal (7/8 Meter)',
    genre: 'Metal / Progressive',
    timeSignature: '7/8',
    bpm: 160,
    lmp: `@LMP 1.0
@BPM 160
@TIMESIG 7/8
@TRACK 1 Drums
@CHANNEL 10
@DEFAULT_DUR 0.25
@DEFAULT_VEL 110

// 7/8 bar spans 3.5 quarter-note beats (2 + 2 + 3 grouping)
1.0 36 125
1.5 36 120
2.0 38 127
2.5 36 120
3.0 36 125
3.25 36 120

// China cymbals and accent hats
1.0 49 120
2.0 42 100
3.0 49 120

@TRACK 2 Down_Tuned_Riff
@CHANNEL 1
@PROGRAM 30
@DEFAULT_VEL 115
@DEFAULT_DUR 0.25

1.0 D1
1.25 D1
1.5 D1
2.0 F1 _ 0.5
2.5 D1
3.0 G#1 _ 0.5
`
  },
  {
    id: 'ambient-expression-drone',
    title: 'Ambient Soundscape with CC & Pitch Bend',
    genre: 'Ambient',
    timeSignature: '4/4',
    bpm: 65,
    lmp: `@LMP 1.0
@BPM 65
@TIMESIG 4/4
@TRACK 1 Synth_Drone
@CHANNEL 1
@PROGRAM 89
@DEFAULT_VEL 70
@PBRANGE 12

// Sustain pedal down
1.0 CC 64 127
// Expression swell
1.0 CC 11 40
2.0 CC 11 80
3.0 CC 11 115
4.0 CC 11 60

// Pitch bend upwards into next measure
1.0 PB 0.0
2.5 PB 2.0
3.5 PB 5.0
4.0 PB 7.0

1.0 C3,G3,D4 _ 4.0
5.0 E3,B3,F#4 _ 4.0
`
  }
];
