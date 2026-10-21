
export interface AudioTask {
  trackUrl: string;
  controller: AbortController;
  resolve: (buffer: AudioBuffer) => void;
  reject: (error: unknown) => void;
}

export interface AudioQueueStatus {
  pending: number;
  isProcessing: boolean;
}
