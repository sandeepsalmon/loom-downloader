<p align="center">
  <h1 align="center">Loom Video Downloader</h1>
  <p align="center">
    Download Loom videos as MP4 — even when the download button is disabled.
    <br />
    <a href="https://web-flame-one-70.vercel.app"><strong>Try the Web App &rarr;</strong></a>
  </p>
</p>

<br />

## Overview

Two tools in one repo:

| | Web App | CLI |
|---|---|---|
| **Best for** | Quick single downloads | Batch downloading |
| **Runs on** | Browser (Vercel-hosted) | Terminal (Python + ffmpeg) |
| **Muxing** | ffmpeg.wasm (client-side) | ffmpeg (native) |
| **Queue** | Yes, with live progress | Sequential or parallel |

<br />

## Web App

Paste a Loom URL. Get an MP4. That's it.

### Architecture

```
                          ┌──────────────────────────┐
  Paste URL ──────────▸   │  /api/resolve  (Edge)    │
                          │  Scrape share page       │
                          │  Parse HLS playlists     │
                          │  Return segment URLs     │
                          └────────────┬─────────────┘
                                       │
                          ┌────────────▼─────────────┐
  6x parallel fetches ──▸ │  /api/proxy  (Edge)      │
  with progress bar       │  Proxy segments (CORS)   │
                          └────────────┬─────────────┘
                                       │
                          ┌────────────▼─────────────┐
  Client-side muxing ──▸  │  ffmpeg.wasm             │
  -c copy (no reencode)   │  TS → MP4 + faststart    │
                          └────────────┬─────────────┘
                                       │
                                  Save .mp4
```

> Everything processes in your browser. Nothing is stored on the server.

### Features

- **Queue-based** — add multiple URLs, download simultaneously
- **Real-time progress** — per-segment tracking with ETA and speed
- **Auto-retry** — failed segments retry 3x with exponential backoff
- **Dual format support** — handles both `luna.loom.com` and `cdn.loom.com` video formats
- **Proper MP4** — remuxed with faststart for instant playback
- **Cancel anytime** — abort in-flight downloads cleanly
- **Privacy-first** — no tracking, no accounts, no server storage

### Tech Stack

```
Next.js 16        App Router + Edge Runtime
TypeScript        End-to-end type safety
Tailwind CSS      + shadcn/ui components
Framer Motion     Animated progress UI
ffmpeg.wasm       Client-side TS → MP4 muxing
Vercel Edge       Zero cold-start API routes
```

### Run Locally

```bash
cd web
npm install
npm run dev
```

### Deploy

```bash
cd web
npx vercel --prod
```

<br />

## CLI Tool

Python script for downloading from the terminal. Handles edge cases the web app can't (restricted CDN formats).

### Quick Start

```bash
# requires: python3, ffmpeg
python loom_dl.py https://www.loom.com/share/VIDEO_ID
```

### Options

```
Usage: loom_dl.py <url> [-o output.mp4]

Arguments:
  url           Loom share/embed URL or 32-char video ID

Options:
  -o, --output  Output filename (default: loom_XXXXXXXX.mp4)
```

### Batch Download

```bash
# Edit batch_dl.py with your URLs, then:
python batch_dl.py
```

Downloads are organized into folders by module name.

<br />

## Project Structure

```
.
├── web/                          Next.js web app
│   ├── app/
│   │   ├── api/resolve/          POST: Loom URL → segment list
│   │   ├── api/proxy/            GET: proxy TS segments past CORS
│   │   ├── layout.tsx            Dark theme, JetBrains Mono
│   │   └── page.tsx              Main page
│   ├── components/
│   │   ├── ui/animated-download  Cyberpunk progress animation
│   │   ├── url-input             Terminal-style URL input
│   │   ├── download-card         Per-download progress card
│   │   └── download-queue        Queue container
│   ├── lib/
│   │   ├── loom.ts               Video ID extraction + validation
│   │   ├── hls-parser.ts         M3U8 playlist parsing
│   │   ├── download-manager.ts   Segment fetching orchestrator
│   │   └── ffmpeg-muxer.ts       ffmpeg.wasm muxing
│   └── hooks/
│       └── use-downloads.ts      Queue state (useReducer)
│
├── loom_dl.py                    CLI downloader (HLS + ffmpeg)
├── batch_dl.py                   Batch download utility
└── retry_failed.py               Parallel retry with fallbacks
```

<br />

## How It Works (Technical)

Loom's download restriction is UI-level only. The video data is fully accessible:

```
Share page HTML
  └─ Contains signed HLS URL (luna.loom.com or cdn.loom.com)
       └─ Master playlist (.m3u8)
            ├─ Video sub-playlist → segment-0.ts, segment-1.ts, ...
            └─ Audio sub-playlist → segment-0.ts, segment-1.ts, ...
```

All URLs carry **time-limited CloudFront signed query parameters** (`Policy`, `Signature`, `Key-Pair-Id`). The key insight: these signed params from the master playlist URL also grant access to all sub-resources when propagated correctly.

The download process:
1. Fetch share page → extract m3u8 URL via regex
2. Fetch master playlist → pick highest quality variant
3. Fetch sub-playlists → extract segment URLs (make relative → absolute, carry signed params)
4. Download all segments → concatenate → remux to MP4 with `-c copy`

<br />

---

<p align="center">
  Created by <strong>Sandeep</strong>
</p>
