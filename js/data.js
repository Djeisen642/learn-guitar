// Chord + curriculum data.
//
// frets/fingers arrays are ordered LOW E (6th string) -> HIGH E (1st string).
//   frets:   -1 = muted, 0 = open, n = fret number relative to baseFret
//   fingers:  0 = none/open, 1 = index ... 4 = pinky
//   barres:  [{ fret, from, to }] where from/to are string indices (0 = low E)

export const CHORDS = [
  // --- open majors -------------------------------------------------------
  {
    id: 'A', name: 'A', full: 'A major', group: 'Major',
    frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0],
    tip: 'Three fingers crammed into one fret. Keep them tucked right behind the 2nd fret wire and arch your knuckles so the high E rings.',
  },
  {
    id: 'C', name: 'C', full: 'C major', group: 'Major',
    frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0],
    tip: 'Anchor the 3rd finger on the A string first — the other two fall into place under it.',
  },
  {
    id: 'D', name: 'D', full: 'D major', group: 'Major',
    frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2],
    tip: 'A tight little triangle. Only strum the bottom four strings.',
  },
  {
    id: 'E', name: 'E', full: 'E major', group: 'Major',
    frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0],
    tip: 'All six strings ring. Learn this shape well — it becomes the F barre chord later.',
  },
  {
    id: 'G', name: 'G', full: 'G major', group: 'Major',
    frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3],
    tip: 'The classic 3-finger G. Using fingers 2-1-3 (not 1-2-3) makes the change to C and D much easier.',
  },
  {
    id: 'G4', name: 'G', full: 'G major (4-finger)', group: 'Major',
    frets: [3, 2, 0, 0, 3, 3], fingers: [2, 1, 0, 0, 3, 4],
    tip: 'Big, full-sounding G. Pairs perfectly with Cadd9 and Dsus4 — you only move two fingers between them.',
  },
  {
    id: 'F', name: 'F', full: 'F major (full barre)', group: 'Major',
    frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1],
    barres: [{ fret: 1, from: 0, to: 5 }],
    tip: 'The wall every beginner hits. Roll the index finger onto its bony outside edge and pull the elbow in toward your body.',
  },
  {
    id: 'Fmini', name: 'F', full: 'F major (easy 4-string)', group: 'Major',
    frets: [-1, -1, 3, 2, 1, 1], fingers: [0, 0, 3, 2, 1, 1],
    barres: [{ fret: 1, from: 4, to: 5 }],
    tip: 'Use this until the full barre is comfortable. Index bars only the top two strings; ignore the two lowest strings.',
  },
  {
    id: 'B', name: 'B', full: 'B major (barre)', group: 'Major',
    frets: [-1, 2, 4, 4, 4, 2], fingers: [0, 1, 3, 3, 3, 1],
    barres: [{ fret: 2, from: 1, to: 5 }, { fret: 4, from: 2, to: 4 }],
    tip: 'Two barres at once. If the high E buzzes, it is fine to mute it and strum four strings.',
  },

  // --- open minors -------------------------------------------------------
  {
    id: 'Am', name: 'Am', full: 'A minor', group: 'Minor',
    frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0],
    tip: 'The same shape as E major, moved down one string. Spot that and you get it for free.',
  },
  {
    id: 'Em', name: 'Em', full: 'E minor', group: 'Minor',
    frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0],
    tip: 'Two fingers, all six strings. The best first chord on the guitar.',
  },
  {
    id: 'Dm', name: 'Dm', full: 'D minor', group: 'Minor',
    frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1],
    tip: 'Get the 3rd finger right up against the fret — it is the one that usually buzzes.',
  },
  {
    id: 'Bm', name: 'Bm', full: 'B minor (barre)', group: 'Minor',
    frets: [-1, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1],
    barres: [{ fret: 2, from: 1, to: 5 }],
    tip: 'Am shape plus an index barre at fret 2. Easier than F because you only barre five strings.',
  },

  // --- sevenths ----------------------------------------------------------
  {
    id: 'E7', name: 'E7', full: 'E dominant 7th', group: '7th',
    frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0],
    tip: 'E major with one finger lifted. Instant bluesy flavour.',
  },
  {
    id: 'A7', name: 'A7', full: 'A dominant 7th', group: '7th',
    frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0],
    tip: 'Two fingers. Great stepping stone while the full A shape is still cramped.',
  },
  {
    id: 'D7', name: 'D7', full: 'D dominant 7th', group: '7th',
    frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3],
    tip: 'The D triangle turned upside down. Bottom four strings only.',
  },
  {
    id: 'G7', name: 'G7', full: 'G dominant 7th', group: '7th',
    frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1],
    tip: 'G with the high E moved to fret 1. Pulls hard toward C.',
  },
  {
    id: 'C7', name: 'C7', full: 'C dominant 7th', group: '7th',
    frets: [-1, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0],
    tip: 'C plus the pinky. Essential for 12-bar blues in C.',
  },
  {
    id: 'B7', name: 'B7', full: 'B dominant 7th', group: '7th',
    frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4],
    tip: 'Four fingers, awkward at first. It is the classic turnaround back to E.',
  },
  {
    id: 'Am7', name: 'Am7', full: 'A minor 7th', group: '7th',
    frets: [-1, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0],
    tip: 'Am with the G string opened up. Soft and floaty.',
  },
  {
    id: 'Em7', name: 'Em7', full: 'E minor 7th', group: '7th',
    frets: [0, 2, 0, 0, 0, 0], fingers: [0, 2, 0, 0, 0, 0],
    tip: 'One finger, six strings. Use it as a rest stop mid-song.',
  },
  {
    id: 'Dm7', name: 'Dm7', full: 'D minor 7th', group: '7th',
    frets: [-1, -1, 0, 2, 1, 1], fingers: [0, 0, 0, 3, 1, 1],
    barres: [{ fret: 1, from: 4, to: 5 }],
    tip: 'A mini barre with the index across the top two strings.',
  },
  {
    id: 'Cmaj7', name: 'Cmaj7', full: 'C major 7th', group: '7th',
    frets: [-1, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0],
    tip: 'C with the index lifted. Two fingers, very dreamy.',
  },
  {
    id: 'Fmaj7', name: 'Fmaj7', full: 'F major 7th', group: '7th',
    frets: [-1, -1, 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0],
    tip: 'Often substitutes for F in a beginner song. No barre required.',
  },

  // --- colour chords -----------------------------------------------------
  {
    id: 'Asus2', name: 'Asus2', full: 'A suspended 2nd', group: 'Sus / add',
    frets: [-1, 0, 2, 2, 0, 0], fingers: [0, 0, 1, 2, 0, 0],
    tip: 'A with the index lifted off the B string. Lift and drop it while strumming for instant texture.',
  },
  {
    id: 'Asus4', name: 'Asus4', full: 'A suspended 4th', group: 'Sus / add',
    frets: [-1, 0, 2, 2, 3, 0], fingers: [0, 0, 1, 2, 3, 0],
    tip: 'Add the ring finger to A. Alternate A → Asus4 → A.',
  },
  {
    id: 'Dsus2', name: 'Dsus2', full: 'D suspended 2nd', group: 'Sus / add',
    frets: [-1, -1, 0, 2, 3, 0], fingers: [0, 0, 0, 1, 3, 0],
    tip: 'D with the high E left open.',
  },
  {
    id: 'Dsus4', name: 'Dsus4', full: 'D suspended 4th', group: 'Sus / add',
    frets: [-1, -1, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 3, 4],
    tip: 'Add the pinky to D. The D → Dsus4 → D wiggle is in a thousand songs.',
  },
  {
    id: 'Esus4', name: 'Esus4', full: 'E suspended 4th', group: 'Sus / add',
    frets: [0, 2, 2, 2, 0, 0], fingers: [0, 2, 3, 4, 0, 0],
    tip: 'E with the G string pushed up a fret.',
  },
  {
    id: 'Cadd9', name: 'Cadd9', full: 'C add 9', group: 'Sus / add',
    frets: [-1, 3, 2, 0, 3, 0], fingers: [0, 3, 2, 0, 4, 0],
    tip: 'Play it next to the 4-finger G: fingers 3 and 4 never leave the strings.',
  },
  {
    id: 'GB', name: 'G/B', full: 'G major over B', group: 'Sus / add',
    frets: [-1, 2, 0, 0, 0, 3], fingers: [0, 2, 0, 0, 0, 3],
    tip: 'A G with a B in the bass. Perfect walk-down between C and Am.',
  },
  {
    id: 'DFs', name: 'D/F#', full: 'D major over F#', group: 'Sus / add',
    frets: [2, -1, 0, 2, 3, 2], fingers: [1, 0, 0, 2, 4, 3],
    tip: 'Most players wrap the thumb over the top to grab the F#. It bridges G → D/F# → Em beautifully.',
  },

  // --- power chords ------------------------------------------------------
  {
    id: 'E5', name: 'E5', full: 'E power chord', group: 'Power',
    frets: [0, 2, 2, -1, -1, -1], fingers: [0, 1, 3, 0, 0, 0],
    tip: 'No major or minor — just root and fifth. Mute everything above.',
  },
  {
    id: 'A5', name: 'A5', full: 'A power chord', group: 'Power',
    frets: [-1, 0, 2, 2, -1, -1], fingers: [0, 0, 1, 3, 0, 0],
    tip: 'Same shape as E5 shifted one string over.',
  },
  {
    id: 'D5', name: 'D5', full: 'D power chord', group: 'Power',
    frets: [-1, -1, 0, 2, 3, -1], fingers: [0, 0, 0, 1, 3, 0],
    tip: 'Three strings, big sound with distortion.',
  },
];

