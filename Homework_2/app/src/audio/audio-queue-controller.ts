
import type {
  AudioTask,
  AudioQueueStatus,
} from "./audio-task";

// Internal task with a stable identifier
interface QueuedAudioTask extends AudioTask {
  id: number;
  settled: boolean;
}

// Handle for cancelling an individual task
export interface AudioTaskHandle {
  id: number;
  promise: Promise<AudioBuffer>;
  cancel: () => boolean;
}

export class AudioTaskQueue {
  private queue: QueuedAudioTask[] = [];

  private isProcessing = false;

  private activeController: AbortController | null = null;

  private activeTask: QueuedAudioTask | null = null;

  private audioContext: AudioContext | null = null;

  private processingPromise: Promise<void> | null = null;

  private disposalPromise: Promise<void> | null = null;

  private disposed = false;

  private nextTaskId = 1;

  // Create a standard cancellation error
  private createAbortError(): DOMException {
    return new DOMException(
      "Audio task cancelled.",
      "AbortError"
    );
  }

  // Resolve a task exactly once
  private resolveTask(
    task: QueuedAudioTask,
    buffer: AudioBuffer
  ): void {
    if (
      task.settled ||
      task.controller.signal.aborted ||
      this.disposed
    ) {
      return;
    }

    task.settled = true;
    task.resolve(buffer);
  }

  // Reject a task exactly once
  private rejectTask(
    task: QueuedAudioTask,
    error: unknown
  ): void {
    if (task.settled) return;

    task.settled = true;
    task.reject(error);
  }

  // Required enqueue API
  async enqueue(trackUrl: string): Promise<AudioBuffer> {
    return this.enqueueTask(trackUrl).promise;
  }

  // Enqueue with an individual cancellation handle
  enqueueTask(trackUrl: string): AudioTaskHandle {
    if (this.disposed) {
      throw new Error("Audio queue has been disposed.");
    }

    if (!trackUrl.trim()) {
      throw new Error("Audio URL cannot be empty.");
    }

    const controller = new AbortController();

    let resolve!: (buffer: AudioBuffer) => void;
    let reject!: (error: unknown) => void;

    const promise = new Promise<AudioBuffer>(
      (res, rej) => {
        resolve = res;
        reject = rej;
      }
    );

    const task: QueuedAudioTask = {
      id: this.nextTaskId++,
      trackUrl,
      controller,
      resolve,
      reject,
      settled: false,
    };

    // FIFO insertion
    this.queue.push(task);

    this.startProcessing();

    return {
      id: task.id,
      promise,
      cancel: () => this.cancelTask(task.id),
    };
  }

  // Start only one worker
  private startProcessing(): void {
    if (this.processingPromise || this.disposed) {
      return;
    }

    this.processingPromise = this.processNext().finally(
      () => {
        this.processingPromise = null;

        if (this.queue.length > 0 && !this.disposed) {
          this.startProcessing();
        }
      }
    );
  }

  // Process tasks sequentially
  private async processNext(): Promise<void> {
    this.isProcessing = true;

    try {
      while (this.queue.length > 0 && !this.disposed) {
        // FIFO removal
        const task = this.queue.shift();

        if (!task || task.settled) continue;

        this.activeTask = task;
        this.activeController = task.controller;

        try {
          // Download audio
          const response = await fetch(task.trackUrl, {
            signal: task.controller.signal,
          });

          if (!response.ok) {
            throw new Error(
              `Audio download failed: HTTP ${response.status}`
            );
          }

          const arrayBuffer = await response.arrayBuffer();

          if (
            task.controller.signal.aborted ||
            this.disposed
          ) {
            throw this.createAbortError();
          }

          // Reuse one AudioContext for decoding
          if (!this.audioContext) {
            this.audioContext = new AudioContext();
          }

          // Decoding itself cannot be aborted
          const audioBuffer =
            await this.audioContext.decodeAudioData(
              arrayBuffer
            );

          // Ignore a late result after cancellation
          if (
            task.controller.signal.aborted ||
            this.disposed
          ) {
            throw this.createAbortError();
          }

          this.resolveTask(task, audioBuffer);
        } catch (error) {
          this.rejectTask(task, error);
        } finally {
          this.activeTask = null;
          this.activeController = null;
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  // Cancel a waiting or active task
  cancelTask(taskId: number): boolean {
    // Check waiting tasks
    const index = this.queue.findIndex(
      (task) => task.id === taskId
    );

    if (index !== -1) {
      const [task] = this.queue.splice(index, 1);

      task.controller.abort();
      this.rejectTask(task, this.createAbortError());

      return true;
    }

    // Check active task
    if (
      this.activeTask?.id === taskId &&
      !this.activeTask.settled
    ) {
      this.activeController?.abort();

      this.rejectTask(
        this.activeTask,
        this.createAbortError()
      );

      return true;
    }

    return false;
  }

  // Cancel all active and waiting tasks
  cancelAll(): void {
    if (this.activeTask) {
      this.cancelTask(this.activeTask.id);
    }

    const pendingIds = this.queue.map(
      (task) => task.id
    );

    for (const id of pendingIds) {
      this.cancelTask(id);
    }
  }

  // Read-only queue status
  getStatus(): AudioQueueStatus {
    return {
      pending: this.queue.length,
      isProcessing: this.isProcessing,
    };
  }

  // Safely release resources
  dispose(): Promise<void> {
    if (this.disposalPromise) {
      return this.disposalPromise;
    }

    this.disposed = true;

    // Reject active and pending promises
    this.cancelAll();

    this.disposalPromise = (async () => {
      // Wait for any in-progress decoding to finish
      if (this.processingPromise) {
        await this.processingPromise;
      }

      const context = this.audioContext;

      this.audioContext = null;
      this.activeTask = null;
      this.activeController = null;
      this.queue = [];

      if (context && context.state !== "closed") {
        await context.close();
      }
    })();

    return this.disposalPromise;
  }
}
