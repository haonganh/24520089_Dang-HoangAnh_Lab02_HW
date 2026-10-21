
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { AudioPlaybackEngine } from "./audio-playback-engine";

// Mock audio buffer
const fakeBuffer = {
  duration: 60,
} as AudioBuffer;

// Mock source node
function createFakeSource() {
  return {
    buffer: null as AudioBuffer | null,
    onended: null as (() => void) | null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
}

type FakeSource = ReturnType<typeof createFakeSource>;

let sources: FakeSource[] = [];
let contexts: FakeAudioContext[] = [];

// Mock Web Audio API
class FakeAudioContext {
  currentTime = 0;

  state: AudioContextState = "suspended";

  destination = {} as AudioDestinationNode;

  gainNode = {
    gain: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  analyserNode = {
    fftSize: 2048,
    smoothingTimeConstant: 0,
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  constructor() {
    contexts.push(this);
  }

  createGain = vi.fn(
    () => this.gainNode as unknown as GainNode
  );

  createAnalyser = vi.fn(
    () => this.analyserNode as unknown as AnalyserNode
  );

  createBufferSource = vi.fn(() => {
    const source = createFakeSource();

    sources.push(source);

    return source as unknown as AudioBufferSourceNode;
  });

  resume = vi.fn(async () => {
    this.state = "running";
  });

  close = vi.fn(async () => {
    this.state = "closed";
  });
}

beforeEach(() => {
  sources = [];
  contexts = [];

  vi.stubGlobal("AudioContext", FakeAudioContext);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AudioPlaybackEngine", () => {
  // TEST 01: Playback
  it("initializes the audio graph and plays audio", async () => {
    const engine = new AudioPlaybackEngine();

    engine.loadBuffer(fakeBuffer);

    expect(engine.getState()).toBe("ready");

    await engine.play();

    expect(engine.getState()).toBe("playing");
    expect(contexts).toHaveLength(1);
    expect(sources).toHaveLength(1);

    expect(sources[0].start).toHaveBeenCalledWith(
      0,
      0
    );

    expect(engine.getAnalyser()).not.toBeNull();

    await engine.dispose();
  });

  // TEST 02: Pause and resume
  it("preserves playback position after pause", async () => {
    const engine = new AudioPlaybackEngine();

    engine.loadBuffer(fakeBuffer);

    await engine.play();

    const context = contexts[0];

    context.currentTime = 12;

    engine.pause();

    expect(engine.getState()).toBe("paused");

    expect(sources[0].stop).toHaveBeenCalled();

    await engine.play();

    expect(engine.getState()).toBe("playing");

    expect(sources[1].start).toHaveBeenCalledWith(
      0,
      12
    );

    engine.stop();

    expect(engine.getState()).toBe("stopped");

    await engine.play();

    expect(sources[2].start).toHaveBeenCalledWith(
      0,
      0
    );

    await engine.dispose();
  });

  // TEST 03: Volume control
  it("updates and clamps volume correctly", async () => {
    const engine = new AudioPlaybackEngine();

    engine.setVolume(0.5);

    expect(engine.getVolume()).toBe(0.5);

    engine.loadBuffer(fakeBuffer);

    await engine.play();

    const context = contexts[0];

    expect(context.gainNode.gain.value).toBe(0.5);

    engine.setVolume(0);

    expect(context.gainNode.gain.value).toBe(0);

    engine.setVolume(2);

    expect(engine.getVolume()).toBe(1);

    engine.setVolume(-1);

    expect(engine.getVolume()).toBe(0);

    engine.setVolume(Number.NaN);

    expect(engine.getVolume()).toBe(0);

    await engine.dispose();
  });

  // TEST 04: Natural playback completion
  it("updates state when audio finishes", async () => {
    const engine = new AudioPlaybackEngine();

    engine.loadBuffer(fakeBuffer);

    await engine.play();

    const source = sources[0];

    source.onended?.();

    expect(engine.getState()).toBe("stopped");

    expect(source.disconnect).toHaveBeenCalled();

    await engine.dispose();
  });

  // TEST 05: Memory cleanup
  it("releases audio resources on disposal", async () => {
    const engine = new AudioPlaybackEngine();

    engine.loadBuffer(fakeBuffer);

    await engine.play();

    const context = contexts[0];
    const source = sources[0];

    await engine.dispose();

    expect(engine.getState()).toBe("disposed");

    expect(source.stop).toHaveBeenCalled();

    expect(source.disconnect).toHaveBeenCalled();

    expect(
      context.gainNode.disconnect
    ).toHaveBeenCalled();

    expect(
      context.analyserNode.disconnect
    ).toHaveBeenCalled();

    expect(context.close).toHaveBeenCalledTimes(1);

    // Repeated disposal must not close twice
    await engine.dispose();

    expect(context.close).toHaveBeenCalledTimes(1);

    await expect(engine.play()).rejects.toThrow(
      "disposed"
    );
  });
});

