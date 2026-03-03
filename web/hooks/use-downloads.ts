"use client";

import { useReducer, useCallback, useRef } from "react";
import type { DownloadJob, DownloadAction } from "@/types";
import { runDownloadJob } from "@/lib/download-manager";

function reducer(state: DownloadJob[], action: DownloadAction): DownloadJob[] {
  switch (action.type) {
    case "ADD_JOB":
      return [
        ...state,
        {
          id: action.id,
          url: action.url,
          status: "queued",
          totalSegments: 0,
          downloadedSegments: 0,
          totalBytes: 0,
          progress: 0,
          startedAt: Date.now(),
          speed: 0,
          eta: 0,
        },
      ];

    case "RESOLVE_START":
      return state.map((j) =>
        j.id === action.id ? { ...j, status: "resolving", progress: 2 } : j
      );

    case "RESOLVE_SUCCESS":
      return state.map((j) =>
        j.id === action.id
          ? {
              ...j,
              status: "downloading",
              videoId: action.data.videoId,
              title: action.data.title,
              totalSegments:
                action.data.videoSegments.length +
                action.data.audioSegments.length,
              downloadedSegments: 0,
              progress: 5,
              startedAt: Date.now(), // Reset timer when actual download begins
            }
          : j
      );

    case "SEGMENT_COMPLETE":
      return state.map((j) => {
        if (j.id !== action.id) return j;
        const downloaded = j.downloadedSegments + 1;
        const totalBytes = j.totalBytes + action.bytes;
        const elapsed = (Date.now() - j.startedAt) / 1000;
        const speed = elapsed > 0 ? totalBytes / elapsed : 0;
        const segProgress = j.totalSegments > 0
          ? downloaded / j.totalSegments
          : 0;
        const progress = Math.min(5 + segProgress * 85, 90);
        const remainingSegs = j.totalSegments - downloaded;
        const avgSegTime = elapsed / downloaded;
        const eta = remainingSegs * avgSegTime;

        return {
          ...j,
          downloadedSegments: downloaded,
          totalBytes,
          speed,
          progress,
          eta,
        };
      });

    case "MUXING":
      return state.map((j) =>
        j.id === action.id ? { ...j, status: "muxing", progress: 91 } : j
      );

    case "MUXING_PROGRESS":
      return state.map((j) =>
        j.id === action.id
          ? { ...j, progress: 91 + action.progress * 0.09 }
          : j
      );

    case "COMPLETE":
      return state.map((j) =>
        j.id === action.id
          ? {
              ...j,
              status: "complete",
              progress: 100,
              blobUrl: action.blobUrl,
              fileSize: action.fileSize,
              eta: 0,
            }
          : j
      );

    case "ERROR":
      return state.map((j) =>
        j.id === action.id
          ? { ...j, status: "error", error: action.error }
          : j
      );

    case "REMOVE":
      return state.filter((j) => j.id !== action.id);

    default:
      return state;
  }
}

export function useDownloads() {
  const [jobs, dispatch] = useReducer(reducer, []);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());

  const addJob = useCallback(
    (url: string) => {
      const id = crypto.randomUUID();
      dispatch({ type: "ADD_JOB", url, id });

      const controller = new AbortController();
      abortControllers.current.set(id, controller);

      runDownloadJob(id, url, dispatch, controller.signal);
    },
    []
  );

  const cleanupJob = useCallback((id: string) => {
    // Abort any in-flight fetches
    const controller = abortControllers.current.get(id);
    if (controller) {
      controller.abort();
      abortControllers.current.delete(id);
    }
  }, []);

  const cancelJob = useCallback((id: string) => {
    cleanupJob(id);
    // Revoke blob URL to free memory
    const job = jobs.find((j) => j.id === id);
    if (job?.blobUrl) URL.revokeObjectURL(job.blobUrl);
    dispatch({ type: "REMOVE", id });
  }, [jobs, cleanupJob]);

  const removeJob = useCallback((id: string) => {
    cleanupJob(id);
    const job = jobs.find((j) => j.id === id);
    if (job?.blobUrl) URL.revokeObjectURL(job.blobUrl);
    dispatch({ type: "REMOVE", id });
  }, [jobs, cleanupJob]);

  const saveFile = useCallback((job: DownloadJob) => {
    if (!job.blobUrl) return;
    const a = document.createElement("a");
    a.href = job.blobUrl;
    a.download = `${job.title || "loom-video"}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  return { jobs, addJob, cancelJob, removeJob, saveFile };
}