export const CHORD_BY_ID = Object.fromEntries(CHORDS.map((c) => [c.id, c]));

// ---------------------------------------------------------------------------
// Curriculum. Ordered so each stage only needs chords from the stages before it.
// ---------------------------------------------------------------------------

export const STAGES = [
  {
    id: 's1',
    title: 'Your first chords',
    blurb: 'Two- and three-finger shapes that need no stretching. Aim for every string ringing clean before you worry about speed.',
    chords: ['Em', 'A', 'D'],
    changes: [['Em', 'A'], ['A', 'D'], ['Em', 'D']],
    goal: '20 changes per minute on each pair',
    songs: ['Em – D – A is the whole verse of countless folk and rock tunes'],
  },
  {
    id: 's2',
    title: 'The minor family',
    blurb: 'Am is the E shape moved down a string, and Dm sits under your D. Notice the shapes repeating — that is how the fretboard works.',
    chords: ['E', 'Am', 'Dm'],
    changes: [['Am', 'E'], ['Am', 'Dm'], ['Dm', 'E']],
    goal: '25 changes per minute on each pair',
    songs: ['Am – Dm – E is the classic minor-key loop'],
  },
  {
    id: 's3',
    title: 'G, C and D — the big three',
    blurb: 'These three unlock more songs than anything else you will learn. The G → C change is the one worth grinding.',
    chords: ['G', 'C', 'D'],
    changes: [['G', 'C'], ['C', 'D'], ['G', 'D']],
    goal: '30 changes per minute on each pair',
    songs: ['G – D – Em – C is Knockin\' on Heaven\'s Door / With or Without You territory'],
  },
  {
    id: 's4',
    title: 'Sevenths and the blues',
    blurb: 'One extra note turns a plain chord into something that leans forward. These are the engine of blues and folk.',
    chords: ['E7', 'A7', 'D7', 'G7', 'B7'],
    changes: [['A7', 'D7'], ['E7', 'A7'], ['G7', 'C'], ['E7', 'B7']],
    goal: '30 changes per minute; play a 12-bar blues in A',
    songs: ['12-bar blues in A: A7 ×4, D7 ×2, A7 ×2, E7, D7, A7, E7'],
  },
  {
    id: 's5',
    title: 'Softening the sound',
    blurb: 'Minor 7ths and major 7ths are usually easier than the chords they replace, and they make simple progressions sound finished.',
    chords: ['Am7', 'Em7', 'Dm7', 'Cmaj7', 'Fmaj7'],
    changes: [['Cmaj7', 'Fmaj7'], ['Am7', 'Dm7'], ['Em7', 'Cmaj7']],
    goal: 'Play Cmaj7 – Fmaj7 – Am7 – G smoothly',
    songs: ['Fmaj7 is your stand-in for F until the barre lands'],
  },
  {
    id: 's6',
    title: 'The barre chords',
    blurb: 'Everyone struggles here — it is a technique problem, not a talent problem. Start with the mini F, and practise in short bursts so your hand does not fatigue.',
    chords: ['Fmini', 'F', 'Bm', 'B'],
    changes: [['C', 'Fmini'], ['C', 'F'], ['G', 'Bm'], ['E', 'B']],
    goal: 'Hold F for four clean strums, then 20 changes per minute C → F',
    songs: ['With F and Bm you can play in every key without a capo'],
  },
  {
    id: 's7',
    title: 'Colour and movement',
    blurb: 'Small finger moves against a held chord. This is where strumming stops sounding like exercises and starts sounding like music.',
    chords: ['Cadd9', 'G4', 'Dsus4', 'Dsus2', 'Asus2', 'Asus4', 'Esus4', 'GB', 'DFs'],
    changes: [['G4', 'Cadd9'], ['D', 'Dsus4'], ['A', 'Asus4'], ['G', 'DFs']],
    goal: 'Loop G – D/F# – Em – Cadd9 without stopping',
    songs: ['Cadd9 → G (4-finger) is the Oasis/Wonderwall move'],
  },
];

