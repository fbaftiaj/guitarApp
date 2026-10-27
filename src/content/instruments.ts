import { z } from 'zod/mini';
import {
  A4_RANGE_HZ,
  midiToFrequency,
  parseNote,
  tryParseNote,
  type SpelledNote,
} from '@/lib/music/notes';
import catalogJson from './instruments.json';

/**
 * Instruments and tunings shown by the tuner. The data lives in
 * `instruments.json` so tunings can be added without code changes; it is
 * validated here when the module loads.
 *
 * `notes` list strings in the order they sit at the nut, starting from the
 * thickest-string side (the 6th string on a guitar). The headstock drawing
 * relies on that order, which is not always pitch order (e.g. ukulele GCEA).
 */

export const BODY_STYLES = ['acoustic', 'electric'] as const;
export type BodyStyle = (typeof BODY_STYLES)[number];
export type InstrumentFamily = 'guitar' | 'bass' | 'ukulele';

const slug = z.string().check(z.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/));
const label = z.string().check(z.minLength(1));
const noteText = z.string().check(z.refine((text) => tryParseNote(text) !== null, 'Invalid note'));
const hertz = z.number().check(z.positive());

const tuningSchema = z.object({
  id: slug,
  name: label,
  notes: z.array(noteText).check(z.minLength(1)),
});

const instrumentSchema = z.object({
  id: slug,
  family: z.enum(['guitar', 'bass', 'ukulele']),
  name: label,
  detail: label,
  strings: z.int().check(z.gte(1), z.lte(12)),
  /** Strings per course: 2 for a 12-string guitar. */
  courseSize: z.optional(z.union([z.literal(1), z.literal(2)])),
  bodyStyles: z.optional(z.array(z.enum(BODY_STYLES)).check(z.minLength(2))),
  /** Pitch range the detector listens to for this instrument. */
  detection: z.object({ minHz: hertz, maxHz: hertz }),
  defaultTuning: slug,
  tunings: z.array(tuningSchema).check(z.minLength(1)),
});

type InstrumentData = z.infer<typeof instrumentSchema>;

function checkInstrument(instrument: InstrumentData, issues: string[]): void {
  const where = `instrument "${instrument.id}"`;
  const { minHz, maxHz } = instrument.detection;
  if (minHz >= maxHz) issues.push(`${where}: detection.minHz must be below maxHz`);
  if (instrument.strings % (instrument.courseSize ?? 1) !== 0) {
    issues.push(`${where}: ${instrument.strings} strings do not divide into courses`);
  }
  if (!instrument.tunings.some((tuning) => tuning.id === instrument.defaultTuning)) {
    issues.push(`${where}: defaultTuning "${instrument.defaultTuning}" is not one of its tunings`);
  }
  const tuningIds = new Set<string>();
  for (const tuning of instrument.tunings) {
    if (tuningIds.has(tuning.id)) issues.push(`${where}: duplicate tuning id "${tuning.id}"`);
    tuningIds.add(tuning.id);
    if (tuning.notes.length !== instrument.strings) {
      issues.push(
        `${where}, tuning "${tuning.id}": ${tuning.notes.length} notes for ${instrument.strings} strings`,
      );
    }
    for (const text of tuning.notes) {
      const midi = parseNote(text).midi;
      const lowest = midiToFrequency(midi, A4_RANGE_HZ.min);
      const highest = midiToFrequency(midi, A4_RANGE_HZ.max);
      if (lowest < minHz || highest > maxHz) {
        issues.push(`${where}, tuning "${tuning.id}": ${text} is outside the detection range`);
      }
    }
  }
}

export const instrumentCatalogSchema = z
  .object({ instruments: z.array(instrumentSchema).check(z.minLength(1)) })
  .check(
    z.superRefine((catalog, ctx) => {
      const issues: string[] = [];
      const ids = new Set<string>();
      for (const instrument of catalog.instruments) {
        if (ids.has(instrument.id)) issues.push(`duplicate instrument id "${instrument.id}"`);
        ids.add(instrument.id);
        checkInstrument(instrument, issues);
      }
      issues.forEach((message) => {
        ctx.addIssue(message);
      });
    }),
  );

export interface TuningString {
  /** Position at the nut, 0 = thickest-string side. */
  index: number;
  note: SpelledNote;
  /** 1-based course number; equals `index + 1` unless strings are paired. */
  course: number;
}

export interface Tuning {
  id: string;
  name: string;
  strings: readonly TuningString[];
}

export interface Instrument {
  id: string;
  family: InstrumentFamily;
  name: string;
  detail: string;
  courseSize: 1 | 2;
  bodyStyles: readonly BodyStyle[];
  detection: { minHz: number; maxHz: number };
  defaultTuningId: string;
  tunings: readonly Tuning[];
}

/** Validates catalog data and resolves note names; throws with every problem listed. */
export function parseInstrumentCatalog(data: unknown): readonly Instrument[] {
  const result = instrumentCatalogSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid instrument catalog:\n${z.prettifyError(result.error)}`);
  }
  return result.data.instruments.map((instrument) => {
    const courseSize = instrument.courseSize ?? 1;
    return {
      id: instrument.id,
      family: instrument.family,
      name: instrument.name,
      detail: instrument.detail,
      courseSize,
      bodyStyles: instrument.bodyStyles ?? [],
      detection: instrument.detection,
      defaultTuningId: instrument.defaultTuning,
      tunings: instrument.tunings.map((tuning) => ({
        id: tuning.id,
        name: tuning.name,
        strings: tuning.notes.map((text, index) => ({
          index,
          note: parseNote(text),
          course: Math.floor(index / courseSize) + 1,
        })),
      })),
    };
  });
}

export const INSTRUMENTS = parseInstrumentCatalog(catalogJson);

export const DEFAULT_INSTRUMENT_ID = 'guitar-6';

export function findInstrument(id: string): Instrument | undefined {
  return INSTRUMENTS.find((instrument) => instrument.id === id);
}

export interface InstrumentSelection {
  instrument: Instrument;
  tuning: Tuning;
}

/** Resolves stored ids, falling back to defaults for ids that no longer exist. */
export function resolveSelection(instrumentId: string, tuningId?: string): InstrumentSelection {
  const instrument =
    findInstrument(instrumentId) ?? findInstrument(DEFAULT_INSTRUMENT_ID) ?? INSTRUMENTS[0];
  if (!instrument) throw new Error('The instrument catalog is empty');
  const tuning =
    instrument.tunings.find((candidate) => candidate.id === tuningId) ??
    instrument.tunings.find((candidate) => candidate.id === instrument.defaultTuningId);
  if (!tuning) throw new Error(`Instrument "${instrument.id}" has no default tuning`);
  return { instrument, tuning };
}

/** "Guitar · 6-string". */
export function instrumentLabel(instrument: Instrument): string {
  return `${instrument.name} · ${instrument.detail}`;
}
