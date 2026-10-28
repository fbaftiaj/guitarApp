import { CircleCheck, Mic, MicOff, Music } from 'lucide-react';
import { useParams } from 'react-router';
import { CHORD_LIBRARY_PATH } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import { CHORDS, type Chord } from '@/content/chords';
import { useSettingsStore } from '@/stores/settingsStore';
import { Button } from '@/ui/Button';
import { ButtonLink } from '@/ui/ButtonLink';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { ChordDiagram } from '../practice/components/ChordDiagram';
import { Fretboard } from '../practice/components/Fretboard';
import { MicrophoneAlert } from '../practice/components/MicrophoneAlert';
import { chordFretMarks } from '../practice/practiceView';
import { useChordCheck, type ChordCheck } from './useChordCheck';

function feedback(chord: Chord, check: ChordCheck): { text: string; correct: boolean } {
  if (check.status === 'starting') return { text: 'Starting the microphone…', correct: false };
  const { result } = check;
  if (!result) return { text: `Strum ${chord.name} once and let it ring.`, correct: false };
  if (result.correct) return { text: `That’s ${chord.name}!`, correct: true };
  const heard = result.heardId ? CHORDS.get(result.heardId)?.name : undefined;
  return {
    text: heard
      ? `That sounded like ${heard}. Check each finger and try again.`
      : 'That wasn’t clear. Strum every string the diagram shows, and let it ring.',
    correct: false,
  };
}

/** One chord: its diagram, where it sits on the neck, and a microphone check. */
function ChordCheckView({ chord }: { chord: Chord }) {
  const a4 = useSettingsStore((state) => state.referencePitch);
  const check = useChordCheck(chord.id, a4);
  const listening = check.status !== 'idle';
  const { text, correct } = feedback(chord, check);

  if (check.error === 'audio-unsupported') {
    return (
      <ErrorState
        title="Audio isn’t available"
        description="This browser can’t use the microphone. Try a recent Chrome, Edge, Firefox or Safari."
      />
    );
  }
  return (
    <div className="space-y-4">
      <Card className="flex flex-col items-center gap-4">
        <ChordDiagram chord={chord} showFingers className="w-40" />
        <Fretboard
          marks={chordFretMarks(chord.id)}
          showFingers
          showNoteNames={false}
          label={`${chord.name} on the fretboard`}
        />
        <p className="text-xs text-fg-muted">
          Fingers: 1 index · 2 middle · 3 ring · 4 little. × means leave that string out.
        </p>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Play it</h2>
        {check.error ? (
          <MicrophoneAlert error={check.error} onRetry={check.start} />
        ) : (
          <p
            role="status"
            key={check.result?.attempt}
            className={
              correct
                ? 'flex items-center gap-2 font-semibold text-accent-text motion-safe:animate-pop-in'
                : 'text-fg-muted'
            }
          >
            {correct && <CircleCheck aria-hidden className="size-5 shrink-0" />}
            {listening ? text : 'Hold the chord, then let FretPath listen while you strum it.'}
          </p>
        )}
        {listening ? (
          <Button variant="secondary" icon={MicOff} fullWidth onClick={check.stop}>
            Stop listening
          </Button>
        ) : (
          <Button icon={Mic} fullWidth onClick={check.start}>
            Check it with the microphone
          </Button>
        )}
      </Card>
    </div>
  );
}

export function ChordScreen() {
  const { chordId = '' } = useParams();
  const chord = CHORDS.get(chordId);
  if (!chord) {
    return (
      <Screen title="Chord not found" backTo={CHORD_LIBRARY_PATH} backLabel="Chord library">
        <EmptyState
          icon={Music}
          title="No such chord"
          description="This chord isn’t in the library."
          action={<ButtonLink to={CHORD_LIBRARY_PATH}>Chord library</ButtonLink>}
        />
      </Screen>
    );
  }
  return (
    <Screen title={chord.name} backTo={CHORD_LIBRARY_PATH} backLabel="Chord library">
      <ChordCheckView key={chord.id} chord={chord} />
    </Screen>
  );
}
