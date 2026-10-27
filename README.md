# FretPath

A mobile-first Progressive Web App for learning guitar: a precision tuner, a structured
eight-stage course and an interactive play-along practicer that listens to what you play.
Everything runs on the device and works offline; there is no backend.

> **Status:** Milestone 1 (foundation) of 7 is complete. The tuner, practicer, curriculum
> and profile screens are placeholders until their milestones land.

| #   | Milestone                                                  | Status  |
| --- | ---------------------------------------------------------- | ------- |
| 1   | Foundation: tooling, design system, shell, PWA, IndexedDB  | Done    |
| 2   | Tuner: audio engine, pitch worklet, tuner UI               | Next    |
| 3   | Practicer engine: scheduler, metronome, timeline, controls | Planned |
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

The microphone (from milestone 2) needs a secure context: `localhost` works, but testing
on a phone over the LAN needs HTTPS.

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

Audio (from milestone 2) uses the Web Audio API with pitch detection in an AudioWorklet.

## Project structure

```
src/
  app/        Shell: routes, navigation, screen layout, theme, notices, PWA update prompt
  ui/         Design-system primitives: Button, IconButton, Card, EmptyState, ErrorState, …
  storage/    IndexedDB schema, migrations, repositories and the Zustand persist adapter
  stores/     Zustand stores (settings)
  features/   One folder per screen: tuner, learn, practice, songs, profile, settings
  test/       Test setup, helpers and module stand-ins
e2e/          Playwright specs (phone 390×844 and desktop 1280×800)
public/       Static assets: logo, generated icons and splash screens
```

Planned for later milestones: `src/audio/` (AudioContext, worklets, scheduler, synth),
`src/content/` (curriculum JSON + schemas) and `src/lib/` (music theory helpers).

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

**PWA.** Workbox precaches the app shell and every screen chunk, so the app works offline
after the first visit. New versions wait for the user to tap "Reload to update", so an
update never interrupts a practice session. The manifest is portrait, standalone and
installable, with maskable icons and iOS splash screens.

## Testing

- **Unit and component tests** (`src/**/*.test.ts[x]`): storage (against `fake-indexeddb`),
  settings persistence and validation, theme, routing, error boundaries, PWA prompt and
  design-token contrast.
- **End-to-end tests** (`e2e/`): navigation, layout on phone and desktop, touch-target size,
  theme persistence across reloads, behaviour without IndexedDB, manifest and Chrome installability, offline
  operation through the service worker, and axe WCAG 2.1 AA scans of every screen in both
  themes.

## Content policy

The code, logo and artwork are original. Course songs will be public-domain or traditional
pieces, or written for the app. The repository will not contain lyrics, tabs or
arrangements of copyrighted songs.
