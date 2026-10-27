interface LoadingStateProps {
  label?: string;
}

export function LoadingState({ label = 'Loading…' }: LoadingStateProps) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-3 py-16 text-fg-muted"
    >
      <span
        aria-hidden
        className="size-8 rounded-full border-[3px] border-border border-t-accent motion-safe:animate-spin"
      />
      <span className="text-sm">{label}</span>
    </div>
  );
}
