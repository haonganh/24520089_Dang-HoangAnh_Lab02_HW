
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { AudioTaskQueue } from "./audio-queue-controller";

const fakeAudioBuffer = {} as AudioBuffer;

const decodeMock = vi.fn(
  async (_data: ArrayBuffer): Promise<AudioBuffer> =>
    fakeAudioBuffer
);

const closeMock = vi.fn(
  async (): Promise<void> => undefined
);

// Mock a successful HTTP response
function successfulResponse(): Response {
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => new ArrayBuffer(8),
  } as Response;
}

beforeEach(() => {
  decodeMock.mockReset();
  decodeMock.mockResolvedValue(fakeAudioBuffer);

  closeMock.mockReset();
  closeMock.mockResolvedValue(undefined);

  // Mock Web Audio API
  vi.stubGlobal(
    "AudioContext",
    class {
      state: AudioContextState = "running";

      decodeAudioData = decodeMock;

      async close(): Promise<void> {
        this.state = "closed";
        await closeMock();
      }
    }
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AudioTaskQueue", () => {
  it("processes multiple tasks in FIFO order", async () => {
    let releaseFirst!: (response: Response) => void;

    const firstResponse = new Promise<Response>(
      (resolve) => {
        releaseFirst = resolve;
      }
    );

    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => firstResponse)
      .mockImplementation(async () => successfulResponse());

    vi.stubGlobal("fetch", fetchMock);

    const queue = new AudioTaskQueue();

    const first = queue.enqueue("/first.mp3");
    const second = queue.enqueue("/second.mp3");
    const third = queue.enqueue("/third.mp3");

    // Only the first download may start initially
    expect(fetchMock).toHaveBeenCalledTimes(1);

    releaseFirst(successfulResponse());

    await Promise.all([first, second, third]);

    const order = fetchMock.mock.calls.map(
      (args) => args[0]
    );

    expect(order).toEqual([
      "/first.mp3",
      "/second.mp3",
      "/third.mp3",
    ]);

    expect(decodeMock).toHaveBeenCalledTimes(3);

    await queue.dispose();
  });

  it("continues processing after an HTTP error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response)
      .mockResolvedValue(successfulResponse());

    vi.stubGlobal("fetch", fetchMock);

    const queue = new AudioTaskQueue();

    const first = expect(
      queue.enqueue("/missing.mp3")
    ).rejects.toThrow("HTTP 404");

    const second = queue.enqueue("/valid.mp3");

    await first;

    await expect(second).resolves.toBe(fakeAudioBuffer);

    expect(fetchMock).toHaveBeenCalledTimes(2);

    await queue.dispose();
  });

  it("cancels an individual waiting task", async () => {
    const fetchMock = vi.fn(
      (_url: string, options: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          options.signal?.addEventListener(
            "abort",
            () => {
              reject(
                new DOMException(
                  "Aborted",
                  "AbortError"
                )
              );
            },
            { once: true }
          );
        })
    );

    vi.stubGlobal("fetch", fetchMock);

    const queue = new AudioTaskQueue();

    const active = queue.enqueueTask("/active.mp3");
    const waiting = queue.enqueueTask("/waiting.mp3");

    const waitingResult = expect(
      waiting.promise
    ).rejects.toMatchObject({
      name: "AbortError",
    });

    expect(queue.getStatus().pending).toBe(1);

    expect(waiting.cancel()).toBe(true);

    await waitingResult;

    expect(queue.getStatus().pending).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const activeResult = expect(
      active.promise
    ).rejects.toMatchObject({
      name: "AbortError",
    });

    queue.cancelAll();

    await activeResult;
    await queue.dispose();
  });

  it("ignores decoded audio after cancellation", async () => {
    let finishDecode!: (buffer: AudioBuffer) => void;

    decodeMock.mockImplementationOnce(
      () =>
        new Promise<AudioBuffer>((resolve) => {
          finishDecode = resolve;
        })
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => successfulResponse())
    );

    const queue = new AudioTaskQueue();

    const task = queue.enqueueTask("/slow.mp3");

    // Wait until decoding has started
    await vi.waitFor(() => {
      expect(decodeMock).toHaveBeenCalledTimes(1);
    });

    const result = expect(
      task.promise
    ).rejects.toMatchObject({
      name: "AbortError",
    });

    expect(task.cancel()).toBe(true);

    await result;

    // Disposal waits for the decoder
    const disposal = queue.dispose();

    expect(closeMock).not.toHaveBeenCalled();

    // Simulate decoding completing late
    finishDecode(fakeAudioBuffer);

    await disposal;

    expect(closeMock).toHaveBeenCalledTimes(1);

    await expect(
      queue.enqueue("/another.mp3")
    ).rejects.toThrow("disposed");
  });
});
