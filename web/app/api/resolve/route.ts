import { NextResponse } from "next/server";
import { extractVideoId, LOOM_HEADERS } from "@/lib/loom";
import {
  parseMasterPlaylist,
  parseMediaPlaylist,
  getBaseUrl,
  getQuery,
} from "@/lib/hls-parser";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json(
        { error: "Invalid Loom URL" },
        { status: 400 }
      );
    }

    // 1. Fetch the Loom share page
    const shareUrl = `https://www.loom.com/share/${videoId}`;
    const pageResp = await fetch(shareUrl, {
      headers: LOOM_HEADERS,
      signal: AbortSignal.timeout(10000),
    });
    if (!pageResp.ok) {
      return NextResponse.json(
        { error: `Loom returned ${pageResp.status}` },
        { status: 502 }
      );
    }
    const html = await pageResp.text();

    // 2. Extract title
    const titleMatch =
      html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/) ??
      html.match(/<title>([^<]+)<\/title>/);
    const title = titleMatch
      ? titleMatch[1].replace(" | Loom", "").trim()
      : `Loom ${videoId.slice(0, 8)}`;

    // 3. Find HLS m3u8 URL
    let hlsUrl: string | null = null;

    // luna.loom.com (newer format)
    const lunaMatch = html.match(
      /"url"\s*:\s*"(https:\/\/luna\.loom\.com\/[^"]+\.m3u8[^"]*)"/
    );
    if (lunaMatch) {
      hlsUrl = lunaMatch[1]
        .replace(/\\u0026/g, "&")
        .replace(/\\\//g, "/");
    }

    // cdn.loom.com (older format)
    if (!hlsUrl) {
      const cdnMatch = html.match(
        /(https:\/\/cdn\.loom\.com\/[^"\\]+\.m3u8[^"\\]*)/
      );
      if (cdnMatch) {
        hlsUrl = cdnMatch[1]
          .replace(/\\u0026/g, "&")
          .replace(/\\\//g, "/");
      }
    }

    if (!hlsUrl) {
      return NextResponse.json(
        { error: "Could not find video stream URL" },
        { status: 404 }
      );
    }

    // 4. Fetch master playlist
    const masterResp = await fetch(hlsUrl, { headers: LOOM_HEADERS });
    if (!masterResp.ok) {
      return NextResponse.json(
        { error: `Failed to fetch playlist: ${masterResp.status}` },
        { status: 502 }
      );
    }
    const masterContent = await masterResp.text();
    const baseUrl = getBaseUrl(hlsUrl);
    const query = getQuery(hlsUrl);

    const master = parseMasterPlaylist(masterContent, baseUrl, query);

    if (master.videoPlaylists.length === 0) {
      return NextResponse.json(
        { error: "No video streams found in playlist" },
        { status: 404 }
      );
    }

    // 5. Fetch the best video sub-playlist (with fallback for 403)
    const bestVideo = master.videoPlaylists[0];
    let videoSegments: { url: string; duration: number }[] = [];
    let audioSegments: { url: string; duration: number }[] = [];

    const videoPlaylistResp = await fetch(bestVideo.url, {
      headers: LOOM_HEADERS,
    });

    if (videoPlaylistResp.ok) {
      const videoPlaylistContent = await videoPlaylistResp.text();
      videoSegments = parseMediaPlaylist(
        videoPlaylistContent,
        getBaseUrl(bestVideo.url),
        query
      );

      // 6. Fetch audio sub-playlist (if separate)
      if (master.audioPlaylistUrl) {
        const audioPlaylistResp = await fetch(master.audioPlaylistUrl, {
          headers: LOOM_HEADERS,
        });
        if (audioPlaylistResp.ok) {
          const audioPlaylistContent = await audioPlaylistResp.text();
          audioSegments = parseMediaPlaylist(
            audioPlaylistContent,
            getBaseUrl(master.audioPlaylistUrl),
            query
          );
        }
      }
    } else {
      // Fallback: try fetching via yt-dlp style — look for luna.loom.com URL
      // or parse the master playlist segments directly if it's a single-variant stream
      // For older cdn.loom.com format, the sub-playlists need separate signed URLs
      // that the page doesn't provide. Return an error with a helpful message.

      // But first, check if this video also has a luna.loom.com URL we missed
      const lunaFallback = html.match(
        /"url"\s*:\s*"(https:\/\/luna\.loom\.com\/[^"]+\.m3u8[^"]*)"/
      );
      if (lunaFallback && !hlsUrl.includes("luna.loom.com")) {
        // Retry with luna URL
        const lunaUrl = lunaFallback[1]
          .replace(/\\u0026/g, "&")
          .replace(/\\\//g, "/");
        const lunaResp = await fetch(lunaUrl, { headers: LOOM_HEADERS });
        if (lunaResp.ok) {
          const lunaContent = await lunaResp.text();
          const lunaBase = getBaseUrl(lunaUrl);
          const lunaQuery = getQuery(lunaUrl);
          const lunaMaster = parseMasterPlaylist(lunaContent, lunaBase, lunaQuery);

          if (lunaMaster.videoPlaylists.length > 0) {
            const lunaBest = lunaMaster.videoPlaylists[0];
            const lunaVideoResp = await fetch(lunaBest.url, { headers: LOOM_HEADERS });
            if (lunaVideoResp.ok) {
              videoSegments = parseMediaPlaylist(
                await lunaVideoResp.text(),
                getBaseUrl(lunaBest.url),
                lunaQuery
              );
            }
            if (lunaMaster.audioPlaylistUrl) {
              const lunaAudioResp = await fetch(lunaMaster.audioPlaylistUrl, { headers: LOOM_HEADERS });
              if (lunaAudioResp.ok) {
                audioSegments = parseMediaPlaylist(
                  await lunaAudioResp.text(),
                  getBaseUrl(lunaMaster.audioPlaylistUrl),
                  lunaQuery
                );
              }
            }
          }
        }
      }

      if (videoSegments.length === 0) {
        return NextResponse.json(
          { error: "This video uses a restricted format. Sub-playlists returned 403." },
          { status: 403 }
        );
      }
    }

    // 7. Calculate total duration
    const duration = videoSegments.reduce((s, seg) => s + seg.duration, 0);

    return NextResponse.json({
      videoId,
      title,
      duration,
      videoSegments,
      audioSegments,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
