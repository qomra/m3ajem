#!/usr/bin/env python3
"""
Convert turath JSON to moraqman dictionary format.
Roots are identified by letter combination headers like "العين والكاف" → "عك"
"""

import os
import json
import re

INPUT_FILE = os.path.join(os.path.dirname(__file__), "turath_book_83.json")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "maajim", "lo3awi", "almohit")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "المحيط في اللغة.json")

# Letter name to actual letter mapping
LETTER_MAP = {
    'العين': 'ع',
    'الكاف': 'ك',
    'الجيم': 'ج',
    'الشين': 'ش',
    'الضاد': 'ض',
    'الصاد': 'ص',
    'السين': 'س',
    'الزاي': 'ز',
    'الطاء': 'ط',
    'الدال': 'د',
    'التاء': 'ت',
    'الظاء': 'ظ',
    'الذال': 'ذ',
    'الثاء': 'ث',
    'الراء': 'ر',
    'اللام': 'ل',
    'النون': 'ن',
    'الفاء': 'ف',
    'الباء': 'ب',
    'الميم': 'م',
    'الهاء': 'ه',
    'الخاء': 'خ',
    'القاف': 'ق',
    'الغين': 'غ',
    'الحاء': 'ح',
    'الواو': 'و',
    'الياء': 'ي',
    'الألف': 'ا',
    'الهمزة': 'ء',
}

def parse_meta(meta_str):
    """Parse meta JSON string."""
    if isinstance(meta_str, dict):
        return meta_str
    try:
        return json.loads(meta_str)
    except:
        return {}

def extract_root_from_header(header):
    """
    Convert letter name header to root.
    "العين والكاف" → "عك"
    "العين والهاء والقاف" → "عهق"
    "باب العين والكاف" → "عك"
    """
    # Remove ALL brackets and "باب" prefix
    header = re.sub(r'[\[\]]', '', header)
    header = re.sub(r'^باب\s+', '', header)

    # Split by "و" and extract letter names
    parts = re.split(r'\s+و', header)

    root = ""
    for part in parts:
        part = part.strip()
        # Find matching letter name
        for name, letter in LETTER_MAP.items():
            if name in part or part == name:
                root += letter
                break

    return root if len(root) >= 2 else None

def is_root_header(heading):
    """Check if heading is a root definition (letter combination)."""
    if not heading:
        return False
    # Skip general section headers
    if 'حرف' in heading and 'وال' not in heading:
        return False
    if 'مقدمة' in heading:
        return False
    # Skip chapter type headers that don't have letter combos
    if heading in ['باب المضاعف', 'باب الثلاثي الصحيح', 'باب الثلاثي المعتل', 'باب اللفيف', 'باب الرباعي']:
        return False
    # Should have at least two letter names connected by و
    if 'وال' in heading or ' و' in heading:
        # Check if it contains letter names
        for name in LETTER_MAP.keys():
            if name in heading:
                return True
    return False

def inline_footnotes(text):
    """
    Replace footnote references (^٢٣) with inline [[footnote content]].
    """
    separator_match = re.search(r'_____+\n', text)
    if not separator_match:
        return re.sub(r'\s*\(\^[٠-٩]+\)', '', text)

    main_text = text[:separator_match.start()]
    footnote_section = text[separator_match.end():]

    footnotes = {}
    footnote_pattern = r'\(\^([٠-٩]+)\)\s*([^(]+?)(?=\(\^[٠-٩]+\)|$)'
    for match in re.finditer(footnote_pattern, footnote_section, re.DOTALL):
        num = match.group(1)
        content = match.group(2).strip()
        content = re.sub(r'\s+', ' ', content)
        footnotes[num] = content

    def replace_ref(match):
        num = match.group(1)
        if num in footnotes:
            return f' [[{footnotes[num]}]]'
        return ''

    main_text = re.sub(r'\s*\(\^([٠-٩]+)\)', replace_ref, main_text)
    return main_text

def clean_text(text):
    """Remove HTML tags, inline footnotes, and clean text."""
    text = re.sub(r'<span[^>]*>', '', text)
    text = re.sub(r'</span>', '', text)
    text = inline_footnotes(text)
    return text.strip()

