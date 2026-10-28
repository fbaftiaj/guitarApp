import { ArrowDown, ArrowUp } from 'lucide-react';
import { memo, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { noteName, spellMidi } from '@/lib/music/notes';
import { cx } from '@/ui/cx';
import type { Timeline } from '../engine/timeline';
import type { BeatRange } from '../engine/transport';
import type { HitMark } from '../listening/practiceListening';

interface HighwayProps {
  timeline: Timeline;
  /** Per-frame position updates while the transport moves. */
  subscribe: (listener: (beat: number) => void) => () => void;
  /** Position to show while still (idle, paused, waiting, finished). */
  beat: number;
  moving: boolean;
  chordIndex: number;
  noteIndex: number;
  loop: BeatRange | null;
  showChordNames: boolean;
  showNoteNames: boolean;
  /** Judged strums or notes of the current pass, by index. */
  marks?: ReadonlyMap<number, HitMark> | undefined;
  /** Overlay, e.g. the count-in. */
  children?: ReactNode;
}

const NO_MARKS: ReadonlyMap<number, HitMark> = new Map();

const MARK_RING: Record<HitMark, string> = {
  good: 'ring-accent',
  off: 'ring-warning',
  wrong: 'ring-danger',
  miss: 'ring-danger/50',
};

const MARK_BACKGROUND: Record<HitMark, string> = {
  good: 'bg-accent/30',
  off: 'bg-warning/30',
  wrong: 'bg-danger/30',
  miss: 'bg-danger/15',
};

/** A symbol for each mark, so the result never depends on colour alone. */
const MARK_GLYPH: Record<HitMark, string> = {
  good: '✓',
  off: '~',
  wrong: '✗',
  miss: '–',
};

const MARK_TEXT: Record<HitMark, string> = {
  good: 'text-accent-text',
  off: 'text-warning',
  wrong: 'text-danger',
  miss: 'text-fg-muted',
};

function MarkGlyph({ mark, className }: { mark: HitMark; className?: string }) {
  return (
    <span
      className={cx(
        'absolute flex size-3.5 items-center justify-center rounded-full bg-surface text-[10px] leading-none font-bold',
        MARK_TEXT[mark],
        className,
      )}
    >
      {MARK_GLYPH[mark]}
    </span>
  );
}

const PX_PER_BEAT = 72;
/** Where the "now" line sits, from the left edge. */
const NOW_X = 56;
const STRING_ROW = 18;
/** Top of the tab lane, below the compact chord lane. */
const TAB_TOP = 40;
const STRING_TEXT = [
  'text-string-1',
  'text-string-2',
  'text-string-3',
  'text-string-4',
  'text-string-5',
  'text-string-6',
];
const STRING_BORDER = [
  'border-string-1',
  'border-string-2',
  'border-string-3',
  'border-string-4',
  'border-string-5',
  'border-string-6',
];
const STRING_LINE = [
  'bg-string-1',
  'bg-string-2',
  'bg-string-3',
  'bg-string-4',
  'bg-string-5',
  'bg-string-6',
];

/**
 * The scrolling timeline. Everything is laid out once; playback only moves
 * the track with a compositor-friendly transform on each animation frame, so
 * React does not re-render at frame rate.
 */
export function Highway({
  timeline,
  subscribe,
  beat,
  moving,
  chordIndex,
  noteIndex,
  loop,
  showChordNames,
  showNoteNames,
  marks = NO_MARKS,
  children,
}: HighwayProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(
    () =>
      subscribe((position) => {
        const track = trackRef.current;
        if (track) track.style.transform = `translate3d(${NOW_X - position * PX_PER_BEAT}px, 0, 0)`;
      }),
    [subscribe],
  );
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (track && !moving) {
      track.style.transform = `translate3d(${NOW_X - beat * PX_PER_BEAT}px, 0, 0)`;
    }
  }, [beat, moving]);

  const notes = timeline.kind === 'notes';
  const height = notes ? TAB_TOP + STRING_ROW * 6 + 4 : 112;

  return (
    <div
      aria-hidden
      className="relative overflow-hidden rounded-card border border-border bg-surface select-none"
      style={{ height }}
    >
      <div
        ref={trackRef}
        data-testid="highway-track"
        className="absolute inset-y-0 left-0 will-change-transform"
        style={{
          width: timeline.totalBeats * PX_PER_BEAT + 2,
          transform: `translate3d(${NOW_X - beat * PX_PER_BEAT}px, 0, 0)`,
        }}
      >
        <Grid timeline={timeline} />
        {notes ? (
          <TabLane
            timeline={timeline}
            noteIndex={noteIndex}
            showNoteNames={showNoteNames}
            marks={marks}
          />
        ) : (
          <StrumLane timeline={timeline} marks={marks} />
        )}
        <ChordLane
          timeline={timeline}
          chordIndex={chordIndex}
          showChordNames={showChordNames}
          compact={notes}
        />
        {loop && <LoopShade timeline={timeline} loop={loop} />}
      </div>
      <div className="absolute inset-y-0 w-0.5 bg-accent" style={{ left: NOW_X - 1 }} />
      {children}
    </div>
  );
}

