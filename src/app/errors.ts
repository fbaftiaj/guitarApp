/**
 * True when a lazily loaded chunk failed to download, typically because the
 * device is offline or a new deployment replaced the old files.
 */
export function isChunkLoadError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /dynamically imported module|importing a module script failed|failed to fetch/i.test(
      error.message,
    )
  );
}
