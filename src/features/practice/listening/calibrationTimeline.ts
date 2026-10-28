import type { Timeline } from '../engine/timeline';
import type { TransportSettings } from '../engine/transport';
import type { Mix } from '../practiceStore';

/** Latency calibration: a one-bar count-in, then eight clicks to play along with. */
export const CALIBRATION_BEATS = 8;
export const CALIBRATION_TEMPO = 90;

export const CALIBRATION_TIMELINE: Timeline = {
  exerciseId: 'latency-calibration',
  kind: 'notes',
  beatsPerBar: 4,
  beatUnit: 4,
  slotsPerBeat: 2,
  totalBars: CALIBRATION_BEATS / 4,
  totalBeats: CALIBRATION_BEATS,
  targetTempo: CALIBRATION_TEMPO,
  chords: [],
  strums: [],
  notes: [],
  targets: [],
};

export const CALIBRATION_SETTINGS: TransportSettings = {
  tempo: CALIBRATION_TEMPO,
  loop: null,
  waitMode: false,
  speedUp: null,
};

/** Clicks only, at full volume. */
export const CALIBRATION_MIX: Mix = {
  metronome: { enabled: true, volume: 1 },
  backing: { enabled: false, volume: 0 },
  guide: { enabled: false, volume: 0 },
};
