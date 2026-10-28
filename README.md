# FretPath

A mobile-first Progressive Web App for learning guitar: a precision tuner, a structured
eight-stage course and an interactive play-along practicer that listens to what you play.
Everything runs on the device and works offline; there is no backend.

> **Status:** Milestones 1–5 of 7 (foundation, tuner, practicer, listening and scoring,
> curriculum) are complete. Stages 4–8 are shown as previews and the profile screen is a
> placeholder until their milestones land.

| #   | Milestone                                                  | Status  |
| --- | ---------------------------------------------------------- | ------- |
| 1   | Foundation: tooling, design system, shell, PWA, IndexedDB  | Done    |
| 2   | Tuner: audio engine, pitch worklet, tuner UI               | Done    |
| 3   | Practicer engine: scheduler, metronome, timeline, controls | Done    |
| 4   | Listening and scoring: onset/chroma, latency calibration   | Done    |
| 5   | Curriculum: content schemas, stages 1–3, lesson flow       | Done    |
| 6   | Progress and profile: skill meters, streaks, history       | Next    |
| 7   | Polish: onboarding, stages 4–8, accessibility, performance | Planned |

## Getting started

Requires Node.js 22.12 or newer.

```sh
npm ci
npm run dev        # http://localhost:5173
```

The microphone needs a secure context: `localhost` works, but testing on a phone over the
LAN needs HTTPS (for example a tunnel, or `vite --host` behind a local TLS proxy).

## Scripts

| Script                        | What it does                                                      |
| ----------------------------- | ----------------------------------------------------------------- |
| `npm run dev`                 | Vite dev server (the service worker is disabled in dev)           |
| `npm run build`               | Type-check and build the production bundle and service worker     |
| `npm run preview`             | Serve the production build locally                                |
| `npm run verify`              | Type-check, lint, format check and unit tests (run before push)   |
| `npm test`                    | Unit and component tests (Vitest + Testing Library, jsdom)        |
| `npm run test:e2e`            | End-to-end tests (Playwright) against the production build        |
| `npm run lint`                | ESLint, zero warnings allowed                                     |
| `npm run format`              | Prettier (with Tailwind class sorting)                            |
| `npm run generate-pwa-assets` | Regenerate icons and iOS splash screens from `public/favicon.svg` |

The first `test:e2e` run on a new machine needs a browser: `npx playwright install chromium`.

## Tech stack

React 18 · TypeScript (strict) · Vite · Tailwind CSS 4 · Zustand · IndexedDB (`idb`) · Zod
(`zod/mini`) · React Router · vite-plugin-pwa (Workbox) · Vitest · Playwright · axe-core.

Audio uses the Web Audio API only: pitch, onset and chroma analysis run in an AudioWorklet; reference tones,
guide strums, metronome and backing track are synthesised (Karplus–Strong plucks, oscillators,
filtered noise). No audio libraries, no recordings.

## Project structure

```
src/
  app/        Shell: routes, navigation, screen layout, theme, notices, PWA update prompt
  ui/         Design-system primitives: Button, Card, Sheet, ChoiceList, SegmentedControl, …
  audio/      Shared AudioContext, microphone, the listener (mic + analysis worklet) for every feature
    dsp/      FFT, McLeod pitch detector, stabilizer, onset detector (SuperFlux), chroma
    synth/    Karplus–Strong plucks (shared pluck bank), reference tones, practice synth
  content/    Data-driven content (instruments, chords, exercises, songs, course JSON) with Zod schemas
  lib/music/  Music theory: note spelling, MIDI ↔ Hz, cents, chord tones, shapes and templates
  platform/   Thin wrappers for browser APIs (screen wake lock, vibration)
  storage/    IndexedDB schema, migrations, repositories and the Zustand persist adapter
  stores/     App-wide Zustand stores (settings, lesson progress)
  features/   One folder per screen: tuner, learn, practice, songs, profile, settings
    practice/engine/     Timeline compiler, arrangement, transport, lookahead scheduler (pure)
    practice/scoring/    Chord recognition, hit checks, scorer, wait matcher, latency, stars, results
    practice/listening/  Session inputs: scoring while practising, latency calibration
    learn/               Course screens, unlock rules, the Learn/Listen/Practice/Check steps
  test/       Test setup, signal generators and module stand-ins
e2e/          Playwright specs (phone 390×844 and desktop 1280×800); support/ has the fake mic
public/       Static assets: logo, generated icons and splash screens
```

