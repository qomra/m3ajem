#!/usr/bin/env python3
"""
Add first occurrence position data to index-optimized.json

This script modifies the index file to include character positions where each word
first appears in its definition, enabling sorting by text occurrence order.
"""

import gzip
import json
import re
from typing import Dict, List
from multiprocessing import Pool, cpu_count

def remove_diacritics(text: str) -> str:
    """Remove Arabic diacritics from text."""
    # Unicode range for Arabic diacritics
    return re.sub(r'[\u064B-\u065F\u0670]', '', text)

def escape_regex(s: str) -> str:
    """Escape special regex characters."""
    return re.escape(s)

def generate_variants(word: str) -> List[str]:
    """Generate all possible variants of a word with prefixes."""
    variants = [word]

    # حروف الجر prefixes
    prefixes = ['ب', 'و', 'ك', 'ف', 'ل']
    for prefix in prefixes:
        variants.append(prefix + word)

    # Handle ال prefix variants
    if word.startswith('ال'):
        without_al = word[2:]
        variants.append('لل' + without_al)
        variants.append('وب' + without_al)
        variants.append('وك' + without_al)
        variants.append('وس' + without_al)
        variants.append('فل' + without_al)
        variants.append('لك' + without_al)
        variants.append('ول' + without_al)

    # Handle أ/ا prefix variants
    if word.startswith('أ') or word.startswith('ا'):
        without_hamza = word[1:]
        variants.append('وس' + without_hamza)

    return variants

def does_word_match(target_word: str, text_word: str) -> bool:
    """
    Check if text_word matches target_word according to our rules.

    Rules:
    1. Exact match (preserving diacritics on core word)
    2. Match after stripping حرف جر (ب و ك ف ل) - ignore diacritics on prefix only
    3. Match لل → ال conversion (ignore diacritics on prefix)
    4. Match وب/وك/وس → ال/أ conversions (ignore diacritics on prefix)

    Rule #7: الشَّخْزُ ≠ الشَّخْزِ - diacritics on core word MUST match!
    """
    # Remove punctuation from text_word (: ؛ ، .)
    text_word = text_word.rstrip(':؛،.')

    # Rule 1: Exact match
    if text_word == target_word:
        return True

    # Rule 2: Match with حرف جر prefix (ignore diacritics on prefix only)
    حروف_الجر = ['ب', 'و', 'ك', 'ف', 'ل']
    for حرف in حروف_الجر:
        # Check if text_word starts with حرف (with optional diacritics)
        if len(text_word) > 1:
            # Remove diacritics from first character
            first_char_no_diac = remove_diacritics(text_word[0])
            if first_char_no_diac == حرف:
                # Get the rest of the word (preserving diacritics)
                rest_of_word = text_word[1:]
                # Also skip any diacritics after the prefix
                while rest_of_word and rest_of_word[0] in '\u064B\u064C\u064D\u064E\u064F\u0650\u0651\u0652\u0653\u0654\u0655\u0656\u0657\u0658\u0659\u065A\u065B\u065C\u065D\u065E\u065F\u0670':
                    rest_of_word = rest_of_word[1:]

                if rest_of_word == target_word:
                    return True

    # Rule 3: لل → ال conversion
    if len(text_word) > 2 and remove_diacritics(text_word[:2]) == 'لل':
        # Strip first ل (with diacritics)
        rest = text_word[1:]
        # Skip diacritics after first ل
        while rest and rest[0] in '\u064B\u064C\u064D\u064E\u064F\u0650\u0651\u0652\u0653\u0654\u0655\u0656\u0657\u0658\u0659\u065A\u065B\u065C\u065D\u065E\u065F\u0670':
            rest = rest[1:]
        # Now check if rest matches target_word starting with ال
        if target_word.startswith('ال') and rest[1:] == target_word[2:]:
            # Second char should be ل (ignore diacritics)
            if remove_diacritics(rest[0]) == 'ل':
                return True

    # Rule 4: وب/وك/وس → ال/أ/ا conversions
    special_prefixes = ['وب', 'وك', 'وس']
    for prefix in special_prefixes:
        if len(text_word) > 2 and remove_diacritics(text_word[:2]) == prefix:
            # Strip the prefix (with diacritics)
            rest = text_word[2:]
            # Skip diacritics after prefix
            while rest and rest[0] in '\u064B\u064C\u064D\u064E\u064F\u0650\u0651\u0652\u0653\u0654\u0655\u0656\u0657\u0658\u0659\u065A\u065B\u065C\u065D\u065E\u065F\u0670':
                rest = rest[1:]

            # Check if target starts with ال and rest matches
            if target_word.startswith('ال') and rest == target_word[2:]:
                return True
            # Check if target starts with أ or ا and rest matches
            if (target_word.startswith('أ') or target_word.startswith('ا')) and rest == target_word[1:]:
                return True

    return False