def strip_diacritics(text):
    """Remove Arabic diacritics (tashkeel)."""
    # Arabic diacritics: fatha, damma, kasra, shadda, sukun, tanwin, etc.
    diacritics = re.compile(r'[\u064B-\u065F\u0670]')
    return diacritics.sub('', text)

def split_text_at_header(text, header):
    """
    Split page text at the root header.
    Returns (text_before, text_after) - text before goes to previous root, after to new root.
    """
    # Clean the header for matching (remove brackets)
    clean_header = re.sub(r'[\[\]]', '', header)

    # Try exact matches first
    simple_patterns = [
        clean_header,
        header,
        header.strip('[]'),
    ]

    for pat in simple_patterns:
        if pat in text:
            idx = text.find(pat)
            return text[:idx], text[idx:]

    # Try matching without diacritics
    # Build a regex that matches each letter with optional diacritics between
    stripped_header = strip_diacritics(clean_header)
    # Create pattern: each char can be followed by optional diacritics
    diacritic_class = '[\u064B-\u065F\u0670]*'
    pattern_parts = []
    for char in stripped_header:
        if char.isspace():
            pattern_parts.append(r'\s+')
        else:
            pattern_parts.append(re.escape(char) + diacritic_class)
    flex_pattern = ''.join(pattern_parts)

    match = re.search(flex_pattern, text)
    if match:
        return text[:match.start()], text[match.start():]

    # Couldn't find header - return all text as "after"
    return "", text

def main():
    print(f"Loading {INPUT_FILE}...")

    if not os.path.exists(INPUT_FILE):
        print(f"Error: {INPUT_FILE} not found.")
        return

    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        pages = json.load(f)

    print(f"Loaded {len(pages)} pages")

    # Extract roots based on headings
    roots_data = {}
    current_root = None
    current_texts = []

    book_name = None
    author_name = None

    skipped = 0

    for page in sorted(pages, key=lambda x: x['page']):
        meta = parse_meta(page.get('meta', {}))
        text = page.get('text', '')
        headings = meta.get('headings', [])

        if not book_name and meta.get('book_name'):
            book_name = meta['book_name']
            author_name = meta.get('author_name', '')

        # Find root header in headings (usually the last specific one)
        new_root = None
        matched_header = None
        for h in reversed(headings):
            if is_root_header(h):
                new_root = extract_root_from_header(h)
                if new_root:
                    matched_header = h
                    break

        if new_root:
            # Split page text at the header
            text_before, text_after = split_text_at_header(text, matched_header)

            # Add text before header to previous root
            if current_root and text_before:
                current_texts.append(clean_text(text_before))

            # Save previous root
            if current_root and current_texts:
                full_text = "\n\n".join(current_texts)
                if current_root in roots_data:
                    roots_data[current_root] += "\n\n" + full_text
                else:
                    roots_data[current_root] = full_text

            current_root = new_root
            current_texts = [clean_text(text_after)] if text_after else []
        else:
            # Continue with current root
            if current_root and text:
                current_texts.append(clean_text(text))
            elif not current_root:
                skipped += 1

    # Save last root
    if current_root and current_texts:
        full_text = "\n\n".join(current_texts)
        if current_root in roots_data:
            roots_data[current_root] += "\n\n" + full_text
        else:
            roots_data[current_root] = full_text

    print(f"\nStats:")
    print(f"  Pages skipped (no root): {skipped}")
    print(f"  Roots extracted: {len(roots_data)}")

    # Create output
    output = {
        "name": book_name or "المحيط في اللغة",
        "description": "تأليف: الصاحب إسماعيل بن عباد (٣٢٦-٣٨٥ هـ) | تحقيق: محمد حسن آل ياسين | عالم الكتب",
        "type": "lo3awi",
        "data": roots_data
    }

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print(f"\nSaving to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Done!")

    # Show samples
    print("\n" + "="*60)
    print("Sample entries:")
    print("="*60)
    for root, definition in list(roots_data.items())[:10]:
        preview = definition[:100].replace('\n', ' ')
        print(f"\n[{root}] ({len(definition)} chars)")
        print(f"  {preview}...")

if __name__ == '__main__':
    main()
