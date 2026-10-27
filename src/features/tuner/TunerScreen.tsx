import { ChevronDown, SlidersHorizontal, Square } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Screen } from '@/app/Screen';
import type { ToneTimbre } from '@/audio/synth/referenceTone';
import {
  instrumentLabel,
  resolveSelection,
  type BodyStyle,
  type Instrument,
} from '@/content/instruments';
import { midiToFrequency, spokenNote } from '@/lib/music/notes';
import { vibrate } from '@/platform/haptics';
import { useWakeLock } from '@/platform/useWakeLock';
import { useSettingsStore } from '@/stores/settingsStore';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import { SegmentedControl, type SegmentedOption } from '@/ui/SegmentedControl';
import { Headstock, type HeadstockStyle } from './components/Headstock';
import { InstrumentSheet } from './components/InstrumentSheet';
import { CueLine, NoteBadge } from './components/NoteReadout';
import { StartPanel } from './components/StartPanel';
import { TunedBanner } from './components/TunedBanner';
import { TunerMeter } from './components/TunerMeter';
import { TunerSettingsSheet } from './components/TunerSettingsSheet';
import type { TunerEvent, TunerMode, TunerTarget } from './tunerEngine';
import { useTunerStore } from './tunerStore';
import { useTunerSession } from './useTunerSession';

const MODE_OPTIONS: readonly SegmentedOption<TunerMode>[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'manual', label: 'Manual' },
  { value: 'chromatic', label: 'Chromatic' },
];

function toneTimbre(instrument: Instrument, bodyStyle: BodyStyle): ToneTimbre {
  if (instrument.family === 'bass') return 'bass';
  if (instrument.family === 'ukulele') return 'nylon';
  return instrument.bodyStyles.length > 0 && bodyStyle === 'electric' ? 'electric' : 'acoustic';
}

function headstockStyle(instrument: Instrument, bodyStyle: BodyStyle): HeadstockStyle {
  if (instrument.family === 'bass') return 'bass';
  if (instrument.family === 'ukulele') return 'ukulele';
  return instrument.bodyStyles.length > 0 && bodyStyle === 'electric' ? 'electric' : 'acoustic';
}

const HINTS: Record<Exclude<TunerMode, 'chromatic'>, string> = {
  auto: 'Play any string and FretPath finds it. Tap a peg to hear its note.',
  manual: 'Tap a peg to choose the string to tune and hear its note.',
};

export function TunerScreen() {
  const instrumentId = useTunerStore((state) => state.instrumentId);
  const tuningByInstrument = useTunerStore((state) => state.tuningByInstrument);
  const bodyStyle = useTunerStore((state) => state.bodyStyle);
  const mode = useTunerStore((state) => state.mode);
  const setMode = useTunerStore((state) => state.setMode);
  const a4 = useSettingsStore((state) => state.referencePitch);
  const { instrument, tuning } = resolveSelection(instrumentId, tuningByInstrument[instrumentId]);

  const [sheet, setSheet] = useState<'instrument' | 'settings' | null>(null);
  const [announcement, setAnnouncement] = useState('');
  // The manual-mode string belongs to one tuning; another tuning starts at its first string.
  const tuningKey = `${instrument.id}/${tuning.id}`;
  const [manual, setManual] = useState({ tuningKey, index: 0 });
  const selectedIndex = manual.tuningKey === tuningKey ? manual.index : 0;

  const targets = useMemo<TunerTarget[]>(
    () =>
      tuning.strings.map(({ index, note }) => ({
        index,
        note,
        frequency: midiToFrequency(note.midi, a4),
      })),
    [tuning, a4],
  );
  const range = useMemo(
    () => ({ minFrequency: instrument.detection.minHz, maxFrequency: instrument.detection.maxHz }),
    [instrument],
  );

  const onEvent = useCallback(
    (event: TunerEvent) => {
      if (event.type === 'all-tuned') {
        vibrate([60, 80, 60]);
        setAnnouncement(`${instrument.name} tuned! All strings are in tune.`);
        return;
      }
      const target = targets[event.indices[0] ?? -1];
      if (!target) return;
      if (event.type === 'tuned') vibrate(40);
      setAnnouncement(
        `${spokenNote(target.note)} ${event.type === 'tuned' ? 'is in tune' : 'is out of tune'}`,
      );
    },
    [instrument, targets],
  );

  const session = useTunerSession({
    mode,
    targets,
    a4,
    selectedIndex,
    range,
    timbre: toneTimbre(instrument, bodyStyle),
    onEvent,
  });
  const { status, snapshot, playReference } = session;
  const listening = status === 'listening';
  useWakeLock(listening);

  const onPegPress = useCallback(
    (index: number) => {
      if (mode === 'manual') setManual({ tuningKey, index });
      playReference(index);
    },
    [mode, playReference, tuningKey],
  );

  const activeIndex = mode === 'manual' ? selectedIndex : snapshot.reading.targetIndex;

  return (
    <Screen
      title="Tuner"
      actions={
        <>
          {listening && (
            <Button variant="ghost" icon={Square} onClick={session.stop}>
              Stop
            </Button>
          )}
          <IconButton
            icon={SlidersHorizontal}
            label="Tuner settings"
            onClick={() => {
              setSheet('settings');
            }}
            className="-mr-2"
          />
        </>
      }
    >
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => {
            setSheet('instrument');
          }}
          className="flex min-h-12 w-full items-center gap-3 rounded-control border border-border bg-surface px-4 py-2 text-left transition-colors hover:border-border-strong"
        >
          <span className="min-w-0 flex-1 truncate">
            <span className="font-semibold">{instrumentLabel(instrument)}</span>
            <span className="text-fg-muted"> · {tuning.name}</span>
          </span>
          <ChevronDown aria-hidden className="size-5 shrink-0 text-fg-muted" />
          <span className="sr-only">Change instrument or tuning</span>
        </button>

        <SegmentedControl
          legend="Tuner mode"
          hideLegend
          name="tuner-mode"
          options={MODE_OPTIONS}
          value={mode}
          onChange={setMode}
        />

        <section aria-label="Tuner">
          {status === 'listening' ? (
            <div className="min-h-72">
              <TunerMeter
                centsRef={session.centsRef}
                cents={snapshot.reading.cents}
                cue={snapshot.reading.cue}
                active
              >
                <NoteBadge reading={snapshot.reading} />
              </TunerMeter>
              <CueLine reading={snapshot.reading} mode={mode} />
            </div>
          ) : (
            <StartPanel status={status} error={session.error} onStart={session.start} />
          )}
        </section>

        {snapshot.allTuned && mode !== 'chromatic' && (
          <TunedBanner
            instrumentName={instrument.name}
            stringCount={targets.length}
            onTuneAgain={session.resetTuned}
          />
        )}

        {mode === 'chromatic' ? (
          <p className="text-center text-sm text-fg-muted">
            Names any note you play · A4 = {a4} Hz
          </p>
        ) : (
          <div>
            <Headstock
              strings={tuning.strings}
              courseSize={instrument.courseSize}
              style={headstockStyle(instrument, bodyStyle)}
              activeIndex={activeIndex}
              selectable={mode === 'manual'}
              tuned={snapshot.tuned}
              onPegPress={onPegPress}
            />
            <p className="mt-2 text-center text-xs text-fg-muted">{HINTS[mode]}</p>
          </div>
        )}
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      <InstrumentSheet
        open={sheet === 'instrument'}
        onClose={() => {
          setSheet(null);
        }}
      />
      <TunerSettingsSheet
        open={sheet === 'settings'}
        onClose={() => {
          setSheet(null);
        }}
      />
    </Screen>
  );
}
