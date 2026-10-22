
import { useEffect, useRef, useState } from "react";
import { createAntiDriftTimer } from "../timer/anti-drift-timer";
import "./CountdownTimer.css";

const SALE_DURATION_MS = 60_000;

type CountdownPhase = "ready" | "counting" | "live";

interface CountdownTimerProps {
  onSaleStateChange?: (isLive: boolean) => void;
}

function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(
    (totalSeconds % 3600) / 60
  );
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export default function CountdownTimer({
  onSaleStateChange,
}: CountdownTimerProps) {
  const [remainingSeconds, setRemainingSeconds] =
    useState(Math.ceil(SALE_DURATION_MS / 1000));

  const [phase, setPhase] =
    useState<CountdownPhase>("ready");

  const cleanupRef = useRef<(() => void) | null>(null);

  const isRunning = phase === "counting";
  const isLive = phase === "live";

  // Notify the parent when sale state changes
  useEffect(() => {
    onSaleStateChange?.(isLive);
  }, [isLive, onSaleStateChange]);

  // Start anti-drift countdown
  useEffect(() => {
    if (!isRunning) return;

    const cleanup = createAntiDriftTimer(
      SALE_DURATION_MS,
      (remainingMs) => {
        const seconds = Math.ceil(remainingMs / 1000);

        setRemainingSeconds((previous) =>
          previous === seconds ? previous : seconds
        );

        if (remainingMs === 0) {
          setPhase("live");
        }
      }
    );

    cleanupRef.current = cleanup;

    return () => {
      cleanup();

      if (cleanupRef.current === cleanup) {
        cleanupRef.current = null;
      }
    };
  }, [isRunning]);

  const handleStart = () => {
    if (phase !== "ready") return;

    setRemainingSeconds(
      Math.ceil(SALE_DURATION_MS / 1000)
    );

    setPhase("counting");
  };

  const handleReset = () => {
    cleanupRef.current?.();
    cleanupRef.current = null;

    setPhase("ready");

    setRemainingSeconds(
      Math.ceil(SALE_DURATION_MS / 1000)
    );
  };

  const statusMessage =
    phase === "ready"
      ? "Countdown ready. Press Start Countdown to begin."
      : phase === "counting"
        ? "Countdown running. Flash sale starts at zero."
        : "Countdown complete. Flash sale is now live.";

  return (
    <div className="countdown-widget">
      <div className="countdown-header">
        <span className="countdown-label">
          FLASH SALE STARTS IN
        </span>

        <span
          className={`sale-status ${
            isLive ? "sale-live" : ""
          }`}
        >
          {isLive
            ? "LIVE"
            : isRunning
              ? "COUNTING DOWN"
              : "READY"}
        </span>
      </div>

      <div
        className="countdown-display"
        role="timer"
        aria-label="Time until flash sale begins"
        aria-live="off"
      >
        {formatTime(remainingSeconds)}
      </div>

      <p className="countdown-description">
        Precision countdown powered by Date.now()
        and requestAnimationFrame().
      </p>

      <div
        className="countdown-controls"
        role="group"
        aria-label="Countdown controls"
      >
        <button
          type="button"
          className="start-button"
          onClick={handleStart}
          disabled={phase !== "ready"}
        >
          Start Countdown
        </button>

        <button
          type="button"
          className="reset-button"
          onClick={handleReset}
        >
          Reset
        </button>
      </div>

      <p
        className="countdown-message"
        role="status"
        aria-atomic="true"
      >
        {statusMessage}
      </p>

      {isLive && (
        <div className="live-message">
          <strong>FLASH SALE IS LIVE!</strong>

          <p>
            Inventory reservations are now open.
            Products are available while stock lasts.
          </p>
        </div>
      )}
    </div>
  );
}
