#!/usr/bin/env python3
"""Batch download all Loom videos organized by module."""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from loom_dl import extract_video_id, resolve_and_download

VIDEOS = [
    ("Onboarding", "Part 1", "https://www.loom.com/share/72d1a53da7014515975bc96c88a32b09"),
    ("Onboarding", "Part 2", "https://www.loom.com/share/872492f8c8f449839dda515970723946"),
    ("Onboarding", "Part 3", "https://www.loom.com/share/8a1dfb6b5ebd422eb8447f00e9195c8c"),
    ("Onboarding", "Part 4", "https://www.loom.com/share/95a9602a02a942d194784a600f0a1fb4"),
    ("Onboarding", "Part 5", "https://www.loom.com/share/051c2d79c461463b9237475871fc6c97"),
    ("Onboarding", "Part 6", "https://www.loom.com/share/bd82f50d94894bea86a517b5223c3397"),
    ("Onboarding", "Part 7", "https://www.loom.com/share/e1142a9d0e98477099e5602eca02815a"),
    ("Onboarding", "Part 8", "https://www.loom.com/share/2d0419fb29bf4451a85c6f56503fd453"),
    ("Onboarding", "Part 9", "https://www.loom.com/share/51e203d00a814ca2b5866ea0df02ac3c"),
    ("Onboarding - Family Background", "Part 1", "https://www.loom.com/share/e162e063c5f543308250cebe37b343b5"),
    ("Onboarding - Family Background", "Part 2", "https://www.loom.com/share/7bffca74aea24da1bcf5e8b95cfbd46c"),
    ("Inbox", "Part 1", "https://www.loom.com/share/745547e9018f4655a2a69bf54f3b86a0"),
    ("Inbox", "Part 2", "https://www.loom.com/share/b85a8b160d4b427c9eeb64bfaace31b5"),
    ("Inbox", "Part 3", "https://www.loom.com/share/3f8ca77921af4ef295c5ac1009dea8f8"),
    ("Inbox", "Part 4", "https://www.loom.com/share/07b4e50777ef4aed906ddd7c5e0fc510"),
    ("Inbox", "Part 5", "https://www.loom.com/share/8d2b3ffbcbd24550a0be8277d5775450"),
    ("Inbox", "Part 6", "https://www.loom.com/share/a80592dbfc8840aeb2bda91f23234e90"),
    ("Inbox", "Part 7", "https://www.loom.com/share/7250f41d50ac45428395728128af9fa1"),
    ("Home", "Part 1", "https://www.loom.com/share/44679ff235514eca9126b58cbe1fc6ed"),
    ("Home", "Part 2", "https://www.loom.com/share/2afcd10fbd984990a6194f71115ceb67"),
    ("Profile", "Part 1", "https://www.loom.com/share/b5d3c54af03c488f93d069cf2a9b595f"),
    ("Profile", "Part 2", "https://www.loom.com/share/b5f81066114e4941a6c87df84351155b"),
    ("Profile", "Part 3", "https://www.loom.com/share/eea04b838fd2430cbf3994aae84df0e6"),
]

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "downloads")


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    total = len(VIDEOS)
    succeeded = 0
    failed = []

    for i, (module, part, url) in enumerate(VIDEOS, 1):
        module_dir = os.path.join(OUTPUT_DIR, module)
        os.makedirs(module_dir, exist_ok=True)

        filename = f"{part}.mp4"
        output_path = os.path.join(module_dir, filename)

        print(f"\n{'='*60}")
        print(f"[{i}/{total}] {module} - {part}")
        print(f"{'='*60}")

        if os.path.exists(output_path):
            size_mb = os.path.getsize(output_path) / (1024 * 1024)
            if size_mb > 1.5:  # skip only if file is bigger than 1.5MB (not a thumbnail)
                print(f"  [skip] Already exists ({size_mb:.1f} MB)")
                succeeded += 1
                continue
            else:
                print(f"  [!] Existing file too small ({size_mb:.1f} MB), re-downloading...")
                os.remove(output_path)

        video_id = extract_video_id(url)
        if not video_id:
            print(f"  [!] Could not extract video ID from: {url}")
            failed.append((module, part, url, "bad URL"))
            continue

        print(f"  Video ID: {video_id}")

        if resolve_and_download(video_id, output_path):
            size_mb = os.path.getsize(output_path) / (1024 * 1024)
            print(f"  [+] Saved {size_mb:.1f} MB")
            succeeded += 1
        else:
            failed.append((module, part, url, "download failed"))

    print(f"\n{'='*60}")
    print(f"DONE: {succeeded}/{total} downloaded")
    if failed:
        print(f"\nFailed ({len(failed)}):")
        for module, part, url, reason in failed:
            print(f"  - {module} {part}: {reason}")
            print(f"    {url}")
    print(f"\nFiles saved to: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
