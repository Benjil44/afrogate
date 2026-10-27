/**
 * Wraps an async task so at most one run is in flight: a call made while a run
 * is still pending joins that run instead of starting an overlapping one. Used
 * by interval-driven jobs whose passes read a cursor and then advance it (an
 * overlapping pass would read the same cursor and count the same delta twice).
 */
export function singleFlight(task: () => Promise<void>): () => Promise<void> {
  let inFlight: Promise<void> | null = null;
  return () => {
    if (!inFlight) {
      inFlight = task().finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  };
}