## Architecture notes

**Design tokens.** All colours are semantic CSS variables in `src/index.css`, exposed as
Tailwind utilities (`bg-surface`, `text-fg-muted`, `text-string-6`, …). Dark is the default
theme; light overrides the same variables under `[data-theme='light']`. A unit test checks
every text/background pair against WCAG AA (4.5:1) in both themes.

**Theme.** The setting (dark, light or system) lives in the settings store. `main.tsx` waits
for the stored settings before the first render so there is no flash of the wrong theme;
`useThemeSync` keeps `<html data-theme>` and `<meta name="theme-color">` in sync.

**Navigation.** One `<nav>` renders as a bottom tab bar on phones and a side rail from the
`lg` breakpoint (1024 px), with content in a centred column. Screens are code-split and use
the shared `Screen` layout, which sets the document title; focus moves to the new heading
after each navigation. A failing screen shows an error inside the shell, so the navigation
stays usable.

**Storage.** IndexedDB database `fretpath` (schema v1):

| Store            | Key        | Contents                                                   |
| ---------------- | ---------- | ---------------------------------------------------------- |
| `kv`             | name       | Persisted Zustand stores (`settings`, `tuner`, `practice`) |
| `sessions`       | `id`       | Scored session results, indexed by start time and exercise |
| `lessonProgress` | `lessonId` | Best stars and accuracy per lesson                         |

Records are validated with Zod on write. Persisted settings are validated field by field on
read, so a corrupt value falls back to its default. When IndexedDB is unavailable (private
browsing, blocked storage), the app keeps working in memory and shows a warning. Schema
changes go in a new `if (oldVersion < N)` block in `src/storage/db.ts`.

**Audio pipeline.** One shared `AudioContext` (`src/audio/context.ts`) is started inside the
user's tap (required on iOS) and suspended when nothing holds it. The microphone is opened
with echo cancellation, noise suppression and auto gain off.

```
mic ─▶ MediaStreamSource ─▶ AudioWorklet (analysisProcessor)         main thread
                              StreamingPitchAnalyzer                   tuner: PitchStabilizer
                              · 2048-sample window (4096 for bass)  ─▶ · clarity ≥ 0.9, level gate
                              · ~10 ms hop, McLeod Pitch Method        · octave-jump rejection
                              StreamingOnsetDetector (practicer)       · median of 5 ─▶ TunerEngine
                              · 1024-sample window, ~5 ms hop       ─▶ practicer: Scorer /
                              StreamingChroma after each onset            WaitMatcher ─▶ UI
                              posts {pitch | onset | chroma} frames
```

The tuner and the practicer open the microphone through the same listener
(`src/audio/listener.ts`) and analyse it in the same worklet; each asks only for the features
it needs. An architecture test keeps all Web Audio code in `src/audio/`.

- **Detection** is the McLeod Pitch Method, never FFT peak picking. The autocorrelation uses
  a half-size real-input FFT (0.15 ms per 2048-sample estimate on a desktop CPU), and the
  period is refined at the highest NSDF multiple in range for sub-cent precision on high
  notes. Measured worst case (E2–A4, 44.1 and 48 kHz): **0.002 ¢** on sines, **0.21 ¢** on
  band-limited sawtooths and **0.14 ¢** on Karplus–Strong plucks (requirements: ±1 / ±3 ¢).
- **Smoothing:** readings are gated, octave jumps must be confirmed by a second frame, a
  median of five removes outliers, and the needle eases with a 42 ms time constant (about
  90 % of a change shows within 100 ms). The needle animates in `requestAnimationFrame`
  without React re-renders; the rest of the screen updates at most 20 times a second.
