
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

    let animationId = 0;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    const frequencyData = new Uint8Array(
      analyser?.frequencyBinCount ?? 256
    );

    const BAR_COUNT = 48;
    const GAP = 3;

    // Resize canvas for high-density displays
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();

      const dpr = Math.min(
        window.devicePixelRatio || 1,
        2
      );

      canvas.width = Math.max(
        1,
        Math.round(rect.width * dpr)
      );

      canvas.height = Math.max(
        1,
        Math.round(rect.height * dpr)
      );

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      drawFrame();
    };

    // Draw audio frequency bars
    const drawFrame = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      // Background
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, width, height);

      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(
          frequencyData
        );
      } else {
        frequencyData.fill(0);
      }

      const count = Math.min(
        BAR_COUNT,
        frequencyData.length
      );

      const step = Math.max(
        1,
        Math.floor(frequencyData.length / count)
      );

      const barWidth = Math.max(
        1,
        (width - GAP * (count + 1)) / count
      );

      for (let i = 0; i < count; i++) {
        let value = 0;

        // Find maximum frequency amplitude
        for (
          let j = i * step;
          j < Math.min(
            (i + 1) * step,
            frequencyData.length
          );
          j++
        ) {
          value = Math.max(
            value,
            frequencyData[j]
          );
        }

        const normalized = value / 255;

        const barHeight = Math.max(
          3,
          normalized * (height - 20)
        );

        const x = GAP + i * (barWidth + GAP);
        const y = height - barHeight - 10;

        // Color gradient
        const gradient =
          ctx.createLinearGradient(
            0,
            height,
            0,
            0
          );

        gradient.addColorStop(0, "#22d3ee");
        gradient.addColorStop(1, "#a5f3fc");

        ctx.fillStyle = gradient;

        ctx.fillRect(
          x,
          y,
          barWidth,
          barHeight
        );
      }
    };

    // Animation loop using requestAnimationFrame
    const animate = () => {
      drawFrame();

      animationId =
        window.requestAnimationFrame(animate);
    };

    const observer = new ResizeObserver(
      resizeCanvas
    );

    observer.observe(canvas);
    resizeCanvas();

    // Animate only during active playback.
    // Respect reduced-motion preference.
    if (
      analyser &&
      isPlaying &&
      !reducedMotion.matches
    ) {
      animationId =
        window.requestAnimationFrame(animate);
    }

    // Clean up to prevent memory leaks
    return () => {
      window.cancelAnimationFrame(animationId);
      observer.disconnect();
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
        Frequency spectrum visualization using
        Web Audio API and Canvas.
      </p>

      <canvas
        ref={canvasRef}
        className="audio-canvas"
        width={900}
        height={240}
        aria-hidden="true"
      />

      <p className="visualizer-status" role="status">
        {isPlaying
          ? "Audio is playing. Frequency visualization is active."
          : "Visualization paused or waiting for audio."}
      </p>
    </section>
  );
}
