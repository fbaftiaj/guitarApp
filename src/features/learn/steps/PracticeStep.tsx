import { Mic } from 'lucide-react';
import { lessonPath, trainerPath } from '@/app/navigation';
import type { Lesson } from '@/content/course';
import { ButtonLink } from '@/ui/ButtonLink';
import { Card } from '@/ui/Card';
import { Practicer } from '../../practice/Practicer';
import { lessonChords } from '../lessonVisuals';

/** Learning chord by chord makes sense for a few chords; longer sets go straight to changes. */
const LEARN_UP_TO = 2;

/**
 * Practice at your own pace: chords in the trainer (which waits for you),
 * then the play-along practicer at a tempo you choose.
 */
export function PracticeStep({ lesson }: { lesson: Lesson }) {
  const chords = lessonChords(lesson.exercise);
  return (
    <div className="space-y-6">
      {chords.length > 0 && (
        <Card className="border-accent/40">
          <h2 className="flex items-center gap-2 font-semibold">
            <Mic aria-hidden className="size-5 text-accent-text" />
            Chord trainer
          </h2>
          <p className="mt-1 text-sm text-pretty text-fg-muted">
            {chords.length <= LEARN_UP_TO
              ? `Learn ${chords.join(' and ')} string by string, then change between them. `
              : `Change between ${chords.join(', ')} at your own pace. `}
            FretPath listens and only moves on when you play it right.
          </p>
          <ButtonLink
            to={trainerPath({
              chords,
              learn: chords.length <= LEARN_UP_TO,
              back: lessonPath(lesson.id, 'practice'),
            })}
            size="lg"
            fullWidth
            icon={Mic}
            className="mt-4"
          >
            Open the chord trainer
          </ButtonLink>
        </Card>
      )}
      <section aria-labelledby="play-along">
        <h2 id="play-along" className="mb-3 font-semibold">
          Play along
        </h2>
        <Practicer exercise={lesson.exercise} />
      </section>
    </div>
  );
}