// ---------------------------------------------------------------------------
// Progressions. Roman numerals given in the listed key.
// ---------------------------------------------------------------------------

export const PROGRESSIONS = [
  {
    name: 'The four-chord song',
    numerals: 'I – V – vi – IV',
    note: 'The backbone of modern pop. Once you can loop it you can busk hundreds of songs.',
    keys: [
      { key: 'G', chords: ['G', 'D', 'Em', 'C'] },
      { key: 'C', chords: ['C', 'G', 'Am', 'F'] },
      { key: 'D', chords: ['D', 'A', 'Bm', 'G'] },
    ],
    examples: ['Let It Be (key of C)', "Knockin' on Heaven's Door (G – D – Am – C variant)"],
  },
  {
    name: 'The sensitive loop',
    numerals: 'vi – IV – I – V',
    note: 'The same four chords starting on the minor. Sounds instantly more wistful.',
    keys: [
      { key: 'G', chords: ['Em', 'C', 'G', 'D'] },
      { key: 'C', chords: ['Am', 'F', 'C', 'G'] },
    ],
    examples: ['Used in countless ballads and film cues'],
  },
  {
    name: 'Three-chord rock',
    numerals: 'I – IV – V',
    note: 'The oldest trick in popular music. Every blues, country and early rock tune lives here.',
    keys: [
      { key: 'A', chords: ['A', 'D', 'E'] },
      { key: 'G', chords: ['G', 'C', 'D'] },
      { key: 'E', chords: ['E', 'A', 'B7'] },
    ],
    examples: ['Twist and Shout', 'La Bamba', 'Wild Thing'],
  },
  {
    name: 'Doo-wop / 50s',
    numerals: 'I – vi – IV – V',
    note: 'Warm and nostalgic. Great for practising the G → Em → C → D circuit.',
    keys: [
      { key: 'C', chords: ['C', 'Am', 'F', 'G'] },
      { key: 'G', chords: ['G', 'Em', 'C', 'D'] },
    ],
    examples: ['Stand By Me', 'Blue Moon'],
  },
  {
    name: 'Minor-key folk',
    numerals: 'i – VII – VI – V',
    note: 'Dark and cinematic. Uses chords you already know from stage 2.',
    keys: [
      { key: 'Am', chords: ['Am', 'G', 'F', 'E'] },
      { key: 'Em', chords: ['Em', 'D', 'C', 'B7'] },
    ],
    examples: ['The "Andalusian cadence" heard in flamenco and rock alike'],
  },
  {
    name: '12-bar blues',
    numerals: 'I7 – IV7 – V7',
    note: '12 bars: I×4, IV×2, I×2, V, IV, I, V. Count the bars out loud until it sticks.',
    keys: [
      { key: 'A', chords: ['A7', 'D7', 'E7'] },
      { key: 'E', chords: ['E7', 'A7', 'B7'] },
    ],
    examples: ['Johnny B. Goode', 'Sweet Home Chicago'],
  },
  {
    name: 'Wonderwall shuffle',
    numerals: 'Em7 – G – Dsus4 – A7sus4',
    note: 'Approximate it with Em7 – G – Dsus4 – Cadd9 while your pinky gets strong.',
    keys: [{ key: 'Em', chords: ['Em7', 'G4', 'Dsus4', 'Cadd9'] }],
    examples: ['The capo-2 busking staple'],
  },
];

