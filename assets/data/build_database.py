#!/usr/bin/env python3
"""
Consolidated Database Build Script
==================================
Merges new لسان العرب resources with existing data, calculates positions,
and builds SQLite database.

Workflow:
    1. Merge new definitions from new_resources.json into maajim.json
    2. Calculate word positions for new roots using word lists from dataset.json
    3. Save updated maajim.json and dataset.json
    4. Build optimized SQLite database

Usage:
    python build_database.py

Input files:
    - optimized/maajim.json: Existing dictionary data (all 14 dictionaries)
    - optimized/new_resources.json: New لسان العرب roots to merge {root: {text: definition}}
    - optimized/dataset.json: Index data with word lists for لسان العرب

Output files:
    - optimized/maajim.json: Updated with merged definitions
    - optimized/dataset.json: Updated with calculated positions for new roots
    - optimized/dictionary.db: SQLite database (shipped with app)

Note: Keep updating new_resources.json and dataset.json with new roots/word lists,
      then run this script to merge and rebuild the database.
"""

import json
import sqlite3
import os
import re
from typing import Dict, List
from datetime import datetime
from multiprocessing import Pool, cpu_count

# Dictionary indexing patterns
# Maps dictionary name to its indexing method
INDEXING_PATTERNS = {
    'الصّحّاح في اللغة': 'root_simple',
    'لسان العرب': 'root_simple',
    'المعجم الوسيط': 'word_full',
    'القاموس المحيط': 'word_with_al',
    'مقاييس اللغة': 'root_simple',
    'العباب الزاخر': 'root_simple',
    'المصباح المنير': 'root_spaced',
    'جمهرة اللغة': 'root_dashed',
    'الدخيل في العربية': 'word_full',
    'اللغة العربية المعاصرة': 'root_spaced',
    'معجم الملابس': 'word_full',
    'معجم المغني': 'root_bracketed',
    'معجم المصطلحات والألفاظ الفقهية': 'word_full',
    'معجم الرائد': 'mixed',
}

def remove_diacritics(text: str) -> str:
    """Remove Arabic diacritics from text."""
    return re.sub(r'[\u064B-\u065F\u0670]', '', text)

def does_word_match(target_word: str, text_word: str) -> bool:
    """
    Check if text_word matches target_word with prefix handling.
    Matches exact word or with حروف الجر prefixes (ب و ك ف ل).
    """
    # Remove punctuation from text_word
    text_word = text_word.rstrip(':؛،.')

    # Exact match
    if text_word == target_word:
        return True

    # Match with حرف جر prefix
    حروف_الجر = ['ب', 'و', 'ك', 'ف', 'ل']
    for حرف in حروف_الجر:
        if len(text_word) > 1:
            first_char_no_diac = remove_diacritics(text_word[0])
            if first_char_no_diac == حرف:
                rest_of_word = text_word[1:]
                # Skip diacritics after prefix
                while rest_of_word and rest_of_word[0] in '\u064B\u064C\u064D\u064E\u064F\u0650\u0651\u0652\u0653\u0654\u0655\u0656\u0657\u0658\u0659\u065A\u065B\u065C\u065D\u065E\u065F\u0670':
                    rest_of_word = rest_of_word[1:]
                if rest_of_word == target_word:
                    return True

    # لل → ال conversion
    if len(text_word) > 2 and remove_diacritics(text_word[:2]) == 'لل':
        rest = text_word[1:]
        while rest and rest[0] in '\u064B\u064C\u064D\u064E\u064F\u0650\u0651\u0652\u0653\u0654\u0655\u0656\u0657\u0658\u0659\u065A\u065B\u065C\u065D\u065E\u065F\u0670':
            rest = rest[1:]
        if target_word.startswith('ال') and rest[1:] == target_word[2:]:
            if remove_diacritics(rest[0]) == 'ل':
                return True

    # وب/وك/وس → ال/أ/ا conversions
    special_prefixes = ['وب', 'وك', 'وس']
    for prefix in special_prefixes:
        if len(text_word) > 2 and remove_diacritics(text_word[:2]) == prefix:
            rest = text_word[2:]
            while rest and rest[0] in '\u064B\u064C\u064D\u064E\u064F\u0650\u0651\u0652\u0653\u0654\u0655\u0656\u0657\u0658\u0659\u065A\u065B\u065C\u065D\u065E\u065F\u0670':
                rest = rest[1:]
            if target_word.startswith('ال') and rest == target_word[2:]:
                return True
            if (target_word.startswith('أ') or target_word.startswith('ا')) and rest == target_word[1:]:
                return True

    return False

