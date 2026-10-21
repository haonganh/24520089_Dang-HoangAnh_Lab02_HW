
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";

import { AudioTaskQueue } from "./audio/audio-queue-controller";

import {
  AudioPlaybackEngine,
  type PlaybackState,
} from "./audio/audio-playback-engine";

import AudioVisualizer from "./components/AudioVisualizer";

import "./App.css";

function App() {
  const queueRef = useRef<AudioTaskQueue | null>(null);

  const playerRef = useRef<AudioPlaybackEngine | null>(
    null
  );

  const requestIdRef = useRef(0);

  const [file, setFile] = useState<File | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  const [playbackState, setPlaybackState] =
    useState<PlaybackState>("idle");

  const [message, setMessage] = useState(
    "Select an audio file to begin."
  );

  // Initialize audio resources
  useEffect(() => {
    const queue = new AudioTaskQueue();

    const player = new AudioPlaybackEngine(
      setPlaybackState
    );

    queueRef.current = queue;
    playerRef.current = player;

    return () => {
      ++requestIdRef.current;

      player.setOnStateChange(null);

      void queue.dispose().catch(console.error);
      void player.dispose().catch(console.error);

      if (queueRef.current === queue) {
        queueRef.current = null;
      }

      if (playerRef.current === player) {
        playerRef.current = null;
      }
    };
  }, []);

  // Handle file selection
  const handleFileChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFile =
      event.target.files?.[0] ?? null;

    ++requestIdRef.current;

    queueRef.current?.cancelAll();
    playerRef.current?.reset();

    setFile(selectedFile);
    setIsLoading(false);

    setMessage(
      selectedFile
        ? `Selected: ${selectedFile.name}`
        : "Select an audio file to begin."
    );
  };

  // Load audio using FIFO queue
  const handleLoad = async () => {
    const queue = queueRef.current;
    const player = playerRef.current;

    if (!file || !queue || !player) return;

    const requestId = ++requestIdRef.current;

    queue.cancelAll();
    player.reset();

    const objectUrl = URL.createObjectURL(file);

    setIsLoading(true);
    setMessage("Loading and decoding audio...");

    try {
      const buffer = await queue.enqueue(objectUrl);

      if (requestId !== requestIdRef.current) {
        return;
      }

      player.loadBuffer(buffer);

      setMessage(
        `Audio loaded successfully: ${file.name}`
      );
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      const isAbort =
        error instanceof Error &&
        error.name === "AbortError";

      setMessage(
        isAbort
          ? "Audio loading cancelled."
          : `Error: ${
              error instanceof Error
                ? error.message
                : "Unknown audio error"
            }`
      );
    } finally {
      URL.revokeObjectURL(objectUrl);

      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  };

  // Play or resume audio
  const handlePlay = async () => {
    try {
      await playerRef.current?.play();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to play audio."
      );
    }
  };

  // Pause playback
  const handlePause = () => {
    playerRef.current?.pause();
  };

  // Stop playback
  const handleStop = () => {
    playerRef.current?.stop();
  };

  // Cancel audio loading
  const handleCancel = () => {
    ++requestIdRef.current;

    queueRef.current?.cancelAll();

    setIsLoading(false);
    setMessage("Audio loading cancelled.");
  };

  const canPlay =
    !isLoading &&
    ["ready", "paused", "stopped"].includes(playbackState);

  const isPlaying = playbackState === "playing";

  // Analyser is initialized when playback begins
  const analyser =
    playerRef.current?.getAnalyser() ?? null;

  return (
    <main className="app-container">
      <header className="app-header">
        <h1>Concurrent FIFO Audio Visualizer</h1>

        <p>
          Web Audio API, FIFO Queue Engine,
          and Real-Time Audio Visualization.
        </p>
      </header>

      <section
        className="audio-panel"
        aria-labelledby="audio-heading"
      >
        <h2 id="audio-heading">
          Audio Playback Engine
        </h2>

        {/* File input */}
        <div className="file-group">
          <label htmlFor="audio-file">
            Choose an audio file (MP3/WAV)
          </label>

          <input
            id="audio-file"
            type="file"
            accept="audio/*,.mp3,.wav"
            onChange={handleFileChange}
          />
        </div>

        {/* Playback controls */}
        <div className="controls">
          <button
            type="button"
            onClick={() => void handleLoad()}
            disabled={!file || isLoading}
          >
            Load Audio
          </button>

          <button
            type="button"
            onClick={() => void handlePlay()}
            disabled={!canPlay}
          >
            {playbackState === "paused"
              ? "Resume"
              : "Play"}
          </button>

          <button
            type="button"
            onClick={handlePause}
            disabled={!isPlaying}
          >
            Pause
          </button>

          <button
            type="button"
            onClick={handleStop}
            disabled={
              playbackState !== "playing" &&
              playbackState !== "paused"
            }
          >
            Stop
          </button>

          <button
            type="button"
            onClick={handleCancel}
            disabled={!isLoading}
          >
            Cancel Loading
          </button>
        </div>

        {/* Accessible status */}
        <p className="status" role="status">
          {message}
        </p>

        <p className="playback-state">
          Playback state:{" "}
          <strong>{playbackState}</strong>
        </p>

        {/* Real-time Audio Visualizer */}
        <AudioVisualizer
          analyser={analyser}
          isPlaying={isPlaying}
        />
      </section>
    </main>
  );
}

export default App;
