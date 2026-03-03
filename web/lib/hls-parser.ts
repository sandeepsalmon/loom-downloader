import type { SegmentInfo } from "@/types";

interface MasterPlaylist {
  videoPlaylists: { url: string; bandwidth: number; resolution?: string }[];
  audioPlaylistUrl: string | null;
}

/** Parse a master m3u8 playlist into structured data. */
export function parseMasterPlaylist(
  content: string,
  baseUrl: string,
  query: string
): MasterPlaylist {
  const lines = content.split("\n").map((l) => l.trim());
  const result: MasterPlaylist = { videoPlaylists: [], audioPlaylistUrl: null };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Audio playlist from EXT-X-MEDIA
    if (line.includes("TYPE=AUDIO")) {
      const uriMatch = line.match(/URI="([^"]+)"/);
      if (uriMatch) {
        result.audioPlaylistUrl = makeAbsolute(
          baseUrl,
          uriMatch[1],
          query
        );
      }
    }

    // Video variant from EXT-X-STREAM-INF
    if (line.startsWith("#EXT-X-STREAM-INF")) {
      const bwMatch = line.match(/BANDWIDTH=(\d+)/);
      const resMatch = line.match(/RESOLUTION=(\d+x\d+)/);
      const nextLine = lines[i + 1];
      if (bwMatch && nextLine && !nextLine.startsWith("#")) {
        result.videoPlaylists.push({
          url: makeAbsolute(baseUrl, nextLine, query),
          bandwidth: parseInt(bwMatch[1]),
          resolution: resMatch?.[1],
        });
      }
    }
  }

  // Sort by bandwidth descending — pick highest quality
  result.videoPlaylists.sort((a, b) => b.bandwidth - a.bandwidth);

  return result;
}

/** Parse a media playlist (video or audio) into segment list. */
export function parseMediaPlaylist(
  content: string,
  baseUrl: string,
  query: string
): SegmentInfo[] {
  const lines = content.split("\n").map((l) => l.trim());
  const segments: SegmentInfo[] = [];
  let currentDuration = 0;

  for (const line of lines) {
    if (line.startsWith("#EXTINF:")) {
      const durMatch = line.match(/#EXTINF:([\d.]+)/);
      currentDuration = durMatch ? parseFloat(durMatch[1]) : 0;
    } else if (line && !line.startsWith("#")) {
      segments.push({
        url: makeAbsolute(baseUrl, line, query),
        duration: currentDuration,
      });
      currentDuration = 0;
    }
  }

  return segments;
}

/** Convert a relative URL to absolute, appending signed query params. */
function makeAbsolute(
  baseUrl: string,
  relative: string,
  query: string
): string {
  if (relative.startsWith("http")) {
    // Already absolute — add query if missing
    return relative.includes("?") ? relative : `${relative}?${query}`;
  }
  // Strip query from base, join, add query
  const base = baseUrl.split("?")[0];
  const dir = base.substring(0, base.lastIndexOf("/") + 1);
  return `${dir}${relative}?${query}`;
}

/** Get the base URL directory from a full URL. */
export function getBaseUrl(url: string): string {
  const noQuery = url.split("?")[0];
  return noQuery.substring(0, noQuery.lastIndexOf("/") + 1);
}

/** Get the query string from a URL. */
export function getQuery(url: string): string {
  const idx = url.indexOf("?");
  return idx >= 0 ? url.substring(idx + 1) : "";
}
