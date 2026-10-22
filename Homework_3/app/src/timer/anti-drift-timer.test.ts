
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { createAntiDriftTimer } from "./anti-drift-timer";

describe("Anti-Drift Countdown Timer", () => {
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrameId = 0;

  const runFrame = () => {
    const entry = frames.entries().next().value;

    if (!entry) return;

    const [id, callback] = entry;

    frames.delete(id);
    callback(0);
  };

  beforeEach(() => {
    vi.useFakeTimers();

    vi.setSystemTime(
      new Date("2026-11-11T00:00:00.000Z")
    );

    frames.clear();
    nextFrameId = 0;

    vi.stubGlobal(
      "requestAnimationFrame",
      (callback: FrameRequestCallback) => {
        const id = ++nextFrameId;
        frames.set(id, callback);
        return id;
      }
    );

    vi.stubGlobal(
      "cancelAnimationFrame",
      (id: number) => {
        frames.delete(id);
      }
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("starts with the correct remaining time", () => {
    const onTick = vi.fn();

    const cleanup = createAntiDriftTimer(
      60_000,
      onTick
    );

    expect(onTick).toHaveBeenCalledWith(60_000);

    cleanup();
  });

  it("calculates remaining time without drift", () => {
    const onTick = vi.fn();

    createAntiDriftTimer(60_000, onTick);

    // Simulate a delayed animation frame
    vi.advanceTimersByTime(25_000);
    runFrame();

    expect(onTick).toHaveBeenLastCalledWith(
      35_000
    );

    // Simulate another delayed frame
    vi.advanceTimersByTime(20_000);
    runFrame();

    expect(onTick).toHaveBeenLastCalledWith(
      15_000
    );

    // Reach the deadline
    vi.advanceTimersByTime(15_000);
    runFrame();

    expect(onTick).toHaveBeenLastCalledWith(0);
    expect(frames.size).toBe(0);
  });

  it("cancels scheduled animation frames", () => {
    const onTick = vi.fn();

    const cleanup = createAntiDriftTimer(
      10_000,
      onTick
    );

    expect(frames.size).toBe(1);

    cleanup();

    expect(frames.size).toBe(0);

    vi.advanceTimersByTime(10_000);
    runFrame();

    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid durations", () => {
    expect(() =>
      createAntiDriftTimer(-100, vi.fn())
    ).toThrow(RangeError);

    expect(() =>
      createAntiDriftTimer(Number.NaN, vi.fn())
    ).toThrow(RangeError);
  });
});

