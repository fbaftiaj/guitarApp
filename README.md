# FretPath

A mobile-first Progressive Web App for learning guitar: a precision tuner, a structured
eight-stage course and an interactive play-along practicer that listens to what you play.
Everything runs on the device and works offline; there is no backend.

> **Status:** Milestones 1 (foundation) and 2 (tuner) of 7 are complete. The practicer,
> curriculum, songs and profile screens are placeholders until their milestones land.

| #   | Milestone                                                  | Status  |
| --- | ---------------------------------------------------------- | ------- |
| 1   | Foundation: tooling, design system, shell, PWA, IndexedDB  | Done    |
| 2   | Tuner: audio engine, pitch worklet, tuner UI               | Done    |
| 3   | Practicer engine: scheduler, metronome, timeline, controls | Next    |
| 4   | Listening and scoring: onset/chroma, latency calibration   | Planned |
| 5   | Curriculum: content schemas, stages 1–3, lesson flow       | Planned |
| 6   | Progress and profile: skill meters, streaks, history       | Planned |
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

Audio uses the Web Audio API only: pitch detection runs in an AudioWorklet, reference tones
are synthesised (Karplus–Strong). No audio libraries, no recordings.

## Project structure

```
src/
  app/        Shell: routes, navigation, screen layout, theme, notices, PWA update prompt
  ui/         Design-system primitives: Button, Card, Sheet, ChoiceList, SegmentedControl, …
  audio/      Shared AudioContext, microphone, pitch worklet and its main-thread input
    dsp/      FFT, autocorrelation, McLeod pitch detector, streaming analyzer, stabilizer
    synth/    Karplus–Strong plucked string and the reference-tone player
  content/    Data-driven content (instruments and tunings JSON) with Zod schemas
  lib/music/  Music theory: note spelling, MIDI ↔ Hz, cents, nearest note
  platform/   Thin wrappers for browser APIs (screen wake lock, vibration)
  storage/    IndexedDB schema, migrations, repositories and the Zustand persist adapter
  stores/     App-wide Zustand stores (settings)
  features/   One folder per screen: tuner, learn, practice, songs, profile, settings
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
| `kv`             | name       | Persisted Zustand stores (e.g. `settings`)                 |
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
mic ─▶ MediaStreamSource ─▶ AudioWorklet (pitchProcessor)            main thread
                              StreamingPitchAnalyzer                   PitchStabilizer
                              · 2048-sample window (4096 for bass)  ─▶ · clarity ≥ 0.9, level gate
                              · ~10 ms hop                             · octave-jump rejection
                              · McLeod Pitch Method (NSDF via FFT)     · median of 5
                              posts {time, Hz, clarity, rms}           ─▶ TunerEngine ─▶ UI
```

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
- **End-to-end tests** (`e2e/`): the tuner with a fake microphone — a controllable test tone
  injected in place of `getUserMedia` — running through the real AudioWorklet: string
  detection and cues, ticking all strings, manual and chromatic modes, A4 reference,
  persistence, microphone release, background pause and resume, every microphone error,
  offline tuning, and needle frame rate under 4× CPU throttling. Also navigation, layouts,
  touch-target size, theme persistence, behaviour without IndexedDB, manifest and Chrome
  installability, offline operation, and axe WCAG 2.1 AA scans in both themes.

## Content policy

The code, logo and artwork are original. Course songs will be public-domain or traditional
pieces, or written for the app. The repository will not contain lyrics, tabs or
arrangements of copyrighted songs.
