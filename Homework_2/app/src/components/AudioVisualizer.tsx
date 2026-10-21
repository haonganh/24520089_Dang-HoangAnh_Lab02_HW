
import { useEffect, useId, useRef } from "react";
import "./AudioVisualizer.css";

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
}

export default function AudioVisualizer({
  analyser,
  isPlaying,
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const headingId = useId();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", {
      alpha: false,
    });

    if (!ctx) return;

    const motionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    const frequencyData = new Uint8Array(
      analyser?.frequencyBinCount ?? 256
    );

    const MAX_BARS = 48;
    const GAP = 3;

    let animationId: number | null = null;
    let canvasWidth = 1;
    let canvasHeight = 1;
    let gradient: CanvasGradient | null = null;

    // Draw the frequency spectrum
    const drawFrame = () => {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      const shouldSample =
        analyser !== null &&
        isPlaying &&
        !motionQuery.matches &&
        !document.hidden;

      if (shouldSample && analyser) {
        analyser.getByteFrequencyData(frequencyData);
      } else {
        frequencyData.fill(0);
      }

      const barCount = Math.min(
        MAX_BARS,
        frequencyData.length,
        Math.max(8, Math.floor(canvasWidth / 8))
      );

      const barWidth = Math.max(
        1,
        (canvasWidth - GAP * (barCount + 1)) / barCount
      );

      const binsPerBar = Math.max(
        1,
        Math.floor(frequencyData.length / barCount)
      );

      // Reuse the gradient instead of creating
      // a new gradient for every bar.
      ctx.fillStyle = gradient ?? "#22d3ee";

      for (let i = 0; i < barCount; i++) {
        let amplitude = 0;

        const start = i * binsPerBar;

        const end =
          i === barCount - 1
            ? frequencyData.length
            : Math.min(
                start + binsPerBar,
                frequencyData.length
              );

        for (let j = start; j < end; j++) {
          amplitude = Math.max(
            amplitude,
            frequencyData[j]
          );
        }

        const normalized = amplitude / 255;

        const barHeight = Math.max(
          3,
          normalized * Math.max(1, canvasHeight - 20)
        );

        const x = GAP + i * (barWidth + GAP);
        const y = canvasHeight - barHeight - 10;

        ctx.fillRect(x, y, barWidth, barHeight);
      }
    };

    // Check whether animation is allowed
    const canAnimate = () =>
      Boolean(analyser) &&
      isPlaying &&
      !motionQuery.matches &&
      !document.hidden;

    // Animation loop
    const animate = () => {
      animationId = null;

      if (!canAnimate()) return;

      drawFrame();

      animationId = window.requestAnimationFrame(
        animate
      );
    };

    // Cancel scheduled animation frame
    const stopAnimation = () => {
      if (animationId !== null) {
        window.cancelAnimationFrame(animationId);
        animationId = null;
      }
    };

    // Start or stop animation safely
    const updateAnimation = () => {
      stopAnimation();
      drawFrame();

      if (canAnimate()) {
        animationId = window.requestAnimationFrame(
          animate
        );
      }
    };

    // Resize canvas and account for device pixel ratio
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();

      const dpr = Math.min(
        window.devicePixelRatio || 1,
        2
      );

      canvasWidth = Math.max(1, rect.width);
      canvasHeight = Math.max(1, rect.height);

      const physicalWidth = Math.max(
        1,
        Math.round(canvasWidth * dpr)
      );

      const physicalHeight = Math.max(
        1,
        Math.round(canvasHeight * dpr)
      );

      if (canvas.width !== physicalWidth) {
        canvas.width = physicalWidth;
      }

      if (canvas.height !== physicalHeight) {
        canvas.height = physicalHeight;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Create the gradient only when resizing
      gradient = ctx.createLinearGradient(
        0,
        canvasHeight,
        0,
        0
      );

      gradient.addColorStop(0, "#22d3ee");
      gradient.addColorStop(1, "#a5f3fc");

      drawFrame();
    };

    // Observe responsive resizing
    const resizeObserver = new ResizeObserver(
      resizeCanvas
    );

    resizeObserver.observe(canvas);

    // React to reduced-motion setting changes
    motionQuery.addEventListener(
      "change",
      updateAnimation
    );

    // Stop visual work when the page is hidden
    document.addEventListener(
      "visibilitychange",
      updateAnimation
    );

    resizeCanvas();
    updateAnimation();

    // Complete cleanup
    return () => {
      stopAnimation();

      resizeObserver.disconnect();

      motionQuery.removeEventListener(
        "change",
        updateAnimation
      );

      document.removeEventListener(
        "visibilitychange",
        updateAnimation
      );
    };
  }, [analyser, isPlaying]);

  return (
    <section
      className="visualizer-panel"
      aria-labelledby={headingId}
    >
      <h3 id={headingId}>
        Real-Time Audio Frequency Visualizer
      </h3>

      <p className="visualizer-description">
        Frequency spectrum powered by the
        Web Audio API and Canvas.
      </p>

      <canvas
        ref={canvasRef}
        className="audio-canvas"
        width={900}
        height={240}
        aria-hidden="true"
      />

      <p
        className="visualizer-status"
        role="status"
      >
        {isPlaying
          ? "Audio is playing. Visualization respects reduced-motion settings."
          : "Visualization paused or waiting for audio."}
      </p>
    </section>
  );
}