def find_all_occurrences(target_word: str, text: str) -> list:
    """Find ALL occurrence positions of target_word in text."""
    positions = []
    char_position = 0
    current_word = ''

    for i, char in enumerate(text):
        if char in ' :؛،.\n\t':
            if current_word and does_word_match(target_word, current_word):
                positions.append(char_position)
            current_word = ''
            char_position = i + 1
        else:
            if not current_word:
                char_position = i
            current_word += char

    # Check last word
    if current_word and does_word_match(target_word, current_word):
        positions.append(char_position)

    return positions

def process_root_positions(args):
    """Process a single root to calculate word positions - for parallel processing."""
    root, word_list, definition = args

    word_data_list = []
    for item in word_list:
        # Handle both string format and dict format
        word = item['word'] if isinstance(item, dict) else item

        # Find ALL occurrences of this word
        all_positions = find_all_occurrences(word, definition)
        first_position = all_positions[0] if all_positions else 999999

        word_data_list.append({
            'word': word,
            'first_position': first_position,
            'positions': all_positions
        })

    # Sort by first position
    word_data_list.sort(key=lambda x: x['first_position'])
    return (root, word_data_list)

def calculate_positions_for_new_roots(new_resources: Dict, index_data: Dict) -> Dict:
    """
    Calculate word positions for new roots that have been added.

    Args:
        new_resources: Dict with structure {name: "...", data: {root: definition}}
        index_data: Dict of {dict_name: {root: word_list}}

    Returns:
        Updated index_data with positions calculated for new roots
    """
    print(f"\n[Position Calculation] Processing new roots...")

    # Extract name and data
    dict_name = new_resources.get('name', 'لسان العرب')
    new_roots_data = new_resources.get('data', {})

    dict_index = index_data.get(dict_name, {})
    new_roots_count = 0
    updated_roots_count = 0

    # Prepare tasks for parallel processing
    tasks = []
    new_roots_to_process = []

    for root, definition in new_roots_data.items():
        if not definition:
            continue

        # Check if we have word list for this root in index
        if root in dict_index:
            word_list = dict_index[root]
            # Check if positions are already calculated
            if word_list and isinstance(word_list[0], dict) and 'positions' in word_list[0]:
                # Already has positions, skip
                continue

            tasks.append((root, word_list, definition))
            new_roots_to_process.append(root)
            new_roots_count += 1

    if not tasks:
        print(f"  No new roots to process positions for")
        return index_data

    print(f"  Found {new_roots_count} new roots needing position calculation")

    # Process in parallel
    num_workers = min(cpu_count(), len(tasks))
    print(f"  Using {num_workers} parallel workers...")

    with Pool(num_workers) as pool:
        results = pool.map(process_root_positions, tasks)

    # Update index with calculated positions
    for root, word_data_list in results:
        dict_index[root] = word_data_list
        updated_roots_count += 1

    index_data[dict_name] = dict_index

    print(f"  ✓ Calculated positions for {updated_roots_count} new roots")
    return index_data

