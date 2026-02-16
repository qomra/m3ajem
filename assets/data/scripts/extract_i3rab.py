#!/usr/bin/env python3
"""
Extract only the الإعراب section from each entry in إعراب القرآن وبيانه.
Strips out اللغة, البلاغة, الفوائد and other sections.
"""

import os
import json
import re

INPUT_FILE = os.path.join(os.path.dirname(__file__), "..", "maajim", "lo3awi", "i3rab_quran", "إعراب القرآن وبيانه.json")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__))
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "إعراب القرآن (إعراب فقط).json")

# Section delimiters that come AFTER الإعراب
# These mark the end of the إعراب section
END_DELIMITERS = [
    'البلاغة:',
    'الفوائد:',
]

# All known section delimiters (to detect any section boundary)
ALL_DELIMITERS = [
    'اللغة:',
    'الإعراب:',
    'البلاغة:',
    'الفوائد:',
]


def extract_i3rab(text):
    """
    Extract the الإعراب section from an entry's text.
    Returns the إعراب content, or None if not found.
    """
    # Find الإعراب: marker (or misspelled الأعراب: as section header on its own line)
    i3rab_marker = 'الإعراب:'
    start = text.find(i3rab_marker)

    if start == -1:
        # Try misspelled variant — only match as section header (preceded by newline)
        pos = text.find('\nالأعراب:\n')
        if pos != -1:
            i3rab_marker = 'الأعراب:'
            start = pos + 1  # skip the leading newline

    if start == -1:
        return None

    # Move past the marker
    content_start = start + len(i3rab_marker)

    # Find the earliest end delimiter after الإعراب
    end = len(text)
    for delimiter in END_DELIMITERS:
        pos = text.find('\n' + delimiter, content_start)
        if pos == -1:
            # Try without leading newline (in case it's at start of remaining text)
            pos = text.find(delimiter, content_start)
            if pos != -1 and pos > content_start:
                # Make sure it's on its own line (preceded by newline or at content_start)
                preceding = text[max(content_start, pos - 1):pos]
                if preceding not in ('\n', ''):
                    continue
        if pos != -1 and pos < end:
            end = pos

    return text[content_start:end].strip()


def main():
    print(f"Loading {INPUT_FILE}...")

    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        source = json.load(f)

    data = source['data']
    print(f"Loaded {len(data)} entries")

    extracted = {}
    no_i3rab = 0
    empty_i3rab = 0

    for key, text in data.items():
        i3rab = extract_i3rab(text)

        if i3rab is None:
            no_i3rab += 1
            continue

        if not i3rab:
            empty_i3rab += 1
            continue

        extracted[key] = i3rab

    print(f"\nStats:")
    print(f"  Total entries: {len(data)}")
    print(f"  Extracted إعراب: {len(extracted)}")
    print(f"  No إعراب found: {no_i3rab}")
    print(f"  Empty إعراب: {empty_i3rab}")

    # Calculate size reduction
    original_size = sum(len(v) for v in data.values())
    extracted_size = sum(len(v) for v in extracted.values())
    print(f"\n  Original text size: {original_size:,} chars")
    print(f"  Extracted text size: {extracted_size:,} chars")
    print(f"  Reduction: {100 * (1 - extracted_size / original_size):.1f}%")

    # Build output
    output = {
        "name": "إعراب القرآن (إعراب فقط)",
        "description": "الإعراب فقط من كتاب إعراب القرآن وبيانه | محيي الدين درويش",
        "type": "lo3awi",
        "data": extracted
    }

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print(f"\nSaving to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print("Done!")

    # Show samples
    print("\n" + "=" * 60)
    print("Sample entries (first 200 chars):")
    print("=" * 60)
    for key, val in list(extracted.items())[:5]:
        preview = val[:200].replace('\n', ' ')
        print(f"\n[{key}] ({len(val)} chars)")
        print(f"  {preview}...")


if __name__ == '__main__':
    main()
