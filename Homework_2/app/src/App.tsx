
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
  const playerRef = useRef<AudioPlaybackEngine | null>(null);

  const requestIdRef = useRef(0);
  const previousVolumeRef = useRef(70);

  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [playbackState, setPlaybackState] =
    useState<PlaybackState>("idle");

  const [volume, setVolume] = useState(70);
  const [pendingTasks, setPendingTasks] = useState(0);

  const [message, setMessage] = useState(
    "Select an audio file to begin."
  );

  const [hasError, setHasError] = useState(false);

  // Initialize the audio queue and player
  useEffect(() => {
    const queue = new AudioTaskQueue();

    const player = new AudioPlaybackEngine(
      setPlaybackState
    );

    player.setVolume(0.7);

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

  // Select an audio file
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
    setPendingTasks(0);
    setHasError(false);

    setMessage(
      selectedFile
        ? `Selected: ${selectedFile.name}`
        : "Select an audio file to begin."
    );
  };

  // Download and decode with FIFO Queue
  const handleLoad = async () => {
    const queue = queueRef.current;
    const player = playerRef.current;

    if (!file || !queue || !player) return;

    const requestId = ++requestIdRef.current;

    queue.cancelAll();
    player.reset();

    const objectUrl = URL.createObjectURL(file);

    setIsLoading(true);
    setHasError(false);
    setMessage("Loading and decoding audio...");

    try {
      const task = queue.enqueue(objectUrl);

      setPendingTasks(queue.getStatus().pending);

      const buffer = await task;

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

      setHasError(!isAbort);

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
        setPendingTasks(0);
      }
    }
  };

  // Start or resume playback
  const handlePlay = async () => {
    try {
      await playerRef.current?.play();
      setHasError(false);
    } catch (error) {
      setHasError(true);

      setMessage(
        error instanceof Error
          ? `Playback error: ${error.message}`
          : "Unable to play audio."
      );
    }
  };

  const handlePause = () => {
    playerRef.current?.pause();
  };

  const handleStop = () => {
    playerRef.current?.stop();
  };

  // Cancel the current download
  const handleCancel = () => {
    ++requestIdRef.current;

    queueRef.current?.cancelAll();

    setIsLoading(false);
    setPendingTasks(0);
    setHasError(false);
    setMessage("Audio loading cancelled.");
  };

  // Accessible volume control
  const updateVolume = (newVolume: number) => {
    const safeVolume = Math.max(
      0,
      Math.min(100, newVolume)
    );

    setVolume(safeVolume);

    if (safeVolume > 0) {
      previousVolumeRef.current = safeVolume;
    }

    playerRef.current?.setVolume(safeVolume / 100);
  };

  // Mute and unmute
  const handleMute = () => {
    if (volume > 0) {
      previousVolumeRef.current = volume;
      updateVolume(0);
    } else {
      updateVolume(previousVolumeRef.current || 70);
    }
  };

  const canPlay =
    !isLoading &&
    ["ready", "paused", "stopped"].includes(playbackState);

  const isPlaying = playbackState === "playing";

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
          Accessible Audio Player
        </h2>

        {/* File selector */}
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
        <div
          className="controls"
          role="group"
          aria-label="Audio playback controls"
        >
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

        {/* Volume controls */}
        <div
          className="volume-panel"
          role="group"
          aria-label="Volume controls"
        >
          <label htmlFor="volume-slider">
            Volume
          </label>

          <input
            id="volume-slider"
            type="range"
            min="0"
            max="100"
            step="1"
            value={volume}
            onChange={(event) =>
              updateVolume(
                Number(event.target.value)
              )
            }
          />

          <output htmlFor="volume-slider">
            {volume}%
          </output>

          <button
            type="button"
            className="mute-button"
            onClick={handleMute}
            aria-pressed={volume === 0}
          >
            {volume === 0 ? "Unmute" : "Mute"}
          </button>
        </div>

        {/* Accessible loading and error status */}
        <div className="player-feedback">
          <p
            className={`status ${
              hasError ? "status-error" : ""
            }`}
            role={hasError ? "alert" : "status"}
            aria-atomic="true"
          >
            {message}
          </p>

          <p className="playback-state">
            Playback state:{" "}
            <strong>{playbackState}</strong>
          </p>

          <p className="queue-status">
            FIFO Queue:{" "}
            <strong>
              {isLoading ? "Processing" : "Idle"}
            </strong>
            {" | "}
            Pending tasks: {pendingTasks}
          </p>
        </div>

        {/* Real-time visualizer */}
        <AudioVisualizer
          analyser={analyser}
          isPlaying={isPlaying}
        />
      </section>
    </main>
  );
}

export default App;
