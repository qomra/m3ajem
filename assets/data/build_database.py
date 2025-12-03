#!/usr/bin/env python3
"""
Consolidated Database Build Script
==================================
Merges dictionary data from multiple sources and builds SQLite database.

Workflow:
    1. Load lo3awi (traditional) dictionaries from ommat.json (15 dictionaries)
    2. Merge mofahras resources (لسان العرب full text) with ommat
    3. Load moraqman (AI-digitized) dictionaries from converted files
    4. Calculate word positions using dataset.json (skip unmatched words)
    5. Build optimized SQLite database

Usage:
    python build_database.py              # Full rebuild
    python build_database.py --moraqman   # Only rebuild moraqman dictionaries

Input files:
    - maajim/lo3awi/ommat.json: Traditional dictionaries (15)
    - maajim/mofahras/resources.json: لسان العرب full text (9,344 roots)
    - maajim/mofahras/dataset.json: Word lists for لسان العرب
    - maajim/moraqman/*/[dict_name].json: AI-digitized dictionaries (10)

Output files:
    - database/dictionary.db: SQLite database (shipped with app)
"""
import argparse

import json
import sqlite3
import os
import re
import glob
from typing import Dict, List
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

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
    # Moraqman dictionaries (default to root_simple for now)
    'معجم المصطلحات الميكانيكية': 'root_simple',
    'معجم المصطلحات الطبية': 'root_simple',
    'معجم أسماء النبات': 'root_simple',
    'معجم المصطلحات الزراعية': 'root_simple',
    'معجم المصطلحات الفيزيائية': 'root_simple',
    'معجم مصطلحات البلاغة': 'root_simple',
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
    """
    Find ALL occurrence positions of target_word in text.
    SKIP words that don't match using does_word_match().
    """
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
    for word in word_list:
        # Find ALL occurrences of this word
        all_positions = find_all_occurrences(word, definition)

        # SKIP words that don't match (no positions found)
        if not all_positions:
            continue

        first_position = all_positions[0]

        word_data_list.append({
            'word': word,
            'first_position': first_position,
            'positions': all_positions
        })

    # Sort by first position
    word_data_list.sort(key=lambda x: x['first_position'])
    return (root, word_data_list)

def calculate_positions_for_roots(dict_name: str, roots_data: Dict, word_lists: Dict) -> Dict:
    """
    Calculate word positions for roots using word lists from dataset.json.

    Args:
        dict_name: Dictionary name (e.g., 'لسان العرب')
        roots_data: Dict of {root: definition}
        word_lists: Dict of {root: [word1, word2, ...]}

    Returns:
        Dict of {root: [{word, first_position, positions}, ...]}
    """
    print(f"\n[Position Calculation] Processing {dict_name}...")

    # Prepare tasks for parallel processing
    tasks = []
    for root, definition in roots_data.items():
        if not definition:
            continue

        # Check if we have word list for this root
        if root in word_lists:
            word_list = word_lists[root]
            tasks.append((root, word_list, definition))

    if not tasks:
        print(f"  No roots to process positions for")
        return {}

    print(f"  Found {len(tasks)} roots with word lists")

    # Process in parallel with ThreadPoolExecutor
    # Use fewer workers to be conservative and avoid overwhelming the system
    num_workers = min(8, len(tasks))
    print(f"  Using {num_workers} thread workers...")

    results = []
    with ThreadPoolExecutor(max_workers=num_workers) as executor:
        # Submit all tasks
        future_to_task = {executor.submit(process_root_positions, task): i for i, task in enumerate(tasks)}

        # Process results as they complete
        completed_count = 0
        for future in as_completed(future_to_task):
            task_idx = future_to_task[future]
            try:
                result = future.result()
                results.append(result)
                completed_count += 1
                if completed_count % 500 == 0:
                    print(f"    Progress: {completed_count}/{len(tasks)} roots ({100*completed_count/len(tasks):.1f}%)")
            except Exception as e:
                print(f"    Error processing root at index {task_idx}: {e}")

    print(f"    Progress: {len(results)}/{len(tasks)} roots (100.0%)")

    # Build index dictionary
    index_data = {}
    roots_with_words = 0
    for root, word_data_list in results:
        if word_data_list:  # Only include roots that have at least one matched word
            index_data[root] = word_data_list
            roots_with_words += 1

    print(f"  ✓ Calculated positions for {roots_with_words} roots")
    return index_data

