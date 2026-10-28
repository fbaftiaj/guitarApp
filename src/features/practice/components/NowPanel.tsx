import { CHORDS } from '@/content/chords';
import { noteName, spellMidi } from '@/lib/music/notes';
import { cx } from '@/ui/cx';
import type { ChordSegment, NoteEvent } from '../engine/timeline';
import { chordFretMarks, describeNote } from '../practiceView';
import { ChordDiagram } from './ChordDiagram';
import { Fretboard } from './Fretboard';

interface NowPanelProps {
  chord: ChordSegment | null;
  nextChord: ChordSegment | null;
  note: NoteEvent | null;
  nextNote: NoteEvent | null;
  kind: 'chords' | 'notes';
  showChordNames: boolean;
  showFingers: boolean;
  showNoteNames: boolean;
  showFretboard: boolean;
}

const STRING_BG = [
  'bg-string-1',
  'bg-string-2',
  'bg-string-3',
  'bg-string-4',
  'bg-string-5',
  'bg-string-6',
];

function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function NoteLine({
  note,
  showFingers,
  showNoteNames,
  size,
}: {
  note: NoteEvent;
  showFingers: boolean;
  showNoteNames: boolean;
  size: 'md' | 'sm';
}) {
  return (
    <p
      className={cx(
        'flex items-center gap-2',
        size === 'md' ? 'text-lg font-semibold' : 'text-sm text-fg-muted',
      )}
    >
      <span
        aria-hidden
        className={cx('size-3 shrink-0 rounded-full', STRING_BG[note.string - 1])}
      />
      <span>
        {sentenceCase(describeNote(note))}
        {showFingers && note.finger && <span>, finger {note.finger}</span>}
        {showNoteNames && <span> · {noteName(spellMidi(note.midi))}</span>}
      </span>
    </p>
  );
}

/** What to play now and next: chord diagrams, or the note on its string and fret. */
export function NowPanel({
  chord,
  nextChord,
  note,
  nextNote,
  kind,
  showChordNames,
  showFingers,
  showNoteNames,
  showFretboard,
}: NowPanelProps) {
  const current = chord ? CHORDS.get(chord.chordId) : undefined;
  const next = nextChord ? CHORDS.get(nextChord.chordId) : undefined;

  if (kind === 'chords') {
    return (
      <div>
        <div className="flex items-end justify-between gap-4">
          <div className="flex items-end gap-3">
            {current && <ChordDiagram chord={current} showFingers={showFingers} />}
            <div className="pb-2">
              <p className="text-xs font-semibold tracking-wide text-fg-muted uppercase">Now</p>
              {showChordNames && current && (
                <p className="text-4xl font-bold tracking-tight">{current.id}</p>
              )}
            </div>
          </div>
          <div className="flex items-end gap-2">
            <div className="pb-2 text-right">
              <p className="text-xs font-semibold tracking-wide text-fg-muted uppercase">Next</p>
              {showChordNames && (
                <p className="text-xl font-semibold text-fg-muted">{next?.id ?? 'End'}</p>
              )}
            </div>
            {next && <ChordDiagram chord={next} showFingers={showFingers} size="sm" />}
          </div>
        </div>
        {showFretboard && current && (
          <div className="mt-3">
            <Fretboard
              marks={chordFretMarks(current.id)}
              showFingers={showFingers}
              showNoteNames={showNoteNames}
              label={`${current.name} on the fretboard`}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
          Now{chord && showChordNames ? ` · over ${chord.chordId}` : ''}
        </p>
        {note ? (
          <NoteLine note={note} showFingers={showFingers} showNoteNames={showNoteNames} size="md" />
        ) : (
          <p className="text-lg font-semibold text-fg-muted">Get ready</p>
        )}
      </div>
      <div>
        <p className="text-xs font-semibold tracking-wide text-fg-muted uppercase">Next</p>
        {nextNote ? (
          <NoteLine
            note={nextNote}
            showFingers={showFingers}
            showNoteNames={showNoteNames}
            size="sm"
          />
        ) : (
          <p className="text-sm text-fg-muted">End</p>
        )}
      </div>
      {showFretboard && note && (
        <Fretboard
          marks={[{ string: note.string, fret: note.fret, finger: note.finger, midi: note.midi }]}
          showFingers={showFingers}
          showNoteNames={showNoteNames}
          label={`${describeNote(note)} on the fretboard`}
        />
      )}
    </div>
  );
}
