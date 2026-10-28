import { cx } from '@/ui/cx';

/** A thin bar with “3 of 15 lessons” beside it. */
export function ProgressMeter({
  done,
  total,
  className,
}: {
  done: number;
  total: number;
  className?: string;
}) {
  const ratio = total > 0 ? done / total : 0;
  return (
    <div className={cx('flex items-center gap-3', className)}>
      <div aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-raised">
        <div
          className="h-full rounded-full bg-accent forced-colors:bg-[Highlight]"
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <span className="shrink-0 text-xs font-medium text-fg-muted tabular-nums">
        {done} of {total} lessons
      </span>
    </div>
  );
}