def find_all_occurrences(target_word: str, text: str) -> list:
    """
    Find ALL occurrence positions of target_word in text.
    Loop through text word by word and apply matching logic.

    Returns: List of positions where the word appears

    Rule #7: الشَّخْزُ ≠ الشَّخْزِ - diacritics on core word must match exactly!
    """
    positions = []

    # Track character position as we go through the text
    char_position = 0

    # Split text into words while tracking positions
    current_word = ''

    for i, char in enumerate(text):
        # Check if we're at a word boundary (space or punctuation)
        if char in ' :؛،.\n\t':
            if current_word:
                # Check if this word matches our target
                if does_word_match(target_word, current_word):
                    # Add this position to our list
                    positions.append(char_position)

                # Move past this word
                current_word = ''
                char_position = i + 1
            else:
                char_position = i + 1
        else:
            # Add character to current word
            if not current_word:
                char_position = i
            current_word += char

    # Check the last word
    if current_word and does_word_match(target_word, current_word):
        positions.append(char_position)

    return positions

def load_gzipped_json(filepath: str):
    """Load and parse a gzipped JSON file."""
    print(f"Loading {filepath}...")
    with gzip.open(filepath, 'rt', encoding='utf-8') as f:
        return json.load(f)

def save_gzipped_json(filepath: str, data):
    """Save data as a gzipped JSON file."""
    print(f"Saving {filepath}...")
    with gzip.open(filepath, 'wt', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))

def process_root(args):
    """Process a single root - used for parallel processing."""
    root, word_list, definition = args

    # Find positions for each word
    word_data_list = []

    # Handle both old format (list of strings) and new format (list of dicts)
    for item in word_list:
        if isinstance(item, dict):
            word = item['word']
        else:
            word = item

        # Find ALL occurrences of this word
        all_positions = find_all_occurrences(word, definition)

        # First position for sorting (or 999999 if not found)
        first_position = all_positions[0] if all_positions else 999999

        word_data_list.append({
            'word': word,
            'first_position': first_position,
            'positions': all_positions
        })

    # Sort words by first_position
    word_data_list.sort(key=lambda x: x['first_position'])

    return (root, word_data_list)

def add_positions_to_index(index_data: Dict, dictionaries: List[Dict]) -> Dict:
    """
    Add position information to index data.

    Transforms from:
        {"dict_name": {"root": ["word1", "word2"]}}
    To:
        {"dict_name": {"root": [
            {"word": "word1", "first_position": 0, "positions": [0, 150, 300]},
            {"word": "word2", "first_position": 50, "positions": [50, 200]}
        ]}}
    """
    # Create a dict lookup for faster dictionary access
    dict_lookup = {d['name']: d['data'] for d in dictionaries}

    new_index = {}
    total_roots = sum(len(roots) for roots in index_data.values())
    processed_roots = 0

    for dict_name, roots_data in index_data.items():
        print(f"\nProcessing dictionary: {dict_name}")
        new_index[dict_name] = {}

        dictionary_data = dict_lookup.get(dict_name, {})

        # Prepare tasks for parallel processing
        tasks = []
        for root, word_list in roots_data.items():
            definition = dictionary_data.get(root, '')
            tasks.append((root, word_list, definition))

        # Process in parallel using all CPU cores
        num_workers = cpu_count()
        print(f"  Using {num_workers} parallel workers...")

        with Pool(num_workers) as pool:
            results = pool.map(process_root, tasks)

        # Store results
        for root, word_data_list in results:
            new_index[dict_name][root] = word_data_list

        processed_roots += len(results)
        print(f"  Processed {len(results)} roots")

    print(f"\n✓ Processed all {total_roots} roots")
    return new_index

def main():
    """Main execution."""
    print("=" * 60)
    print("Adding Position Data to Index")
    print("=" * 60)

    # Load the compressed data files
    index_path = 'optimized/index-optimized.json.gz'
    maajem_path = 'optimized/maajem-optimized.json.gz'
    output_path = 'optimized/index-optimized.json.gz'

    print("\n[1/4] Loading index data...")
    index_data = load_gzipped_json(index_path)

    print("[2/4] Loading dictionary data...")
    dictionaries = load_gzipped_json(maajem_path)

    print("[3/4] Adding position information...")
    new_index = add_positions_to_index(index_data, dictionaries)

    print("[4/4] Saving updated index...")
    save_gzipped_json(output_path, new_index)

    print("\n" + "=" * 60)
    print("✓ Complete! Updated index saved to:", output_path)
    print("=" * 60)

if __name__ == '__main__':
    main()