const Grid = memo(function Grid({ timeline }: { timeline: Timeline }) {
  const { totalBeats, beatsPerBar } = timeline;
  return (
    <>
      {Array.from({ length: totalBeats + 1 }, (_, beat) => {
        const barLine = beat % beatsPerBar === 0;
        return (
          <div
            key={beat}
            className={cx(
              'absolute bottom-0 w-px',
              barLine ? 'top-0 bg-border-strong' : 'top-5 bg-border',
            )}
            style={{ left: beat * PX_PER_BEAT }}
          >
            {barLine && beat < totalBeats && (
              <span className="absolute top-0.5 left-1 text-[10px] font-semibold text-fg-subtle">
                {beat / beatsPerBar + 1}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
});

function ChordLane({
  timeline,
  chordIndex,
  showChordNames,
  compact,
}: {
  timeline: Timeline;
  chordIndex: number;
  showChordNames: boolean;
  compact: boolean;
}) {
  if (compact && !showChordNames) return null;
  return (
    <>
      {timeline.chords.map((segment) => (
        <div
          key={segment.index}
          className={cx(
            'absolute flex items-center overflow-hidden rounded-md border px-2 font-semibold whitespace-nowrap',
            compact ? 'top-4 h-5 text-xs' : 'top-5 h-8 text-base',
            segment.index === chordIndex
              ? 'border-accent bg-accent/15 text-fg'
              : 'border-border bg-surface-raised text-fg-muted',
          )}
          style={{
            left: segment.beat * PX_PER_BEAT + 4,
            width: segment.duration * PX_PER_BEAT - 8,
          }}
        >
          {showChordNames ? segment.chordId : ''}
        </div>
      ))}
    </>
  );
}

const StrumLane = memo(function StrumLane({
  timeline,
  marks,
}: {
  timeline: Timeline;
  marks: ReadonlyMap<number, HitMark>;
}) {
  const { totalBeats, slotsPerBeat, beatsPerBar } = timeline;
  const strums = new Map(timeline.strums.map((strum, index) => [strum.beat, { strum, index }]));
  const slotWidth = PX_PER_BEAT / slotsPerBeat;
  return (
    <>
      {Array.from({ length: totalBeats * slotsPerBeat }, (_, slot) => {
        const beat = slot / slotsPerBeat;
        const entry = strums.get(beat);
        const mark = entry ? marks.get(entry.index) : undefined;
        const Icon = entry?.strum.direction === 'up' ? ArrowUp : ArrowDown;
        return (
          <div
            key={slot}
            className={cx(
              'absolute top-14 flex h-12 items-center justify-center rounded-md transition-colors',
              mark && MARK_BACKGROUND[mark],
            )}
            style={{ left: beat * PX_PER_BEAT - slotWidth / 2 + 1, width: slotWidth }}
          >
            {entry ? (
              <Icon
                strokeWidth={beat % beatsPerBar === 0 ? 3.25 : 2.5}
                className={cx('size-7', entry.strum.direction === 'up' ? 'text-flat' : 'text-fg')}
              />
            ) : (
              <span className="size-1.5 rounded-full bg-fg-subtle/60" />
            )}
            {mark && <MarkGlyph mark={mark} className="-bottom-1" />}
          </div>
        );
      })}
    </>
  );
});

function TabLane({
  timeline,
  noteIndex,
  showNoteNames,
  marks,
}: {
  timeline: Timeline;
  noteIndex: number;
  showNoteNames: boolean;
  marks: ReadonlyMap<number, HitMark>;
}) {
  const top = TAB_TOP;
  return (
    <>
      {STRING_LINE.map((color, i) => (
        <div
          key={color}
          className={cx('absolute inset-x-0 h-px opacity-70', color)}
          style={{ top: top + i * STRING_ROW + STRING_ROW / 2 }}
        />
      ))}
      {timeline.notes.map((note) => (
        <div
          key={note.index}
          className={cx(
            'absolute flex h-4 min-w-5 -translate-x-1/2 items-center justify-center gap-0.5 rounded-sm border px-1 text-[11px] leading-none font-bold tabular-nums',
            STRING_TEXT[note.string - 1],
            STRING_BORDER[note.string - 1],
            'bg-surface',
            marks.has(note.index)
              ? cx('ring-2', MARK_RING[marks.get(note.index) ?? 'miss'])
              : note.index === noteIndex && 'ring-2 ring-fg',
          )}
          style={{
            left: note.beat * PX_PER_BEAT,
            top: top + (note.string - 1) * STRING_ROW + 1,
          }}
        >
          {note.fret}
          {marks.has(note.index) && (
            <MarkGlyph mark={marks.get(note.index) ?? 'miss'} className="-top-2.5 -right-2.5" />
          )}
          {showNoteNames && (
            <span className="font-semibold text-fg-muted">{noteName(spellMidi(note.midi))}</span>
          )}
        </div>
      ))}
    </>
  );
}

function LoopShade({ timeline, loop }: { timeline: Timeline; loop: BeatRange }) {
  return (
    <>
      <div
        className="absolute inset-y-0 left-0 bg-bg/70"
        style={{ width: loop.start * PX_PER_BEAT }}
      />
      <div
        className="absolute inset-y-0 bg-bg/70"
        style={{
          left: loop.end * PX_PER_BEAT,
          width: (timeline.totalBeats - loop.end) * PX_PER_BEAT + 2,
        }}
      />
    </>
  );
}
