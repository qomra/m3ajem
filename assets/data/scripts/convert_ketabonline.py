#!/usr/bin/env python3
"""
Convert ketabonline JSON to lo3awi dictionary format.
Book: إعراب القرآن وبيانه - محيي الدين درويش

Indexes by surah/ayah as flat entries.
Verse boundaries detected via pattern: [سورة NAME (N) : آية N] or [سورة NAME (N) : الآيات N الى N]
Arabic numerals (١٢٣) are converted to Western (123) for the root keys.
"""

import os
import json
import re

INPUT_FILE = os.path.join(os.path.dirname(__file__), "ketabonline_book_2716.json")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "maajim", "lo3awi", "i3rab_quran")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "إعراب القرآن وبيانه.json")

# Arabic-to-Western numeral mapping
ARABIC_NUMS = str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789')


def arabic_to_int(s):
    """Convert Arabic numeral string (١٢٣) to int (123)."""
    return int(s.translate(ARABIC_NUMS))


def strip_html(text):
    """Remove HTML tags from text."""
    text = re.sub(r'<br\s*/?>', '\n', text)
    text = re.sub(r'</p>', '\n', text)
    text = re.sub(r'<[^>]+>', '', text)
    # Decode HTML entities
    text = text.replace('&amp;', '&')
    text = text.replace('&lt;', '<')
    text = text.replace('&gt;', '>')
    text = text.replace('&quot;', '"')
    text = text.replace('&#39;', "'")
    text = text.replace('&nbsp;', ' ')
    return text


def clean_text(text):
    """Clean extracted text: strip HTML, normalize whitespace."""
    text = strip_html(text)
    # Normalize whitespace
    text = re.sub(r'[ \t]+', ' ', text)
    # Normalize multiple newlines
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def build_root_key(surah_name, surah_num, ayah_start, ayah_end=None):
    """
    Build the root key for a verse entry.
    Format: "001 سورة الفاتحة / آية 1" or "002 سورة البقرة / آيات 2-4"
    Surah number is zero-padded for correct sorting.
    """
    surah_name = surah_name.strip()
    prefix = f"{surah_num:03d}"
    if ayah_end and ayah_end != ayah_start:
        return f"{prefix} سورة {surah_name} / آيات {ayah_start:03d}-{ayah_end:03d}"
    else:
        return f"{prefix} سورة {surah_name} / آية {ayah_start:03d}"


# Regex for verse boundary markers (after HTML stripping)
# The HTML content has nested spans, so we strip HTML first then match plain text.
# Matches: [سورة الفاتحة (١) : آية ١] or [سورة البقرة (٢) : الآيات ١ الى ٥]
# Numbers can be Arabic (١٢٣) or Western (123)
NUM = r'[٠-٩\d]+'
VERSE_PATTERN = re.compile(
    r'\[سورة\s+'
    r'([^\(\[]+?)'                  # Surah name (group 1)
    r'\s*\(\s*(' + NUM + r')\s*\)'  # Surah number (group 2)
    r'\s*:\s*'
    r'(?:'
        r'آية\s+(' + NUM + r')'                                        # Single ayah (group 3)
        r'|'
        r'الآيات?\s+(' + NUM + r')\s+(?:الى|إلى)\s+(' + NUM + r')'    # Ayah range (groups 4, 5)
    r')'
    r'\s*\]'
)


def find_verse_markers(text):
    """
    Find all verse boundary markers in text.
    Returns list of (start_pos, end_pos, root_key) tuples.
    """
    markers = []
    for match in VERSE_PATTERN.finditer(text):
        surah_name = match.group(1).strip()
        surah_num = arabic_to_int(match.group(2))

        if match.group(3):
            # Single ayah
            ayah_start = arabic_to_int(match.group(3))
            root_key = build_root_key(surah_name, surah_num, ayah_start)
        else:
            # Ayah range
            ayah_start = arabic_to_int(match.group(4))
            ayah_end = arabic_to_int(match.group(5))
            root_key = build_root_key(surah_name, surah_num, ayah_start, ayah_end)

        markers.append((match.start(), match.end(), root_key))

    return markers


def main():
    print(f"Loading {INPUT_FILE}...")

    if not os.path.exists(INPUT_FILE):
        print(f"Error: {INPUT_FILE} not found.")
        print("Run fetch_ketabonline.py first to download the pages.")
        return

    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Extract pages from the data structure
    if isinstance(data, dict) and 'pages' in data:
        pages = data['pages']
    elif isinstance(data, list):
        pages = data
    else:
        print("Error: Unexpected data structure")
        return

    print(f"Loaded {len(pages)} pages")

    # Sort pages by id (global sequential order; 'page' is per-volume)
    pages_sorted = sorted(pages, key=lambda x: x.get('id', 0))

    # Strip HTML from all pages first, then concatenate
    # This avoids issues with verse markers split across HTML tags
    full_text = ""
    for page in pages_sorted:
        content = page.get('content', '')
        if content:
            cleaned_page = strip_html(content)
            full_text += cleaned_page + "\n"

    print(f"Total text length: {len(full_text):,} characters")

    # Find all verse markers
    markers = find_verse_markers(full_text)
    print(f"Found {len(markers)} verse markers")

    if not markers:
        print("Error: No verse markers found! Check the input data format.")
        # Debug: show some text around expected markers
        for term in ['سورة الفاتحة', 'سورة البقرة', '[سورة']:
            idx = full_text.find(term)
            if idx >= 0:
                print(f"  Found '{term}' at pos {idx}: ...{full_text[idx:idx+200]}...")
        return

    # Extract entries between markers
    roots_data = {}
    skipped_before_first = 0

    for i, (start_pos, marker_end, root_key) in enumerate(markers):
        # Get text from after this marker to start of next marker (or end)
        if i + 1 < len(markers):
            next_start = markers[i + 1][0]
            raw_text = full_text[marker_end:next_start]
        else:
            raw_text = full_text[marker_end:]

        # Normalize whitespace (HTML already stripped)
        cleaned = re.sub(r'[ \t]+', ' ', raw_text)
        cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
        cleaned = cleaned.strip()

        if not cleaned:
            continue

        # Append if key already exists (same verse referenced multiple times)
        if root_key in roots_data:
            roots_data[root_key] += "\n\n" + cleaned
        else:
            roots_data[root_key] = cleaned

    # Check text before first marker
    if markers:
        before_first = full_text[:markers[0][0]].strip()
        if len(before_first) > 100:
            skipped_before_first = len(before_first)

    print(f"\nStats:")
    print(f"  Verse entries extracted: {len(roots_data)}")
    print(f"  Text before first marker: {skipped_before_first} chars (skipped)")

    # Create output
    output = {
        "name": "إعراب القرآن وبيانه",
        "description": "تأليف: محيي الدين درويش | ١٠ مجلدات | دار الإرشاد - حمص",
        "type": "lo3awi",
        "data": roots_data
    }

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print(f"\nSaving to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Done!")

    # Show samples
    print("\n" + "=" * 60)
    print("Sample entries:")
    print("=" * 60)
    for root, definition in list(roots_data.items())[:10]:
        preview = definition[:120].replace('\n', ' ')
        print(f"\n[{root}] ({len(definition)} chars)")
        print(f"  {preview}...")


if __name__ == '__main__':
    main()
