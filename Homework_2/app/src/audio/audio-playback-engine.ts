
export type PlaybackState =
  | "idle"
  | "ready"
  | "playing"
  | "paused"
  | "stopped"
  | "disposed";

export class AudioPlaybackEngine {
  private context: AudioContext | null = null;

  private analyser: AnalyserNode | null = null;

  private gain: GainNode | null = null;

  private source: AudioBufferSourceNode | null = null;

  private buffer: AudioBuffer | null = null;

  private startedAt = 0;

  private pausedAt = 0;

  private state: PlaybackState = "idle";

  private operationId = 0;

  private disposed = false;

  private onStateChange:
    | ((state: PlaybackState) => void)
    | null;

  constructor(
    onStateChange?: (state: PlaybackState) => void
  ) {
    this.onStateChange = onStateChange ?? null;
  }

  // Notify the UI when playback state changes
  private updateState(state: PlaybackState): void {
    this.state = state;
    this.onStateChange?.(state);
  }

  setOnStateChange(
    callback: ((state: PlaybackState) => void) | null
  ): void {
    this.onStateChange = callback;
  }

  getState(): PlaybackState {
    return this.state;
  }

  // Create the audio graph once
  private initializeAudio(): AudioContext {
    if (this.context) {
      return this.context;
    }

    const context = new AudioContext();

    const gain = context.createGain();
    const analyser = context.createAnalyser();

    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.8;

    // Source -> Gain -> Analyser -> Speakers
    gain.connect(analyser);
    analyser.connect(context.destination);

    this.context = context;
    this.gain = gain;
    this.analyser = analyser;

    return context;
  }

  // Access the analyser for T06 visualization
  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  // Load a decoded audio buffer
  loadBuffer(buffer: AudioBuffer): void {
    if (this.disposed) {
      throw new Error("Audio engine is disposed.");
    }

    if (buffer.duration <= 0) {
      throw new Error("Invalid audio buffer.");
    }

    this.reset();

    this.buffer = buffer;
    this.updateState("ready");
  }

  // Disconnect the current source safely
  private stopSource(): void {
    const source = this.source;

    if (!source) return;

    this.source = null;
    source.onended = null;

    try {
      source.stop();
    } catch {
      // The source may already have ended.
    }

    source.disconnect();
  }

  // Play or resume audio
  async play(): Promise<void> {
    if (this.disposed) {
      throw new Error("Audio engine is disposed.");
    }

    const buffer = this.buffer;

    if (!buffer) {
      throw new Error("No audio file loaded.");
    }

    if (this.state === "playing") return;

    const operation = ++this.operationId;

    const context = this.initializeAudio();

    // Resume must be triggered by user interaction
    await context.resume();

    // Ignore outdated play requests
    if (
      this.disposed ||
      operation !== this.operationId ||
      !this.buffer
    ) {
      return;
    }

    const source = context.createBufferSource();

    source.buffer = buffer;
    source.connect(this.gain!);

    this.source = source;

    // Restart if playback reached the end
    if (this.pausedAt >= buffer.duration) {
      this.pausedAt = 0;
    }

    this.startedAt = context.currentTime;

    source.onended = () => {
      if (this.source !== source) return;

      this.source = null;
      source.disconnect();

      this.pausedAt = 0;
      this.updateState("stopped");
    };

    try {
      source.start(0, this.pausedAt);
      this.updateState("playing");
    } catch (error) {
      source.onended = null;
      source.disconnect();
      this.source = null;
      throw error;
    }
  }

  // Pause playback and remember position
  pause(): void {
    if (
      this.state !== "playing" ||
      !this.context ||
      !this.buffer
    ) {
      return;
    }

    const elapsed =
      this.context.currentTime - this.startedAt;

    this.pausedAt = Math.min(
      this.buffer.duration,
      this.pausedAt + Math.max(0, elapsed)
    );

    ++this.operationId;

    this.stopSource();
    this.updateState("paused");
  }

  // Stop playback and reset position
  stop(): void {
    if (this.disposed) return;

    ++this.operationId;

    this.stopSource();
    this.pausedAt = 0;

    this.updateState(
      this.buffer ? "stopped" : "idle"
    );
  }

  // Clear currently loaded audio
  reset(): void {
    if (this.disposed) return;

    ++this.operationId;

    this.stopSource();

    this.buffer = null;
    this.pausedAt = 0;

    this.updateState("idle");
  }

  // Adjust volume from 0 to 1
  setVolume(value: number): void {
    if (!Number.isFinite(value)) return;

    const volume = Math.max(0, Math.min(1, value));

    if (this.gain) {
      this.gain.gain.value = volume;
    }
  }

  // Release all Web Audio resources
  async dispose(): Promise<void> {
    if (this.disposed) return;

    this.disposed = true;
    ++this.operationId;

    this.stopSource();

    this.buffer = null;
    this.pausedAt = 0;

    this.analyser?.disconnect();
    this.gain?.disconnect();

    const context = this.context;

    this.context = null;
    this.analyser = null;
    this.gain = null;

    this.updateState("disposed");

    if (context && context.state !== "closed") {
      await context.close();
    }
  }
}
