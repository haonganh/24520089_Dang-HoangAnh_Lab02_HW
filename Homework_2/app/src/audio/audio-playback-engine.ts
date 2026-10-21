
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
  private volume = 1;
  private operationId = 0;
  private disposed = false;

  private state: PlaybackState = "idle";

  private onStateChange:
    | ((state: PlaybackState) => void)
    | null;

  constructor(
    onStateChange?: (state: PlaybackState) => void
  ) {
    this.onStateChange = onStateChange ?? null;
  }

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

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  private initializeAudio(): AudioContext {
    if (this.context) return this.context;

    const context = new AudioContext();
    const gain = context.createGain();
    const analyser = context.createAnalyser();

    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.8;

    // Source -> Gain -> Analyser -> Destination
    gain.gain.value = this.volume;

    gain.connect(analyser);
    analyser.connect(context.destination);

    this.context = context;
    this.gain = gain;
    this.analyser = analyser;

    return context;
  }

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

  private stopSource(): void {
    const source = this.source;

    if (!source) return;

    this.source = null;
    source.onended = null;

    try {
      source.stop();
    } catch {
      // Source may already have stopped.
    }

    source.disconnect();
  }

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

    await context.resume();

    if (
      this.disposed ||
      operation !== this.operationId ||
      this.buffer !== buffer
    ) {
      return;
    }

    this.stopSource();

    if (this.pausedAt >= buffer.duration) {
      this.pausedAt = 0;
    }

    const source = context.createBufferSource();

    source.buffer = buffer;
    source.connect(this.gain!);

    this.source = source;
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

  stop(): void {
    if (this.disposed) return;

    ++this.operationId;
    this.stopSource();

    this.pausedAt = 0;

    this.updateState(
      this.buffer ? "stopped" : "idle"
    );
  }

  reset(): void {
    if (this.disposed) return;

    ++this.operationId;

    this.stopSource();
    this.buffer = null;
    this.pausedAt = 0;

    this.updateState("idle");
  }

  // Persist volume even before AudioContext exists
  setVolume(value: number): void {
    if (this.disposed || !Number.isFinite(value)) {
      return;
    }

    this.volume = Math.max(0, Math.min(1, value));

    if (this.gain) {
      this.gain.gain.value = this.volume;
    }
  }

  getVolume(): number {
    return this.volume;
  }

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
