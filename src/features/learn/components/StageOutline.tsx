import { Sparkles } from 'lucide-react';
import type { Stage } from '@/content/course';

/** A preview stage's planned units and lessons, with what each will teach. */
export function StageOutline({ stage }: { stage: Stage }) {
  let number = 0;
  return (
    <>
      <p className="mt-4 flex items-start gap-2 rounded-control border border-border bg-surface p-3 text-sm text-pretty">
        <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-text" />
        These lessons are coming soon. Here is what the stage will cover.
      </p>
      {stage.outline.map((unit, unitIndex) => (
        <section key={unit.id} className="mt-6" aria-labelledby={`unit-${unit.id}`}>
          <h2 id={`unit-${unit.id}`} className="font-semibold">
            <span className="text-fg-muted">Unit {unitIndex + 1} ·</span> {unit.title}
          </h2>
          <p className="mt-0.5 text-sm text-fg-muted">{unit.summary}</p>
          <ol className="mt-2 rounded-card border border-border bg-surface p-1">
            {unit.lessons.map((lesson) => {
              number++;
              return (
                <li key={lesson.id} className="flex items-start gap-3 rounded-card p-3">
                  <span
                    aria-hidden
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-raised text-sm font-bold text-fg-muted"
                  >
                    {number}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{lesson.title}</span>
                    <span className="mt-0.5 block text-sm text-pretty text-fg-muted">
                      {lesson.summary}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </>
  );
}
