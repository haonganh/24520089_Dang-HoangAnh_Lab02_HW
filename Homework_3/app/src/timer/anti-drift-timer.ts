
/**
 * Precision Anti-Drift Countdown Timer
 *
 * Uses Date.now() to calculate actual remaining time.
 * Uses requestAnimationFrame() to schedule updates.
 *
 * Prevents timing drift caused by setInterval().
 */

export function createAntiDriftTimer(
  durationMs: number,
  onTick: (remaining: number) => void
): () => void {
  // Validate timer duration
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    throw new RangeError(
      "Timer duration must be a non-negative finite number."
    );
  }

  // Calculate the absolute deadline
  const targetTime = Date.now() + durationMs;

  let rafId: number | null = null;
  let isCancelled = false;

  /**
   * Update the countdown using actual elapsed time.
   */
  function tick(): void {
    if (isCancelled) return;

    // Calculate remaining time without accumulating drift
    const remaining = Math.max(
      0,
      targetTime - Date.now()
    );

    // Notify the subscriber
    onTick(remaining);

    // Schedule the next frame only when necessary
    if (remaining > 0 && !isCancelled) {
      rafId = requestAnimationFrame(tick);
    } else {
      rafId = null;
      isCancelled = true;
    }
  }

  // Start countdown immediately
  tick();

  /**
   * Cleanup function.
   * Prevents memory leaks and unnecessary animation frames.
   */
  return function cleanup(): void {
    isCancelled = true;

    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };
}
