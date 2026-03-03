#!/usr/bin/env python3
"""
Loom Video Downloader - bypass download restrictions.
Downloads full videos via HLS stream extraction.

Usage:
    python loom_dl.py <loom_url> [--output filename.mp4]
"""

import argparse
import os
import re
import subprocess
import sys
import tempfile
import urllib.request
import urllib.error
from urllib.parse import urlparse


HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.loom.com/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


def extract_video_id(url: str) -> str:
    """Extract the 32-char hex video ID from a Loom URL."""
    patterns = [
        r"loom\.com/share/([a-f0-9]{32})",
        r"loom\.com/embed/([a-f0-9]{32})",
        r"loom\.com/v/([a-f0-9]{32})",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)

    if re.fullmatch(r"[a-f0-9]{32}", url.strip()):
        return url.strip()

    match = re.search(r"([a-f0-9]{32})", url)
    if match:
        return match.group(1)

    return None


def fetch_hls_url(video_id: str) -> str:
    """Scrape the Loom share page for the HLS m3u8 playlist URL."""
    share_url = f"https://www.loom.com/share/{video_id}"
    req = urllib.request.Request(share_url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode("utf-8", errors="replace")
    except urllib.error.URLError as e:
        print(f"  [!] Failed to fetch share page: {e}")
        return None

    # Look for the HLS playlist URL (luna.loom.com signed m3u8)
    match = re.search(r'"url"\s*:\s*"(https://luna\.loom\.com/[^"]+\.m3u8[^"]*)"', html)
    if match:
        url = match.group(1)
        url = url.replace("\\u0026", "&").replace("\\/", "/")
        return url

    # Fallback: any m3u8 URL
    match = re.search(r'(https://[^"\\]+\.m3u8[^"\\]*)', html)
    if match:
        url = match.group(1)
        url = url.replace("\\u0026", "&").replace("\\/", "/")
        return url

    return None


def _fetch_text(url: str) -> str:
    """Fetch a URL and return text content."""
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.read().decode("utf-8")


def _rewrite_playlist(content: str, base_url: str, query: str) -> str:
    """Rewrite relative URLs in m3u8 playlist to absolute URLs with signed query params."""
    lines = content.splitlines()
    rewritten = []
    for line in lines:
        line = line.strip()
        if line and not line.startswith("#"):
            # This is a relative URL — make it absolute with query params
            if not line.startswith("http"):
                line = base_url + line + "?" + query
            elif "?" not in line:
                line = line + "?" + query
        # Also fix URI= in #EXT-X-MEDIA tags
        elif 'URI="' in line and "://" not in line.split('URI="')[1]:
            uri_match = re.search(r'URI="([^"]+)"', line)
            if uri_match:
                rel = uri_match.group(1)
                abs_url = base_url + rel + "?" + query
                line = line.replace(f'URI="{rel}"', f'URI="{abs_url}"')
        rewritten.append(line)
    return "\n".join(rewritten)


def download_with_ffmpeg(hls_url: str, output: str) -> bool:
    """Download HLS stream using ffmpeg, rewriting playlists to carry signed params."""
    parsed = urlparse(hls_url)
    query = parsed.query
    # Base URL = everything up to and including the last /
    base_url = hls_url[:hls_url.rfind("/") + 1].split("?")[0]

    # 1. Fetch and rewrite master playlist
    try:
        master = _fetch_text(hls_url)
    except Exception as e:
        print(f"  [!] Failed to fetch master playlist: {e}")
        return False

    master_rewritten = _rewrite_playlist(master, base_url, query)

    # 2. For each sub-playlist referenced, fetch and rewrite it too
    tmpdir = tempfile.mkdtemp(prefix="loom_")
    master_path = os.path.join(tmpdir, "master.m3u8")

    # Find all sub-playlist URLs and fetch/rewrite them
    lines = master_rewritten.splitlines()
    final_lines = []
    for line in lines:
        if line.strip().startswith("http") and ".m3u8" in line:
            sub_url = line.strip()
            sub_name = sub_url.split("/")[-1].split("?")[0]
            try:
                sub_content = _fetch_text(sub_url)
                # Get base URL for this sub-playlist (segments are relative to it)
                sub_base = sub_url[:sub_url.rfind("/") + 1].split("?")[0]
                sub_rewritten = _rewrite_playlist(sub_content, sub_base, query)
                sub_path = os.path.join(tmpdir, sub_name)
                with open(sub_path, "w") as f:
                    f.write(sub_rewritten)
                final_lines.append(sub_path)
            except Exception as e:
                print(f"  [!] Failed to fetch sub-playlist {sub_name}: {e}")
                final_lines.append(line)
        elif 'URI="http' in line:
            # Audio playlist in EXT-X-MEDIA URI
            uri_match = re.search(r'URI="(https?://[^"]+)"', line)
            if uri_match:
                audio_url = uri_match.group(1)
                audio_name = audio_url.split("/")[-1].split("?")[0]
                try:
                    audio_content = _fetch_text(audio_url)
                    audio_base = audio_url[:audio_url.rfind("/") + 1].split("?")[0]
                    audio_rewritten = _rewrite_playlist(audio_content, audio_base, query)
                    audio_path = os.path.join(tmpdir, audio_name)
                    with open(audio_path, "w") as f:
                        f.write(audio_rewritten)
                    line = line.replace(uri_match.group(0), f'URI="{audio_path}"')
                except Exception:
                    pass
            final_lines.append(line)
        else:
            final_lines.append(line)

    with open(master_path, "w") as f:
        f.write("\n".join(final_lines))

    # 3. Run ffmpeg on the local rewritten playlist
    cmd = [
        "ffmpeg",
        "-protocol_whitelist", "file,http,https,tcp,tls,crypto",
        "-i", master_path,
        "-c", "copy",
        "-bsf:a", "aac_adtstoasc",
        "-movflags", "+faststart",
        "-y",
        output,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        # Cleanup temp files
        for f in os.listdir(tmpdir):
            os.remove(os.path.join(tmpdir, f))
        os.rmdir(tmpdir)
        return result.returncode == 0
    except subprocess.TimeoutExpired:
        print("  [!] ffmpeg timed out")
        return False
    except FileNotFoundError:
        print("  [!] ffmpeg not found. Install it: brew install ffmpeg")
        return False


def download_with_ytdlp(video_id: str, output: str) -> bool:
    """Download using yt-dlp."""
    url = f"https://www.loom.com/share/{video_id}"
    cmd = ["yt-dlp", "-o", output, url]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        return result.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False


def resolve_and_download(video_id: str, output: str) -> bool:
    """Try multiple methods to download the full video."""

    # Method 1: ffmpeg with rewritten HLS playlists
    print("  [1] Extracting HLS stream...")
    hls_url = fetch_hls_url(video_id)
    if hls_url:
        print("  [1] Downloading with ffmpeg...")
        if download_with_ffmpeg(hls_url, output):
            return True
        print("  [1] ffmpeg failed, trying fallback...")

    # Method 2: yt-dlp
    print("  [2] Trying yt-dlp...")
    if download_with_ytdlp(video_id, output):
        return True

    return False


def main():
    parser = argparse.ArgumentParser(
        description="Download Loom videos (bypass download restrictions)"
    )
    parser.add_argument("url", help="Loom video URL or video ID")
    parser.add_argument("-o", "--output", help="Output filename")
    args = parser.parse_args()

    video_id = extract_video_id(args.url)
    if not video_id:
        print(f"[!] Could not extract video ID from: {args.url}")
        sys.exit(1)

    output = args.output or f"loom_{video_id[:8]}.mp4"
    if os.path.exists(output):
        print(f"[!] File already exists: {output}")
        sys.exit(1)

    print(f"[*] Video ID: {video_id}")
    print(f"[*] Output:   {output}")

    success = resolve_and_download(video_id, output)

    if success and os.path.exists(output):
        size_mb = os.path.getsize(output) / (1024 * 1024)
        print(f"[+] Done! {size_mb:.1f} MB saved to {output}")
    else:
        if os.path.exists(output):
            os.remove(output)
        print("[!] Download failed.")
        sys.exit(1)


if __name__ == "__main__":
    main()
