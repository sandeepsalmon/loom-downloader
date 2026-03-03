import type { ResolveResponse, DownloadAction, SegmentInfo } from "@/types";
import { muxToMp4 } from "./ffmpeg-muxer";

const CONCURRENT_SEGMENTS = 6;
const MAX_RETRIES = 3;

/** Fetch segments with a concurrency pool. */
async function fetchSegments(
  segments: SegmentInfo[],
  onSegmentDone: (bytes: number) => void,
  signal: AbortSignal
): Promise<ArrayBuffer[]> {
  const results: ArrayBuffer[] = new Array(segments.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < segments.length) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");

      const idx = nextIndex++;
      const seg = segments[idx];
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const proxyUrl = `/api/proxy?url=${encodeURIComponent(seg.url)}`;
          const resp = await fetch(proxyUrl, { signal });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const buffer = await resp.arrayBuffer();
          results[idx] = buffer;
          onSegmentDone(buffer.byteLength);
          lastError = null;
          break;
        } catch (err) {
          if (signal.aborted) throw err;
          lastError = err as Error;
          // Brief delay before retry
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        }
      }

      if (lastError) throw lastError;
    }
  }

  // Launch concurrent workers
  const workerCount = Math.min(CONCURRENT_SEGMENTS, segments.length);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);

  return results;
}

/** Run a full download job: resolve → download segments → mux → blob. */
export async function runDownloadJob(
  jobId: string,
  url: string,
  dispatch: (action: DownloadAction) => void,
  signal: AbortSignal
) {
  try {
    // Phase 1: Resolve
    dispatch({ type: "RESOLVE_START", id: jobId });

    const resolveResp = await fetch("/api/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      signal,
    });

    if (!resolveResp.ok) {
      const err = await resolveResp.json();
      throw new Error(err.error || `Resolve failed: ${resolveResp.status}`);
    }

    const data: ResolveResponse = await resolveResp.json();
    dispatch({ type: "RESOLVE_SUCCESS", id: jobId, data });

    if (signal.aborted) return;

    // Phase 2: Download segments
    const onSegmentDone = (bytes: number) => {
      dispatch({ type: "SEGMENT_COMPLETE", id: jobId, bytes });
    };

    const [videoBuffers, audioBuffers] = await Promise.all([
      fetchSegments(data.videoSegments, onSegmentDone, signal),
      data.audioSegments.length > 0
        ? fetchSegments(data.audioSegments, onSegmentDone, signal)
        : Promise.resolve([]),
    ]);

    if (signal.aborted) return;

    // Phase 3: Mux to MP4
    dispatch({ type: "MUXING", id: jobId });

    const blob = await muxToMp4(videoBuffers, audioBuffers, (progress) => {
      dispatch({ type: "MUXING_PROGRESS", id: jobId, progress });
    });

    if (signal.aborted) return;

    // Phase 4: Complete
    const blobUrl = URL.createObjectURL(blob);
    dispatch({
      type: "COMPLETE",
      id: jobId,
      blobUrl,
      fileSize: blob.size,
    });
  } catch (err) {
    if (signal.aborted) return;
    const message = err instanceof Error ? err.message : "Download failed";
    dispatch({ type: "ERROR", id: jobId, error: message });
  }
}
