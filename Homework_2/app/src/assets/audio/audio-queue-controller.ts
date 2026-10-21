
import type {
  AudioTask,
  AudioQueueStatus,
} from "./audio-task";

export class AudioTaskQueue {
  private queue: AudioTask[] = [];

  private isProcessing = false;

  private activeController: AbortController | null = null;

  private audioContext: AudioContext | null = null;

  private disposed = false;

  // Add a new audio task to the FIFO queue
  async enqueue(trackUrl: string): Promise<AudioBuffer> {
    if (this.disposed) {
      throw new Error("Audio queue has been disposed.");
    }

    if (!trackUrl.trim()) {
      throw new Error("Audio URL cannot be empty.");
    }

    return new Promise<AudioBuffer>((resolve, reject) => {
      const controller = new AbortController();

      const task: AudioTask = {
        trackUrl,
        controller,
        resolve,
        reject,
      };

      // FIFO: insert at the end
      this.queue.push(task);

      void this.processNext();
    });
  }

  // Process one task at a time
  private async processNext(): Promise<void> {
    if (this.isProcessing || this.disposed) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.queue.length > 0 && !this.disposed) {
        // FIFO: remove from the front
        const task = this.queue.shift();

        if (!task) break;

        this.activeController = task.controller;

        try {
          const response = await fetch(task.trackUrl, {
            signal: task.controller.signal,
          });

          if (!response.ok) {
            throw new Error(
              `Failed to fetch audio: ${response.status}`
            );
          }

          const arrayBuffer = await response.arrayBuffer();

          if (task.controller.signal.aborted) {
            throw new DOMException(
              "Audio task cancelled.",
              "AbortError"
            );
          }

          // Create one shared AudioContext
          if (!this.audioContext) {
            this.audioContext = new AudioContext();
          }

          // Decode downloaded audio
          const audioBuffer =
            await this.audioContext.decodeAudioData(arrayBuffer);

          if (task.controller.signal.aborted || this.disposed) {
            throw new DOMException(
              "Audio task cancelled.",
              "AbortError"
            );
          }

          task.resolve(audioBuffer);
        } catch (error) {
          // Reject only the failed task
          task.reject(error);
        } finally {
          this.activeController = null;
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  // Get current queue status
  getStatus(): AudioQueueStatus {
    return {
      pending: this.queue.length,
      isProcessing: this.isProcessing,
    };
  }

  // Cancel the current task and all pending tasks
  cancelAll(): void {
    this.activeController?.abort();

    const pendingTasks = this.queue.splice(0);

    for (const task of pendingTasks) {
      task.controller.abort();

      task.reject(
        new DOMException(
          "Audio task cancelled.",
          "AbortError"
        )
      );
    }
  }

  // Release resources when the queue is no longer needed
  async dispose(): Promise<void> {
    if (this.disposed) return;

    this.disposed = true;

    this.cancelAll();

    const context = this.audioContext;
    this.audioContext = null;

    if (context && context.state !== "closed") {
      await context.close();
    }
  }
}