- **Lifecycle:** the microphone is released on Stop, when leaving the tuner and while the app
  is in the background (tuning resumes on return where the browser allows it, otherwise
  "Tap to resume"). Permission, missing-device, busy-device, disconnect and insecure-page
  errors each get their own message.

**Tuner.** `TunerEngine` (pure, driven by audio-clock timestamps) picks the target: the
closest string with 50 ¢ hysteresis in auto mode, the chosen string in manual mode, or the
nearest note in chromatic mode. Within ±5 ¢ for one second ticks a string off (with haptic
feedback); a ticked string that drifts by more than 10 ¢ loses its tick. Instruments and
tunings are data in `src/content/instruments.json` (6/7/12-string guitar, 4/5-string bass,
ukulele; 12 guitar tunings), validated at load. The instrument, tuning per instrument,
guitar type and mode are remembered in IndexedDB; the A4 reference (432–446 Hz) is an app
setting.

**Practicer.** Exercises are data (`src/content/exercises.json`, validated at load): chord
exercises (chords per bar and a strum pattern such as `D.DU.UDU`) and single-note exercises
(string, fret, length and finger per note), with repeats. Every chord must exist in the chord
library (`chords.json`), whose shapes are checked to sound exactly the chord's notes. The
pipeline is pure until the last step:

```
exercise ─▶ compileExercise ─▶ timeline (chords, strums, notes, wait targets, in beats)
                              └▶ arrange ─▶ guide (strums, notes) + backing (bass, kick, hat)
Transport (audio clock) ◀── LookaheadScheduler: every 25 ms, schedule the next 100 ms
   └▶ sounds with exact start times ─▶ PracticeSynth (metronome / count-in / guide / backing)
```

- **Timing:** the transport maps audio-clock time to beats as a list of continuous runs, so
  every sound is scheduled with sample accuracy from `AudioContext.currentTime` and timer
  jitter never reaches the ear. Tempo changes apply from the scheduling horizon without a
  jump. The highway moves with a CSS transform on every animation frame, driven by the audio
  clock minus the output latency (what is heard now); React re-renders only when the bar,
  beat slot, chord or note changes.
- **Controls:** play, pause (freezes the position exactly; resuming counts in one bar on the
  beat grid and carries on from the same position), restart, tempo 30–220 BPM with ±1 and
  50/75/100/125 % presets, loop any bars, auto speed-up (+2/5/10 BPM per successful pass up
  to the target tempo; the default for new exercises, which start at 60 %), wait mode (stops
  at each chord or note; Next carries on until listening arrives in Milestone 4), and
  metronome, backing and guide on/off with volume. The count-in always plays. Chord names,
  finger numbers, note names and a fretboard view can be toggled.
- **Persistence:** tempo, loop, speed-up and wait mode are remembered per exercise; the mix and
  display options for the practicer as a whole. Practice pauses when the app goes to the
  background or audio is interrupted, and keeps the screen awake while playing.
- **Extension points:** a pass judge decides whether a loop earns a speed-up (always yes until
  scoring lands), and `advanceWait` is what listening will call in wait mode.

**Listening and scoring.** With “Listen and score” on, the practicer judges every strum or
note of the guide part as the transport schedules it (the guide does not have to be audible).

- **Onsets:** spectral flux of the log-compressed spectrum (150 Hz–5 kHz, ~21 ms windows every
  ~5 ms) with SuperFlux's frequency max-filter, an adaptive median threshold and peak picking;
  a strum counts once. On synthesised strums and notes the attack is found within ±8 ms.
- **Chords:** the chroma of the ~80 ms after each onset (spectral peaks with parabolic
  interpolation, the overall tuning offset removed) is compared by cosine similarity with a
  template per chord, built by running the same analysis on an idealised spectrum of the
  actual voicing (with separate templates for up-strums, which catch four strings). The
  expected chord is accepted at similarity ≥ 0.8 and within 0.03 of the best match, so chords
  one note apart (C/Cadd9) are lenient while Em/E and Am/C are told apart.