def load_json(filepath: str):
    """Load and parse a JSON file."""
    print(f"Loading {filepath}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def load_dictionaries() -> List[Dict]:
    """
    Load all dictionaries from various sources:
    1. Traditional dictionaries from ommat.json
    2. Mofahras data (لسان العرب full text)
    3. Moraqman dictionaries (AI-digitized)

    Returns:
        List of dictionaries with structure: {name, description, type, data}
    """
    print("\n[1/5] Loading dictionaries...")

    base_dir = 'maajim'

    # Load traditional dictionaries
    ommat_path = os.path.join(base_dir, 'lo3awi', 'ommat.json')
    ommat = load_json(ommat_path)
    print(f"  ✓ Loaded {len(ommat)} traditional dictionaries from ommat.json")

    # Add type field to traditional dictionaries
    for dictionary in ommat:
        dictionary['type'] = 'lo3awi'

    # Load mofahras resources (لسان العرب full text)
    mofahras_resources_path = os.path.join(base_dir, 'mofahras', 'resources.json')
    mofahras_resources = load_json(mofahras_resources_path)
    print(f"  ✓ Loaded mofahras resources: {len(mofahras_resources.get('data', {}))} roots")

    # Merge mofahras data with لسان العرب in ommat
    لسان_dict = None
    for i, dictionary in enumerate(ommat):
        if dictionary['name'] == 'لسان العرب':
            لسان_dict = dictionary
            لسان_index = i
            break

    if لسان_dict:
        original_count = len(لسان_dict['data'])
        # REPLACE entire لسان العرب data with mofahras resources
        لسان_dict['data'] = mofahras_resources.get('data', {})
        ommat[لسان_index] = لسان_dict
        print(f"  ✓ Merged mofahras into لسان العرب: {original_count} → {len(لسان_dict['data'])} roots")
    else:
        print(f"  ⚠️ Warning: لسان العرب not found in ommat.json")

    # Load moraqman dictionaries
    moraqman_base = os.path.join(base_dir, 'moraqman')
    moraqman_files = glob.glob(os.path.join(moraqman_base, '*', '*.json'))

    moraqman_dicts = []
    for filepath in moraqman_files:
        # Skip source files (keep only converted files)
        filename = os.path.basename(filepath)
        if filename in ['arabic_english_book.json', 'arabic_english_output.json', 'checkpoint.json', 'book_1.json', 'book_2.json']:
            continue

        try:
            dictionary = load_json(filepath)
            # Verify it has the expected structure
            if 'name' in dictionary and 'data' in dictionary and 'type' in dictionary:
                moraqman_dicts.append(dictionary)
                print(f"  ✓ Loaded moraqman: {dictionary['name']} ({len(dictionary['data'])} entries)")
        except Exception as e:
            print(f"  ⚠️ Error loading {filepath}: {e}")

    print(f"  ✓ Loaded {len(moraqman_dicts)} moraqman dictionaries")

    # Combine all dictionaries
    all_dicts = ommat + moraqman_dicts
    print(f"\n  Total dictionaries: {len(all_dicts)}")
    print(f"    - Lo3awi (traditional): {len(ommat)}")
    print(f"    - Moraqman (AI-digitized): {len(moraqman_dicts)}")

    return all_dicts

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
            description TEXT NOT NULL DEFAULT '',
            indexing_pattern TEXT NOT NULL,
            type TEXT NOT NULL
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

def populate_database(conn: sqlite3.Connection, all_dicts: List[Dict], index_data: Dict):
    """Populate database with dictionary and index data."""
    cursor = conn.cursor()

    print("\n[3/5] Populating database...")

    # Track progress
    total_indexed_roots = sum(len(roots) for roots in index_data.values())
    processed_roots = 0
    total_unindexed_roots = 0
    total_all_roots = 0

    # Insert dictionaries and their data
    for dictionary in all_dicts:
        dict_name = dictionary['name']
        dict_type = dictionary.get('type', 'lo3awi')
        print(f"\n  Processing dictionary: {dict_name} ({dict_type})")

        # Insert dictionary with indexing pattern, type, and description
        indexing_pattern = INDEXING_PATTERNS.get(dict_name, 'root_simple')  # Default to root_simple
        description = dictionary.get('description', '')
        cursor.execute('INSERT INTO dictionaries (name, description, indexing_pattern, type) VALUES (?, ?, ?, ?)',
                      (dict_name, description, indexing_pattern, dict_type))
        dict_id = cursor.lastrowid

        # Get index data for this dictionary (only لسان العرب has index data currently)
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
        SELECT d.name, d.type, COUNT(r.id) as root_count
        FROM dictionaries d
        LEFT JOIN roots r ON d.id = r.dictionary_id
        GROUP BY d.id, d.name, d.type
        ORDER BY d.type, d.name
    ''')
    dict_stats = cursor.fetchall()

    print("\n[5/5] Database Statistics:")
    print("=" * 80)
    print(f"Total Dictionaries: {dict_count}")
    print(f"Total Roots: {root_count}")
    print(f"Total Words (indexed): {word_count}")
    print("\nPer-Dictionary Stats:")

    current_type = None
    for name, dict_type, count in dict_stats:
        if current_type != dict_type:
            current_type = dict_type
            print(f"\n  {dict_type.upper()}:")
        print(f"    {name}: {count:,} roots")
    print("=" * 80)

def load_moraqman_only() -> List[Dict]:
    """Load only moraqman dictionaries."""
    print("\n[1/3] Loading moraqman dictionaries...")

    base_dir = 'maajim'
    moraqman_base = os.path.join(base_dir, 'moraqman')
    moraqman_files = glob.glob(os.path.join(moraqman_base, '*', '*.json'))

    moraqman_dicts = []
    for filepath in moraqman_files:
        # Skip source files (keep only converted files)
        filename = os.path.basename(filepath)
        if filename in ['arabic_english_book.json', 'arabic_english_output.json', 'checkpoint.json', 'book_1.json', 'book_2.json']:
            continue

        try:
            dictionary = load_json(filepath)
            # Verify it has the expected structure
            if 'name' in dictionary and 'data' in dictionary and 'type' in dictionary:
                moraqman_dicts.append(dictionary)
                print(f"  ✓ Loaded: {dictionary['name']} ({len(dictionary['data'])} entries)")
        except Exception as e:
            print(f"  ⚠️ Error loading {filepath}: {e}")

    print(f"\n  Total moraqman dictionaries: {len(moraqman_dicts)}")
    return moraqman_dicts


def rebuild_moraqman(db_path: str, moraqman_dicts: List[Dict]):
    """Rebuild only moraqman dictionaries in existing database."""
    print(f"\n[2/3] Rebuilding moraqman in {db_path}...")

    if not os.path.exists(db_path):
        print(f"ERROR: Database {db_path} not found! Run full build first.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Check if description column exists, add if not
    cursor.execute("PRAGMA table_info(dictionaries)")
    columns = [col[1] for col in cursor.fetchall()]
    if 'description' not in columns:
        print("  Adding description column to dictionaries table...")
        cursor.execute("ALTER TABLE dictionaries ADD COLUMN description TEXT NOT NULL DEFAULT ''")
        conn.commit()

    # Delete existing moraqman dictionaries and their roots/words
    print("  Deleting existing moraqman data...")
    cursor.execute('''
        DELETE FROM words WHERE root_id IN (
            SELECT r.id FROM roots r
            JOIN dictionaries d ON r.dictionary_id = d.id
            WHERE d.type = 'moraqman'
        )
    ''')
    cursor.execute('''
        DELETE FROM roots WHERE dictionary_id IN (
            SELECT id FROM dictionaries WHERE type = 'moraqman'
        )
    ''')
    cursor.execute("DELETE FROM dictionaries WHERE type = 'moraqman'")
    conn.commit()
    print("  ✓ Existing moraqman data deleted")

    # Insert new moraqman dictionaries
    print("  Inserting new moraqman dictionaries...")
    for dictionary in moraqman_dicts:
        dict_name = dictionary['name']
        dict_type = dictionary.get('type', 'moraqman')
        description = dictionary.get('description', '')
        indexing_pattern = INDEXING_PATTERNS.get(dict_name, 'root_simple')

        cursor.execute(
            'INSERT INTO dictionaries (name, description, indexing_pattern, type) VALUES (?, ?, ?, ?)',
            (dict_name, description, indexing_pattern, dict_type)
        )
        dict_id = cursor.lastrowid

        # Insert roots
        root_count = 0
        for root, definition in dictionary['data'].items():
            if not definition:
                continue
            cursor.execute(
                'INSERT INTO roots (dictionary_id, root, definition, first_word_position) VALUES (?, ?, ?, ?)',
                (dict_id, root, definition, -1)
            )
            root_count += 1

        print(f"    ✓ {dict_name}: {root_count} roots")

    conn.commit()

    # Optimize
    print("\n[3/3] Optimizing database...")
    cursor.execute('ANALYZE')
    cursor.execute('VACUUM')
    conn.commit()
    print("  ✓ Database optimized")

    # Print moraqman stats
    cursor.execute('''
        SELECT d.name, COUNT(r.id) as root_count
        FROM dictionaries d
        LEFT JOIN roots r ON d.id = r.dictionary_id
        WHERE d.type = 'moraqman'
        GROUP BY d.id, d.name
        ORDER BY d.name
    ''')
    stats = cursor.fetchall()

    print("\nMoraqman Dictionary Stats:")
    print("=" * 50)
    for name, count in stats:
        print(f"  {name}: {count:,} roots")
    print("=" * 50)

    conn.close()


def main():
    """Main execution."""
    parser = argparse.ArgumentParser(description='Build M3ajem database')
    parser.add_argument('--moraqman', action='store_true', help='Only rebuild moraqman dictionaries')
    args = parser.parse_args()

    print("=" * 80)
    print("M3AJEM DATABASE BUILD SCRIPT")
    if args.moraqman:
        print("MODE: Moraqman only")
    print("=" * 80)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

    # Paths
    db_path = 'database/dictionary.db'

    if args.moraqman:
        # Moraqman-only rebuild
        moraqman_dicts = load_moraqman_only()
        rebuild_moraqman(db_path, moraqman_dicts)
    else:
        # Full rebuild
        mofahras_dataset_path = 'maajim/mofahras/dataset.json'

        # Validate mofahras dataset
        if not os.path.exists(mofahras_dataset_path):
            print(f"ERROR: {mofahras_dataset_path} not found!")
            return

        # Load all dictionaries (lo3awi + mofahras + moraqman)
        all_dicts = load_dictionaries()

        # Load word lists for لسان العرب
        dataset = load_json(mofahras_dataset_path)
        لسان_word_lists = dataset.get('لسان العرب', {})
        print(f"  ✓ Loaded word lists for {len(لسان_word_lists)} roots")

        # Calculate positions for لسان العرب
        لسان_dict = None
        for dictionary in all_dicts:
            if dictionary['name'] == 'لسان العرب':
                لسان_dict = dictionary
                break

        index_data = {}
        if لسان_dict and لسان_word_lists:
            لسان_index = calculate_positions_for_roots('لسان العرب', لسان_dict['data'], لسان_word_lists)
            index_data['لسان العرب'] = لسان_index

        # Create and populate database
        conn = create_database(db_path)
        populate_database(conn, all_dicts, index_data)

        # Optimize
        optimize_database(conn)

        # Print stats
        print_stats(conn)

        conn.close()

    # Get file size
    db_size_mb = os.path.getsize(db_path) / (1024 * 1024)
    print(f"\nDatabase file size: {db_size_mb:.2f} MB")

    print("\n" + "=" * 80)
    print(f"✓ Complete! Database saved to: {db_path}")
    print(f"Finished at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)

if __name__ == '__main__':
    main()
