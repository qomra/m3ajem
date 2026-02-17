#!/usr/bin/env python3
"""
Prepend Quran tilawa (recitation) audio before i3rab (grammar) audio.

For a file like 001_001_007.wav, it concatenates:
  quran/001001.mp3 + quran/001002.mp3 + ... + quran/001007.mp3 + i3rab_quran/001_001_007.wav

Output: i3rab_quran/001_001_007_with_tilawa.mp3

Usage:
    python prepend_tilawa.py 001_001_007.wav           # Single file
    python prepend_tilawa.py --all                      # All files in i3rab_quran/
"""

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

I3RAB_BASE = Path(__file__).parent.parent / "maajim" / "audio" / "i3rab_quran"
I3RAB_DIR = I3RAB_BASE / "original"
OUTPUT_DIR = I3RAB_BASE / "with_tilawa"
TILAWA_DIR = Path(__file__).parent.parent / "maajim" / "audio" / "quran"
ISTI3AZA = I3RAB_BASE / "isti3aza.mp3"
ALI3RAB = I3RAB_BASE / "ali3rab.mp3"


def parse_filename(filename: str):
    """Parse SSS_FFF_TTT from filename. Returns (surah, from, to) or None."""
    stem = Path(filename).stem
    # Remove _with_tilawa suffix if present
    stem = stem.replace("_with_tilawa", "")
    m = re.match(r"^(\d{3})_(\d{3})_(\d{3})$", stem)
    if not m:
        return None
    return int(m.group(1)), int(m.group(2)), int(m.group(3))


def get_tilawa_files(surah: int, ayah_from: int, ayah_to: int):
    """Get list of tilawa mp3 paths for the given ayah range."""
    files = []
    for ayah in range(ayah_from, ayah_to + 1):
        name = f"{surah:03d}{ayah:03d}.mp3"
        path = TILAWA_DIR / name
        if not path.exists():
            print(f"  Warning: tilawa file not found: {path}")
            return None
        files.append(path)
    return files


def prepend_tilawa(i3rab_file: Path):
    """Prepend tilawa to a single i3rab audio file."""
    parsed = parse_filename(i3rab_file.name)
    if not parsed:
        print(f"  Skipping {i3rab_file.name}: can't parse surah/ayah from filename")
        return False

    surah, ayah_from, ayah_to = parsed
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_file = OUTPUT_DIR / f"{surah:03d}_{ayah_from:03d}_{ayah_to:03d}_with_tilawa.mp3"

    if output_file.exists():
        print(f"  Already exists: {output_file.name}")
        return True

    tilawa_files = get_tilawa_files(surah, ayah_from, ayah_to)
    if tilawa_files is None:
        return False

    is_first_ayah = (ayah_from == 1)
    extras = []
    if not is_first_ayah:
        extras.append("isti3aza")
    extras.append("tilawa")
    extras.append("silence")
    extras.append("الإعراب")
    extras.append("i3rab")
    print(f"  {i3rab_file.name} -> {output_file.name}  [{' + '.join(extras)}]")

    # Use ffmpeg filter_complex concat to decode all inputs to PCM first,
    # then re-encode as one stream. This avoids click/tick artifacts at boundaries.
    try:
        inputs = []
        idx = 0

        # Optional: isti3aza (only if not first ayah in surah)
        isti3aza_idx = None
        if not is_first_ayah:
            inputs += ["-i", str(ISTI3AZA)]
            isti3aza_idx = idx
            idx += 1

        # Tilawa files
        tilawa_start_idx = idx
        for t in tilawa_files:
            inputs += ["-i", str(t)]
            idx += 1
        n_tilawa = len(tilawa_files)

        # الإعراب label
        inputs += ["-i", str(ALI3RAB)]
        ali3rab_idx = idx
        idx += 1

        # i3rab
        inputs += ["-i", str(i3rab_file)]
        i3rab_idx = idx

        # Build filter graph - resample everything to 24000Hz mono
        filter_parts = []
        concat_labels = []

        # 1. Isti3aza (if present)
        if isti3aza_idx is not None:
            filter_parts.append(f"[{isti3aza_idx}:a]aresample=24000[isti]")
            concat_labels.append("[isti]")

        # 2. Tilawa
        tilawa_inputs = "".join(f"[{tilawa_start_idx + i}:a]" for i in range(n_tilawa))
        filter_parts.append(f"{tilawa_inputs}concat=n={n_tilawa}:v=0:a=1[til]")
        filter_parts.append("[til]aresample=24000[tilf]")
        concat_labels.append("[tilf]")

        # 3. 2s silence
        filter_parts.append("anullsrc=r=24000:cl=mono[s]")
        filter_parts.append("[s]atrim=0:2,aresample=24000[silence]")
        concat_labels.append("[silence]")

        # 4. الإعراب label
        filter_parts.append(f"[{ali3rab_idx}:a]aresample=24000[lbl]")
        concat_labels.append("[lbl]")

        # 5. Short silence (0.5s) between label and i3rab
        filter_parts.append("anullsrc=r=24000:cl=mono[s2]")
        filter_parts.append("[s2]atrim=0:0.5,aresample=24000[gap]")
        concat_labels.append("[gap]")

        # 6. i3rab (trim first 50ms to remove TTS click, fade in 50ms)
        filter_parts.append(f"[{i3rab_idx}:a]atrim=start=0.05,asetpts=PTS-STARTPTS,afade=t=in:d=0.05,aresample=24000[i3f]")
        concat_labels.append("[i3f]")

        # Final concat
        n_total = len(concat_labels)
        filter_parts.append(f"{''.join(concat_labels)}concat=n={n_total}:v=0:a=1[out]")

        filter_str = ";".join(filter_parts)

        cmd = ["ffmpeg", "-y"] + inputs + [
            "-filter_complex", filter_str,
            "-map", "[out]",
            "-c:a", "libmp3lame", "-q:a", "4",
            str(output_file),
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            print(f"  ffmpeg error: {result.stderr[-300:]}")
            return False

        print(f"  Done: {output_file.name} ({output_file.stat().st_size // 1024} KB)")
        return True

    finally:
        pass


def main():
    parser = argparse.ArgumentParser(description="Prepend Quran tilawa before i3rab audio")
    parser.add_argument("file", nargs="?", help="Single i3rab file (e.g. 001_001_007.wav)")
    parser.add_argument("--all", action="store_true", help="Process all files in i3rab_quran/")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing _with_tilawa files")
    args = parser.parse_args()

    if not args.file and not args.all:
        parser.print_help()
        return

    # Check ffmpeg
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
    except FileNotFoundError:
        print("Error: ffmpeg not found. Install with: brew install ffmpeg")
        sys.exit(1)

    if args.all:
        # Process all .wav files that don't have _with_tilawa suffix
        files = sorted(I3RAB_DIR.glob("*.wav"))
        files = [f for f in files if "_with_tilawa" not in f.name]
        print(f"Found {len(files)} i3rab files in {I3RAB_DIR}")

        ok = 0
        errors = 0
        for f in files:
            if prepend_tilawa(f):
                ok += 1
            else:
                errors += 1

        print(f"\nDone: {ok} ok, {errors} errors")
    else:
        path = I3RAB_DIR / args.file
        if not path.exists():
            # Also try base dir for backwards compatibility
            path = I3RAB_BASE / args.file
        if not path.exists():
            print(f"Error: {path} not found")
            sys.exit(1)
        prepend_tilawa(path)


if __name__ == "__main__":
    main()
