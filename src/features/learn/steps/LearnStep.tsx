import { Check, Gauge, Lightbulb, X } from 'lucide-react';
import { TUNER_PATH } from '@/app/navigation';
import { CHORDS } from '@/content/chords';
import type { Lesson } from '@/content/course';
import { findSong } from '@/content/songs';
import { ButtonLink } from '@/ui/ButtonLink';
import { Card } from '@/ui/Card';
import { ChordDiagram } from '../../practice/components/ChordDiagram';
import { SongChart } from '../../songs/components/SongChart';
import { FingerNumbersFigure } from '../components/FingerNumbersFigure';
import { FretboardDemo } from '../components/FretboardDemo';
import { GuitarPartsFigure } from '../components/GuitarPartsFigure';
import { TabView } from '../components/TabView';
import { lessonChords, phraseExercise } from '../lessonVisuals';

const FIGURES = { 'guitar-parts': GuitarPartsFigure, 'finger-numbers': FingerNumbersFigure };

function FingerKey() {
  return (
    <p className="text-xs text-fg-muted">
      Fingers: <span className="font-semibold text-fg">1</span> index ·{' '}
      <span className="font-semibold text-fg">2</span> middle ·{' '}
      <span className="font-semibold text-fg">3</span> ring ·{' '}
      <span className="font-semibold text-fg">4</span> little
    </p>
  );
}

/** What and why, how to play it, diagrams or tab, a demo, mistakes to avoid. */
export function LearnStep({ lesson }: { lesson: Lesson }) {
  const { learn } = lesson;
  const Figure = learn.figure ? FIGURES[learn.figure] : null;
  const song = lesson.songId ? findSong(lesson.songId) : undefined;
  const phrase = phraseExercise(lesson);
  const chords = lessonChords(lesson.exercise).flatMap((id) => {
    const chord = CHORDS.get(id);
    return chord ? [chord] : [];
  });

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <p className="text-pretty">{learn.what}</p>
        {Figure && <Figure />}
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">How to play it</h2>
        <ol className="list-decimal space-y-2 pl-5 text-pretty marker:font-semibold marker:text-accent-text">
          {learn.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        {learn.tool === 'tuner' && (
          <ButtonLink to={TUNER_PATH} variant="secondary" icon={Gauge} className="mt-4">
            Open the tuner
          </ButtonLink>
        )}
      </Card>

      {song && (
        <Card>
          <h2 className="mb-1 font-semibold">Song chart</h2>
          <p className="mb-3 text-sm text-fg-muted">{song.credit}</p>
          <SongChart song={song} />
        </Card>
      )}

      {chords.length > 0 && (
        <Card>
          <h2 className="mb-2 font-semibold">{chords.length === 1 ? 'The chord' : 'The chords'}</h2>
          <ul className="flex flex-wrap gap-4">
            {chords.map((chord) => (
              <li key={chord.id} className="text-center">
                <ChordDiagram chord={chord} showFingers />
                <span className="mt-1 block text-sm font-semibold">{chord.name}</span>
              </li>
            ))}
          </ul>
          <FingerKey />
        </Card>
      )}

      {phrase.kind === 'notes' && (
        <Card>
          <h2 className="mb-2 font-semibold">The tab</h2>
          <TabView exercise={phrase} />
          {phrase.bars.some((bar) => bar.notes.some((note) => note.finger !== null)) && (
            <FingerKey />
          )}
        </Card>
      )}

      <Card>
        <h2 className="mb-1 font-semibold">Watch it</h2>
        <p className="mb-2 text-sm text-fg-muted">
          {phrase.kind === 'chords'
            ? 'Where your fingers go and which way each strum moves.'
            : 'Each note in turn, with the finger to use.'}
        </p>
        <FretboardDemo exercise={phrase} />
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">Common mistakes</h2>
        <ul className="space-y-3">
          {learn.mistakes.map(({ mistake, fix }) => (
            <li key={mistake} className="space-y-1 text-pretty">
              <p className="flex gap-2">
                <X aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />
                <span>
                  <span className="sr-only">Mistake: </span>
                  {mistake}
                </span>
              </p>
              <p className="flex gap-2 text-fg-muted">
                <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-text" />
                <span>
                  <span className="sr-only">Fix: </span>
                  {fix}
                </span>
              </p>
            </li>
          ))}
        </ul>
      </Card>

      {learn.tip && (
        <p className="flex gap-2 rounded-card border border-accent/40 bg-accent/10 p-4 text-sm text-pretty">
          <Lightbulb aria-hidden className="size-5 shrink-0 text-accent-text" />
          <span>
            <span className="font-semibold">Tip: </span>
            {learn.tip}
          </span>
        </p>
      )}
    </div>
  );
}
