import type { SkillMeter } from '../stats';
import { SKILL_LABELS } from '../skillLabels';

/** One bar per skill, from real practice results. */
export function SkillMeters({ meters }: { meters: readonly SkillMeter[] }) {
  return (
    <ul className="space-y-4">
      {meters.map(({ skill, value, sessions }) => {
        const { name, description } = SKILL_LABELS[skill];
        const shown = value === null ? null : Math.round(value * 100);
        return (
          <li key={skill}>
            <div className="flex items-baseline justify-between gap-3">
              <span id={`skill-${skill}`} className="font-semibold">
                {name}
              </span>
              <span className="text-sm text-fg-muted">
                {shown === null ? 'Not practised yet' : `${shown}%`}
              </span>
            </div>
            <div
              role="meter"
              aria-labelledby={`skill-${skill}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={shown ?? 0}
              aria-valuetext={
                shown === null
                  ? 'Not practised yet'
                  : `${shown}%, from ${sessions} ${sessions === 1 ? 'session' : 'sessions'}`
              }
              className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-raised"
            >
              {shown !== null && (
                <div
                  className="h-full rounded-full bg-chart forced-colors:bg-[Highlight]"
                  style={{ width: `${shown}%` }}
                />
              )}
            </div>
            <p className="mt-1 text-xs text-fg-muted">
              {description}
              {sessions > 0 && ` · ${sessions} ${sessions === 1 ? 'session' : 'sessions'}`}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
