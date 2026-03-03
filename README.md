# Loom Video Downloader

Download Loom videos as MP4 — even when the download button is disabled.

## Web App

A Next.js web app that runs entirely in the browser. Paste a Loom URL, get an MP4.

### How It Works

1. **Resolve** — Server-side Edge function scrapes the Loom share page, extracts the signed HLS playlist URL, parses the playlist hierarchy, and returns a list of video/audio segment URLs
2. **Download** — Browser downloads all segments in parallel (6 concurrent) through a proxy that bypasses CORS restrictions
3. **Mux** — ffmpeg.wasm remuxes the TS segments into a proper MP4 with `-c copy` (no re-encoding, instant)
4. **Save** — Click to save the MP4 to your computer

### Features

- Multiple simultaneous downloads with a queue
- Real-time progress tracking per download
- Handles both `luna.loom.com` (newer) and `cdn.loom.com` (older) Loom video formats
- Automatic retry on failed segments (3 attempts with backoff)
- Cancel downloads mid-progress
- No data stored on the server — everything processes in your browser
- Dark terminal/cyberpunk UI

### Tech Stack

- **Next.js 16** with App Router
- **TypeScript**
- **Tailwind CSS** + shadcn/ui
- **Framer Motion** for animations
- **ffmpeg.wasm** for client-side TS to MP4 muxing
- **Vercel Edge Runtime** for API routes (no cold starts)

### Run Locally

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Deploy to Vercel

```bash
cd web
npx vercel --prod
```

## CLI Tool

A Python script for batch downloading from the command line.

### Usage

```bash
# Single video
python loom_dl.py https://www.loom.com/share/VIDEO_ID

# With output name
python loom_dl.py https://www.loom.com/share/VIDEO_ID -o my_video.mp4
```

Requires Python 3 and ffmpeg (`brew install ffmpeg`).

## Project Structure

```
.
├── web/                     # Next.js web app
│   ├── app/
│   │   ├── api/resolve/     # Loom URL → segment list (Edge)
│   │   ├── api/proxy/       # Segment proxy (Edge)
│   │   └── page.tsx         # Main UI
│   ├── components/          # React components
│   ├── lib/                 # Core logic
│   └── hooks/               # State management
├── loom_dl.py               # Python CLI downloader
├── batch_dl.py              # Batch download script
└── retry_failed.py          # Parallel retry for failed downloads
```

## How Loom Video Delivery Works

Loom serves videos via HLS (HTTP Live Streaming) with signed CloudFront URLs:

1. The share page embeds a signed m3u8 playlist URL
2. The master playlist references quality variants (720p, 1080p) and a separate audio track
3. Sub-playlists contain individual `.ts` segment references (4-6 seconds each)
4. All URLs carry time-limited CloudFront signed query parameters

The download restriction is at the UI level only — the video data is fully accessible if you have the signed URLs, which are embedded in the page source.

---

Created by Sandeep
