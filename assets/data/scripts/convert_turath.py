#!/usr/bin/env python3
"""
Convert turath JSON to moraqman dictionary format.
Roots are identified by letter combination headers like "العين والكاف" → "عك"
"""

import os
import json
import re

INPUT_FILE = os.path.join(os.path.dirname(__file__), "turath_book_83.json")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "maajim", "moraqman", "almohit")
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
    # Remove brackets and "باب" prefix
    header = header.strip('[]')
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
        for h in reversed(headings):
            if is_root_header(h):
                new_root = extract_root_from_header(h)
                if new_root:
                    break

        if new_root:
            # Save previous root
            if current_root and current_texts:
                full_text = "\n\n".join(current_texts)
                if current_root in roots_data:
                    roots_data[current_root] += "\n\n" + full_text
                else:
                    roots_data[current_root] = full_text

            current_root = new_root
            current_texts = [clean_text(text)] if text else []
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
        "description": f"تأليف: {author_name}" if author_name else "",
        "type": "moraqman",
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