def load_json(filepath: str):
    """Load and parse a JSON file."""
    print(f"Loading {filepath}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(data, filepath: str):
    """Save data to JSON file."""
    print(f"Saving {filepath}...")
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def merge_lisan_data(maajim: List[Dict], new_resources: Dict) -> List[Dict]:
    """
    Merge new لسان العرب resources into existing maajim data.

    Args:
        maajim: List of dictionaries (each with 'name' and 'data')
        new_resources: Dict with structure: {name: "...", data: {root: definition}}

    Returns:
        Updated maajim list
    """
    print("\n[1/5] Merging new لسان العرب resources...")

    # Extract name and data from new_resources
    new_dict_name = new_resources.get('name', 'لسان العرب')
    new_roots_data = new_resources.get('data', {})

    # Find لسان العرب dictionary
    lisan_dict = None
    for i, dictionary in enumerate(maajim):
        if dictionary['name'] == new_dict_name:
            lisan_dict = dictionary
            lisan_index = i
            break

    if not lisan_dict:
        print(f"ERROR: {new_dict_name} dictionary not found!")
        return maajim

    # REPLACE entire لسان العرب data with new_resources
    original_count = len(lisan_dict['data'])

    # Filter out empty definitions
    filtered_data = {root: definition for root, definition in new_roots_data.items() if definition}

    # Replace entire data
    lisan_dict['data'] = filtered_data
    maajim[lisan_index] = lisan_dict

    print(f"  ✓ Original roots: {original_count}")
    print(f"  ✓ Replaced with: {len(filtered_data)} roots")
    print(f"  ✓ Total roots now: {len(lisan_dict['data'])}")

    return maajim

def create_database(db_path: str):
    """Create SQLite database with schema."""
    print(f"\n[2/5] Creating database at {db_path}...")

    # Remove existing database
    if os.path.exists(db_path):
        backup_path = f"{db_path}.backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        print(f"  Backing up existing database to {backup_path}")
        os.rename(db_path, backup_path)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Create tables
    cursor.execute('''
        CREATE TABLE dictionaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            indexing_pattern TEXT NOT NULL
        )
    ''')

    cursor.execute('''
        CREATE TABLE roots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dictionary_id INTEGER NOT NULL,
            root TEXT NOT NULL,
            definition TEXT NOT NULL,
            first_word_position INTEGER NOT NULL,
            FOREIGN KEY (dictionary_id) REFERENCES dictionaries(id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE words (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            root_id INTEGER NOT NULL,
            word TEXT NOT NULL,
            first_position INTEGER NOT NULL,
            all_positions TEXT NOT NULL,
            FOREIGN KEY (root_id) REFERENCES roots(id)
        )
    ''')

    # Create indexes for fast queries
    cursor.execute('CREATE INDEX idx_roots_dictionary ON roots(dictionary_id)')
    cursor.execute('CREATE INDEX idx_roots_root ON roots(root)')
    cursor.execute('CREATE INDEX idx_roots_first_position ON roots(first_word_position)')
    cursor.execute('CREATE INDEX idx_words_root ON words(root_id)')
    cursor.execute('CREATE INDEX idx_words_first_position ON words(first_position)')
    cursor.execute('CREATE INDEX idx_words_word ON words(word)')

    conn.commit()
    print("  ✓ Database schema created")

    return conn

def populate_database(conn: sqlite3.Connection, maajim: List[Dict], index_data: Dict):
    """Populate database with dictionary and index data."""
    cursor = conn.cursor()

    print("\n[3/5] Populating database...")

    # Track progress
    total_indexed_roots = sum(len(roots) for roots in index_data.values())
    processed_roots = 0
    total_unindexed_roots = 0
    total_all_roots = 0

    # Insert dictionaries and their data
    for dictionary in maajim:
        dict_name = dictionary['name']
        print(f"\n  Processing dictionary: {dict_name}")

        # Insert dictionary with indexing pattern
        indexing_pattern = INDEXING_PATTERNS.get(dict_name, 'root_simple')  # Default to root_simple
        cursor.execute('INSERT INTO dictionaries (name, indexing_pattern) VALUES (?, ?)', (dict_name, indexing_pattern))
        dict_id = cursor.lastrowid

        # Get index data for this dictionary (only لسان العرب has index data)
        dict_index = index_data.get(dict_name, {})

        # Track which roots we've added
        added_roots = set()

        # STEP 1: Insert indexed roots (roots with word position data)
        if dict_index:
            print(f"    [1/2] Processing indexed roots...")
            for root, word_data_list in dict_index.items():
                # Get definition from dictionary data
                definition = dictionary['data'].get(root, '')

                if not definition:
                    continue  # Skip if no definition

                # Calculate first word position (minimum first_position of all words)
                first_positions = [wd['first_position'] for wd in word_data_list]
                first_position = min(first_positions) if first_positions else 0

                # Insert root
                cursor.execute(
                    'INSERT INTO roots (dictionary_id, root, definition, first_word_position) VALUES (?, ?, ?, ?)',
                    (dict_id, root, definition, first_position)
                )
                root_id = cursor.lastrowid
                added_roots.add(root)

                # Insert words
                for word_data in word_data_list:
                    # Convert positions array to JSON string
                    all_positions_json = json.dumps(word_data['positions'])

                    cursor.execute(
                        'INSERT INTO words (root_id, word, first_position, all_positions) VALUES (?, ?, ?, ?)',
                        (root_id, word_data['word'], word_data['first_position'], all_positions_json)
                    )

                processed_roots += 1
                if processed_roots % 1000 == 0:
                    print(f"      Processed {processed_roots}/{total_indexed_roots} indexed roots ({100*processed_roots/total_indexed_roots:.1f}%)")
                    conn.commit()  # Commit periodically

        # STEP 2: Insert non-indexed roots (roots with definitions but no position data)
        print(f"    [2/2] Processing non-indexed roots...")
        unindexed_count = 0
        for root, definition in dictionary['data'].items():
            if root in added_roots:
                continue  # Already added with index data

            if not definition:
                continue  # Skip if no definition

            # Insert root with position -1 to indicate no index data
            cursor.execute(
                'INSERT INTO roots (dictionary_id, root, definition, first_word_position) VALUES (?, ?, ?, ?)',
                (dict_id, root, definition, -1)
            )

            unindexed_count += 1
            total_unindexed_roots += 1

            if unindexed_count % 1000 == 0:
                print(f"      Added {unindexed_count} non-indexed roots...")
                conn.commit()  # Commit periodically

        dict_total = len(dict_index) + unindexed_count
        total_all_roots += dict_total
        print(f"    ✓ Added {len(dict_index)} indexed + {unindexed_count} non-indexed = {dict_total} total roots")

    # Final commit
    conn.commit()
    print(f"\n  ✓ Processed all roots:")
    print(f"    - Indexed roots: {processed_roots}")
    print(f"    - Non-indexed roots: {total_unindexed_roots}")
    print(f"    - Total: {total_all_roots}")

def optimize_database(conn: sqlite3.Connection):
    """Optimize database for read performance."""
    print("\n[4/5] Optimizing database...")
    cursor = conn.cursor()

    # Analyze tables for query optimization
    cursor.execute('ANALYZE')

    # Vacuum to reclaim space and optimize
    cursor.execute('VACUUM')

    conn.commit()
    print("  ✓ Database optimized")

def print_stats(conn: sqlite3.Connection):
    """Print database statistics."""
    cursor = conn.cursor()

    cursor.execute('SELECT COUNT(*) FROM dictionaries')
    dict_count = cursor.fetchone()[0]

    cursor.execute('SELECT COUNT(*) FROM roots')
    root_count = cursor.fetchone()[0]

    cursor.execute('SELECT COUNT(*) FROM words')
    word_count = cursor.fetchone()[0]

    # Get per-dictionary stats
    cursor.execute('''
        SELECT d.name, COUNT(r.id) as root_count
        FROM dictionaries d
        LEFT JOIN roots r ON d.id = r.dictionary_id
        GROUP BY d.id, d.name
        ORDER BY d.name
    ''')
    dict_stats = cursor.fetchall()

    print("\n[5/5] Database Statistics:")
    print("=" * 60)
    print(f"Total Dictionaries: {dict_count}")
    print(f"Total Roots: {root_count}")
    print(f"Total Words (indexed): {word_count}")
    print("\nPer-Dictionary Stats:")
    for name, count in dict_stats:
        print(f"  {name}: {count:,} roots")
    print("=" * 60)

def main():
    """Main execution."""
    print("=" * 60)
    print("M3AJEM DATABASE BUILD SCRIPT")
    print("=" * 60)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

    # Paths
    base_dir = 'optimized'
    maajim_path = os.path.join(base_dir, 'maajim.json')
    new_resources_path = os.path.join(base_dir, 'new_resources.json')
    index_path = os.path.join(base_dir, 'dataset.json')
    db_path = os.path.join(base_dir, 'dictionary.db')

    # Validate input files
    if not os.path.exists(maajim_path):
        print(f"ERROR: {maajim_path} not found!")
        return

    if not os.path.exists(new_resources_path):
        print(f"ERROR: {new_resources_path} not found!")
        return

    if not os.path.exists(index_path):
        print(f"ERROR: {index_path} not found!")
        return

    # Load data
    maajim = load_json(maajim_path)
    new_resources = load_json(new_resources_path)
    index_data = load_json(index_path)

    # Merge new resources
    maajim = merge_lisan_data(maajim, new_resources)

    # Calculate positions for new roots
    index_data = calculate_positions_for_new_roots(new_resources, index_data)

    # Save merged maajim and updated index
    merged_maajim_path = os.path.join(base_dir, 'maajim.json')
    updated_index_path = os.path.join(base_dir, 'dataset.json')
    save_json(maajim, merged_maajim_path)
    save_json(index_data, updated_index_path)
    print(f"  ✓ Saved merged dictionary and updated index")

    # Create and populate database
    conn = create_database(db_path)
    populate_database(conn, maajim, index_data)

    # Optimize
    optimize_database(conn)

    # Print stats
    print_stats(conn)

    # Get file size
    db_size_mb = os.path.getsize(db_path) / (1024 * 1024)
    print(f"\nDatabase file size: {db_size_mb:.2f} MB")

    conn.close()

    print("\n" + "=" * 60)
    print(f"✓ Complete! Database saved to: {db_path}")
    print(f"Finished at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

if __name__ == '__main__':
    main()