- **Single notes:** the median pitch from the shared pitch detector, 50–200 ms after the
  onset, must be within ±50 cents of the target (at the app's A4).
- **Timing:** onset minus target after removing the latency: Perfect ±40 ms, Good ±90 ms,
  Early/Late up to ±200 ms, otherwise Miss. Accuracy gives full credit for Perfect, 85 % for
  Good and half for Early/Late, with the right chord or note (none when wrong); stars at
  70 / 85 / 95 %. A loop pass earns an auto speed-up at ≥ 80 %. Wait mode carries on as soon
  as the awaited chord or note is heard, and scores right-first-time.
- **Latency calibration** (Settings → Timing, linked from the practicer): eight clicks after a
  count-in; the median click-to-onset offset (strays and uneven playing rejected) is stored
  and subtracted. Without a measurement the output latency reported by the browser plus an
  assumed input latency is used. Bluetooth-sized delays (≥ 150 ms) get a warning.
- **Results:** accuracy, stars, Perfect/Good/Early/Late/Miss counts, wrong chords, a timing
  chart, the chords or notes missed most and a suggestion (“Try again at 70 BPM” / “Ready for
  the next lesson”) with a button to apply it. Each session is stored in IndexedDB with its
  hits, misses per chord/note and per-skill scores (for the profile in Milestone 6).
- **Microphone:** opened in the play tap, released shortly after pausing, finishing or leaving;
  every microphone error has its own message, a retry and “Play without listening”.
- **Limits:** with the speaker on, the microphone also hears FretPath's own metronome and
  backing (echo cancellation must stay off for pitch accuracy), so it recommends wired
  headphones. Thresholds were tuned and tested on synthesised guitar sounds; tuning them on
  real guitars and phones is part of Milestone 7's cross-device testing.

**Curriculum.** The course is data: `src/content/course/stages.json` lists the eight
stages, and each playable stage has its own file of units and lessons (`stage-1.json` …
`stage-3.json`), validated with Zod when the module loads. The checks go beyond the schema:
unique ids, known chords and songs, strum patterns that fit the bar, 3–5 units of 4–8 lessons
per stage, a stage song at the end of every stage, and no playable stage after a preview.
Strum patterns are shared (`strumPatterns.json`); the exercise schema's music part is reused
by lessons and songs.

- **Lessons** run Learn → Listen → Practice → Check on one exercise (their own music, or a
  song from the library). Learn shows what and why, numbered technique steps, chord diagrams
  with finger numbers (or tab with suggested fingers), a silent animated fretboard demo of
  the opening phrase (paused under `prefers-reduced-motion`), common mistakes with fixes and
  a tip. Listen plays the exercise at its target tempo with the guide on. Practice is the
  full practicer. Check is one scored run at the target tempo with the guide muted, saved as
  a `check` session with its lesson id.
- **Progress:** 1–3 stars at ≥ 70 / 85 / 95 % accuracy; the best result per lesson is kept in
  IndexedDB (`stores/progressStore.ts`, in memory if storage is blocked). Lessons unlock in
  order; a stage opens once the previous one is completed (Milestone 6's stage tests will
  replace that rule). The rules are pure functions in `features/learn/progression.ts`.
- **Songs:** chord progression (or melody), rhythm, tempo, sections and form; no lyrics.
  The Songs tab lists them with origin and credit and opens each in the practicer.

**PWA.** Workbox precaches the app shell and every screen chunk, so the app works offline
after the first visit. New versions wait for the user to tap "Reload to update", so an
update never interrupts a practice session. The manifest is portrait, standalone and
installable, with maskable icons and iOS splash screens.

## Testing

- **Unit and component tests** (`src/**/*.test.ts[x]`): pitch-detector accuracy on
  synthesised sines, sawtooths and Karplus–Strong plucks (E2–A4 and bass B0–A1 at 44.1 and
  48 kHz), noise and silence gating, missing-fundamental and octave-error cases, FFT and
  autocorrelation against naive references, synth tuning (checked spectrally), stabilizer,
  tuner engine (modes, hysteresis, hold-to-tune, ticks), content schema, storage (against
  `fake-indexeddb`), settings, theme, routing, error boundaries, PWA prompt and
  design-token contrast.
- **Listening unit tests:** onset detection on synthesised strum progressions, up-strums,
  quiet strums, fast repeated notes and block-size independence, with no onsets on silence,
  noise, steady tones or ringing chords; chroma; chord recognition of every Stage 2 chord,
  down and up, at 44.1/48 kHz with bright, dull, noisy and detuned strings and the previous
  chord ringing, telling Em/E, Am/C, G/C and D/A apart; scorer (timing windows, latency,
  nearest-target matching, extra strums, notes by pitch, misses, cancelling, pass accuracy),
  wait matcher, latency calibration maths, stars, results and suggestions.
- **Practicer unit tests:** exercise and chord schemas (every chord referenced exists,
  rejects malformed content), timeline and arrangement, and the transport and scheduler on a
  fake clock — count-in, exact beat spacing under irregular ticks and stalls, tempo changes,
  pause freezing exactly, resume on the grid, loops, speed-up and the pass judge, wait mode,
  restart, and cancelled loop wraps. The practice synth is checked against a fake
  AudioContext, and an architecture test keeps all Web Audio code in `src/audio/` so the
  tuner and practicer share one context, microphone and pluck bank.
- **Listening end to end** (`e2e/listening.spec.ts`, its own Playwright project that runs
  alone after the others): a fake guitarist feeds synthesised strums and notes, timed against
  the app's scheduled clicks on its own audio clock, through a fake microphone into the real
  worklet. It calibrates latency, then checks Perfect/Good/Late/Miss and wrong chords
  exactly, the results sheet and the stored session, wait mode advancing on the right chord,
  single notes by pitch, speed-up only after a pass played well, microphone errors and the
  microphone being released.
- **Curriculum tests:** every lesson, song and strum pattern passes its schema and
  references only existing chords and songs; validation rejects unknown chords and songs,
  misfitting strums, a stage without a stage song, too few units or lessons, reused ids and
  a playable stage after a preview; star thresholds at their boundaries; unlock rules (one
  lesson after another, stages after the previous stage, previews closed, completed lessons
  kept open); the progress store, including blocked storage; and the course screens.
- **Lessons end to end** (`e2e/lesson.listening.spec.ts`, in the listening project): the
  fake guitarist plays the first lesson's check; it passes with three stars, unlocks the next
  lesson, saves a `check` session and survives a reload. A failed check keeps the next lesson
  locked. `e2e/learn.spec.ts` covers the course overview, locked lessons and stages, the
  fretboard demo (and reduced motion), the Listen step's guide timing and the Songs tab.
- **End-to-end tests** (`e2e/`): the practicer on the real audio clock, with an audio spy
  recording each sound's scheduled start time: click spacing to the microsecond, sounds always
  scheduled ahead, pause and resume, restart, loop with speed-up, wait mode, mix and label
  toggles, guide strums, persistence, background pause, 30+ fps under 4× CPU throttling,
  offline play and axe scans while playing. The tuner with a fake microphone — a controllable test tone
  injected in place of `getUserMedia` — running through the real AudioWorklet: string
  detection and cues, ticking all strings, manual and chromatic modes, A4 reference,
  persistence, microphone release, background pause and resume, every microphone error,
  offline tuning, and needle frame rate under 4× CPU throttling. Also navigation, layouts,
  touch-target size, theme persistence, behaviour without IndexedDB, manifest and Chrome
  installability, offline operation, and axe WCAG 2.1 AA scans in both themes.

## Content policy

The code, logo, artwork, chord diagrams, lesson text and exercises are original. Songs are
traditional or public-domain pieces (with their source credited) or written for the app, and
are stored as chords, rhythm and form only. The repository contains no lyrics, tabs or
arrangements of copyrighted songs.
