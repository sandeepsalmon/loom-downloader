#!/usr/bin/env python3
"""Retry failed downloads — handle both CDN types and download segments directly."""

import os
import re
import subprocess
import sys
import tempfile
import concurrent.futures
import urllib.request
import urllib.error
from urllib.parse import urlparse, urljoin

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.loom.com/",
}

FAILED = [
    ("Inbox", "Part 2", "b85a8b160d4b427c9eeb64bfaace31b5"),
    ("Inbox", "Part 4", "07b4e50777ef4aed906ddd7c5e0fc510"),
    ("Inbox", "Part 6", "a80592dbfc8840aeb2bda91f23234e90"),
    ("Home", "Part 1", "44679ff235514eca9126b58cbe1fc6ed"),
]

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "downloads")


def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def get_hls_url(video_id):
    html = fetch(f"https://www.loom.com/share/{video_id}").decode("utf-8", errors="replace")
    # Try luna.loom.com first
    m = re.search(r'"url"\s*:\s*"(https://luna\.loom\.com/[^"]+\.m3u8[^"]*)"', html)
    if m:
        return m.group(1).replace("\\u0026", "&")
    # Then cdn.loom.com
    m = re.search(r'(https://cdn\.loom\.com/[^"\\]+\.m3u8[^"\\]*)', html)
    if m:
        return m.group(1).replace("\\u0026", "&")
    return None


def make_absolute(base_url, relative):
    """Make a relative URL absolute, preserving query params from base if needed."""
    if relative.startswith("http"):
        return relative
    # Just join based on base directory
    base_dir = base_url[:base_url.rfind("/") + 1]
    # Strip query from base_dir
    if "?" in base_dir:
        base_dir = base_dir.split("?")[0]
    return base_dir + relative


def download_video(module, part, video_id):
    """Download by fetching every playlist level and rewriting all URLs to absolute."""
    module_dir = os.path.join(OUTPUT_DIR, module)
    os.makedirs(module_dir, exist_ok=True)
    output = os.path.join(module_dir, f"{part}.mp4")

    if os.path.exists(output):
        os.remove(output)

    print(f"[*] {module} - {part}: getting HLS URL...")
    master_url = get_hls_url(video_id)
    if not master_url:
        print(f"[!] {module} - {part}: no HLS URL found")
        return False

    parsed = urlparse(master_url)
    query = parsed.query
    base_url = master_url[:master_url.rfind("/") + 1].split("?")[0]

    print(f"[*] {module} - {part}: fetching playlists...")
    tmpdir = tempfile.mkdtemp(prefix=f"loom_{video_id[:8]}_")

    try:
        master_content = fetch(master_url).decode("utf-8")
    except Exception as e:
        print(f"[!] {module} - {part}: failed to fetch master: {e}")
        return False

    def rewrite_and_save(content, name, content_base_url):
        """Rewrite a playlist: make all URLs absolute with signed params, save locally."""
        lines = content.splitlines()
        out_lines = []
        for line in lines:
            stripped = line.strip()
            if stripped and not stripped.startswith("#"):
                # Segment or sub-playlist URL
                abs_url = make_absolute(content_base_url, stripped)
                if "?" not in abs_url and query:
                    abs_url += "?" + query
                out_lines.append(abs_url)
            elif "URI=" in stripped:
                # Rewrite URI="..." in tags like EXT-X-MEDIA
                def replace_uri(m):
                    rel = m.group(1)
                    abs_url = make_absolute(content_base_url, rel)
                    if "?" not in abs_url and query:
                        abs_url += "?" + query
                    return f'URI="{abs_url}"'
                stripped = re.sub(r'URI="([^"]+)"', replace_uri, stripped)
                out_lines.append(stripped)
            else:
                out_lines.append(stripped)

        path = os.path.join(tmpdir, name)
        with open(path, "w") as f:
            f.write("\n".join(out_lines) + "\n")
        return path

    # Process master playlist — find sub-playlists and fetch/rewrite them
    master_lines = master_content.splitlines()
    processed_master_lines = []

    for line in master_lines:
        stripped = line.strip()
        if stripped and not stripped.startswith("#"):
            # This is a sub-playlist reference
            sub_name = stripped.split("?")[0].split("/")[-1]
            abs_sub_url = make_absolute(base_url, stripped)
            if "?" not in abs_sub_url and query:
                abs_sub_url += "?" + query

            try:
                sub_content = fetch(abs_sub_url).decode("utf-8")
                sub_base = abs_sub_url[:abs_sub_url.rfind("/") + 1].split("?")[0]
                local_path = rewrite_and_save(sub_content, sub_name, sub_base)
                processed_master_lines.append(local_path)
                print(f"    fetched {sub_name}")
            except Exception as e:
                print(f"    [!] failed {sub_name}: {e}")
                processed_master_lines.append(stripped)
        elif "URI=" in stripped:
            # Audio URI in EXT-X-MEDIA
            uri_match = re.search(r'URI="([^"]+)"', stripped)
            if uri_match:
                rel = uri_match.group(1)
                abs_url = make_absolute(base_url, rel)
                if "?" not in abs_url and query:
                    abs_url += "?" + query
                audio_name = rel.split("?")[0].split("/")[-1]
                try:
                    audio_content = fetch(abs_url).decode("utf-8")
                    audio_base = abs_url[:abs_url.rfind("/") + 1].split("?")[0]
                    local_audio = rewrite_and_save(audio_content, audio_name, audio_base)
                    stripped = stripped.replace(f'URI="{rel}"', f'URI="{local_audio}"')
                    print(f"    fetched {audio_name}")
                except Exception as e:
                    print(f"    [!] failed {audio_name}: {e}")
            processed_master_lines.append(stripped)
        else:
            processed_master_lines.append(stripped)

    master_path = os.path.join(tmpdir, "master.m3u8")
    with open(master_path, "w") as f:
        f.write("\n".join(processed_master_lines) + "\n")

    # Download with ffmpeg
    print(f"[*] {module} - {part}: downloading with ffmpeg...")
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
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=1200)

    # Cleanup
    for f in os.listdir(tmpdir):
        os.remove(os.path.join(tmpdir, f))
    os.rmdir(tmpdir)

    if result.returncode == 0 and os.path.exists(output):
        size_mb = os.path.getsize(output) / (1024 * 1024)
        print(f"[+] {module} - {part}: {size_mb:.1f} MB")
        return True
    else:
        print(f"[!] {module} - {part}: ffmpeg failed")
        if "error" in result.stderr.lower():
            # Print last relevant error line
            for err_line in result.stderr.splitlines()[-5:]:
                if err_line.strip():
                    print(f"    {err_line.strip()}")
        return False


# Run all 4 in parallel
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    futures = {
        pool.submit(download_video, m, p, v): (m, p)
        for m, p, v in FAILED
    }
    results = {}
    for f in concurrent.futures.as_completed(futures):
        results[futures[f]] = f.result()

ok = sum(1 for v in results.values() if v)
print(f"\nRetry done: {ok}/{len(FAILED)} succeeded")
