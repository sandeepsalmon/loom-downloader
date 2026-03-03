import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

let ffmpegInstance: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;

/** Lazily load and cache the ffmpeg.wasm instance. */
export async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const ffmpeg = new FFmpeg();

    // Load single-threaded core from CDN (no SharedArrayBuffer needed)
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        "application/wasm"
      ),
    });

    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  return loadingPromise;
}

/** Concatenate ArrayBuffers into a single Uint8Array. */
function concat(buffers: ArrayBuffer[]): Uint8Array {
  const totalLength = buffers.reduce((sum, b) => sum + b.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const buf of buffers) {
    result.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }
  return result;
}

/**
 * Mux video + audio TS segments into a single MP4.
 * Uses -c copy (no re-encoding) for speed.
 */
export async function muxToMp4(
  videoSegments: ArrayBuffer[],
  audioSegments: ArrayBuffer[],
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const ffmpeg = await getFFmpeg();

  // Concatenate all segments
  const videoData = concat(videoSegments);
  const audioData = audioSegments.length > 0 ? concat(audioSegments) : null;

  // Write to virtual filesystem
  await ffmpeg.writeFile("video.ts", videoData);

  let args: string[];

  if (audioData) {
    await ffmpeg.writeFile("audio.ts", audioData);
    args = [
      "-i", "video.ts",
      "-i", "audio.ts",
      "-c", "copy",
      "-bsf:a", "aac_adtstoasc",
      "-movflags", "+faststart",
      "-y", "output.mp4",
    ];
  } else {
    // Video-only (audio might be muxed in the TS already)
    args = [
      "-i", "video.ts",
      "-c", "copy",
      "-bsf:a", "aac_adtstoasc",
      "-movflags", "+faststart",
      "-y", "output.mp4",
    ];
  }

  // Track progress — register and clean up listener to avoid leaks
  const progressHandler = ({ progress }: { progress: number }) => {
    onProgress?.(Math.min(progress * 100, 100));
  };
  ffmpeg.on("progress", progressHandler);

  try {
    await ffmpeg.exec(args);
  } finally {
    ffmpeg.off("progress", progressHandler);
  }

  // Read result
  const data = await ffmpeg.readFile("output.mp4");
  const bytes = data instanceof Uint8Array ? new Uint8Array(data) : new TextEncoder().encode(data as string);
  const blob = new Blob([bytes], { type: "video/mp4" });

  // Cleanup virtual filesystem
  await ffmpeg.deleteFile("video.ts").catch(() => {});
  await ffmpeg.deleteFile("output.mp4").catch(() => {});
  if (audioData) await ffmpeg.deleteFile("audio.ts").catch(() => {});

  return blob;
}
