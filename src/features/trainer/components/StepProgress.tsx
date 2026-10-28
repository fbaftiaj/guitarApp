import { sectionsOf, type TrainerStep } from '../trainerPlan';

/** One bar per section, filling as its steps are done. */
export function StepProgress({ plan, step }: { plan: readonly TrainerStep[]; step: number }) {
  const sections = sectionsOf(plan);
  return (
    <div
      role="progressbar"
      aria-label="Progress"
      aria-valuemin={0}
      aria-valuemax={plan.length}
      aria-valuenow={Math.min(step, plan.length)}
      className="flex gap-1.5"
    >
      {sections.map((section) => {
        const done = Math.min(
          1,
          Math.max(0, (step - section.start) / (section.end - section.start)),
        );
        return (
          <div key={section.key} className="min-w-0 flex-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-raised">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-300 forced-colors:bg-[Highlight]"
                style={{ width: `${done * 100}%` }}
              />
            </div>
            <p className="mt-1 truncate text-center text-xs text-fg-muted">{section.label}</p>
          </div>
        );
      })}
    </div>
  );
}
