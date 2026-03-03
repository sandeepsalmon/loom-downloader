export interface SegmentInfo {
  url: string;
  duration: number;
}

export interface ResolveResponse {
  videoId: string;
  title: string;
  duration: number;
  videoSegments: SegmentInfo[];
  audioSegments: SegmentInfo[];
}

export type JobStatus =
  | "queued"
  | "resolving"
  | "downloading"
  | "muxing"
  | "complete"
  | "error";

export interface DownloadJob {
  id: string;
  url: string;
  videoId?: string;
  title?: string;
  status: JobStatus;
  error?: string;

  totalSegments: number;
  downloadedSegments: number;
  totalBytes: number;
  progress: number; // 0-100

  startedAt: number;
  speed: number; // bytes/sec
  eta: number; // seconds remaining

  blobUrl?: string;
  fileSize?: number;
}

export type DownloadAction =
  | { type: "ADD_JOB"; url: string; id: string }
  | { type: "RESOLVE_START"; id: string }
  | {
      type: "RESOLVE_SUCCESS";
      id: string;
      data: ResolveResponse;
    }
  | {
      type: "SEGMENT_COMPLETE";
      id: string;
      bytes: number;
    }
  | { type: "MUXING"; id: string }
  | { type: "MUXING_PROGRESS"; id: string; progress: number }
  | { type: "COMPLETE"; id: string; blobUrl: string; fileSize: number }
  | { type: "ERROR"; id: string; error: string }
  | { type: "REMOVE"; id: string };