// Short chord sequences to play through on the fretboard.
//
// `beats` gives each step's length in the song's own beat, and `meter` how many
// of those make a bar — so Heaven's Door's G and D are two beats of a shared
// 4/4 bar, while Amazing Grace's G runs three bars of 3/4. Without this a
// correct sequence of chords still doesn't sound like the tune, because every
// change lands in the wrong place. `bpm` counts the same beat. Every chord is an
// open shape inside the first three frets, so the whole song fits on the neck
// without moving position. Kept to a handful of steps each — the point is to
// chain changes together, not to memorise an arrangement.
export const SONGS = [
  {
    id: 'horse', name: 'A Horse with No Name', chords: ['Em', 'D', 'Em', 'D'],
    meter: 4, bpm: 120, beats: [4, 4, 4, 4],
    note: 'Two chords, and the pair most often named the easiest song on the guitar. '
      + 'The record uses a D6add9; plain D is the standard beginner stand-in.',
  },
  {
    id: 'warmup', name: 'Warm-up', chords: ['Em', 'A', 'Em', 'D'],
    meter: 4, bpm: 100, beats: [4, 4, 4, 4],
    note: 'Not a song — three easy shapes in a loop, to get the hand moving.',
  },
  {
    id: 'grace', name: 'Amazing Grace', chords: ['G', 'G7', 'C', 'G', 'D', 'G'],
    meter: 3, bpm: 92, beats: [3, 3, 3, 9, 6, 6],
    note: 'Traditional, 3/4. G–C–G–D is the skeleton every arrangement shares; '
      + 'the G7 is an optional passing chord that pulls the ear across to the C.',
  },
  {
    id: 'heaven', name: "Heaven's Door", chords: ['G', 'D', 'Am', 'G', 'D', 'C'],
    meter: 4, bpm: 72, beats: [2, 2, 4, 2, 2, 4],
    note: 'The whole verse is these six.',
  },
  {
    id: 'letitbe', name: 'Let It Be', chords: ['C', 'G', 'Am', 'Fmini', 'C', 'G', 'Fmini', 'C'],
    meter: 4, bpm: 72, beats: [2, 2, 2, 2, 2, 2, 2, 2],
    note: 'The whole verse: C G | Am F | C G | F C, with the easy F.',
  },
  {
    id: 'rising', name: 'Rising Sun', chords: ['Am', 'C', 'D', 'Fmini', 'Am', 'C', 'E'],
    meter: 6, bpm: 156, beats: [6, 6, 6, 6, 6, 6, 12],
    note: 'A minor key that borrows a major D and E — that is what gives it the sound.',
  },
  {
    id: 'blues', name: '12-bar blues', chords: ['A7', 'D7', 'A7', 'E7', 'D7', 'A7', 'E7'],
    meter: 4, bpm: 100, beats: [16, 8, 8, 4, 4, 4, 4],
    note: 'The 12 bars as their seven changes, ending on the turnaround back to A7.',
  },
  {
    id: 'britpop', name: 'Britpop loop', chords: ['Em', 'G', 'Dsus4', 'Cadd9'],
    meter: 4, bpm: 87, beats: [4, 4, 4, 4],
    note: 'Keep fingers 3 and 4 down throughout.',
  },
];

// Strumming patterns, written as down/up over one bar of 4/4.
export const STRUMS = [
  { name: 'All down', pattern: ['D', 'D', 'D', 'D'], counts: ['1', '2', '3', '4'], note: 'Start here. Keep the wrist loose and the tempo dead even.' },
  { name: 'Down-up eighths', pattern: ['D', 'U', 'D', 'U', 'D', 'U', 'D', 'U'], counts: ['1', '&', '2', '&', '3', '&', '4', '&'], note: 'Your hand never stops moving — that constant motion is the whole skill.' },
  { name: 'The one everyone uses', pattern: ['D', '', 'D', 'U', '', 'U', 'D', 'U'], counts: ['1', '&', '2', '&', '3', '&', '4', '&'], note: 'D – D U – U D U. Keep strumming through the gaps, just miss the strings.' },
  { name: 'Folk / campfire', pattern: ['D', '', 'D', 'U', 'D', 'U', 'D', 'U'], counts: ['1', '&', '2', '&', '3', '&', '4', '&'], note: 'A touch busier. Accent beats 2 and 4.' },
];
