#!/usr/bin/env python3
"""
Generate SQLite database from JSON dictionary data.

This creates a properly indexed SQLite database that can be shipped with the app,
eliminating the need for JSON decompression and parsing.
"""

import gzip
import json
import sqlite3
import os
from typing import Dict, List

def load_json_gz(filepath: str):
    """Load and parse a gzipped JSON file."""
    print(f"Loading {filepath}...")
    with gzip.open(filepath, 'rt', encoding='utf-8') as f:
        return json.load(f)

def create_database(db_path: str):
    """Create SQLite database with schema."""
    print(f"\nCreating database at {db_path}...")

    # Remove existing database
    if os.path.exists(db_path):
        os.remove(db_path)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Create tables
    cursor.execute('''
        CREATE TABLE dictionaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
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
    cursor.execute('CREATE INDEX idx_roots_first_position ON roots(first_word_position)')
    cursor.execute('CREATE INDEX idx_words_root ON words(root_id)')
    cursor.execute('CREATE INDEX idx_words_first_position ON words(first_position)')
    cursor.execute('CREATE INDEX idx_words_word ON words(word)')

    conn.commit()
    print("✓ Database schema created")

    return conn

def populate_database(conn: sqlite3.Connection, dictionaries: List[Dict], index_data: Dict):
    """Populate database with dictionary and index data."""
    cursor = conn.cursor()

    print("\nPopulating database...")

    # Track progress
    total_indexed_roots = sum(len(roots) for roots in index_data.values())
    processed_roots = 0
    total_unindexed_roots = 0

    # Insert dictionaries and their data
    for dictionary in dictionaries:
        dict_name = dictionary['name']
        print(f"\nProcessing dictionary: {dict_name}")

        # Insert dictionary
        cursor.execute('INSERT INTO dictionaries (name) VALUES (?)', (dict_name,))
        dict_id = cursor.lastrowid

        # Get index data for this dictionary (may be empty for non-indexed dictionaries)
        dict_index = index_data.get(dict_name, {})

        # Track which roots we've added
        added_roots = set()

        # STEP 1: Insert indexed roots (roots with word position data)
        print(f"  [1/2] Processing indexed roots...")
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
                import json
                all_positions_json = json.dumps(word_data['positions'])

                cursor.execute(
                    'INSERT INTO words (root_id, word, first_position, all_positions) VALUES (?, ?, ?, ?)',
                    (root_id, word_data['word'], word_data['first_position'], all_positions_json)
                )

            processed_roots += 1
            if processed_roots % 1000 == 0:
                print(f"    Processed {processed_roots}/{total_indexed_roots} indexed roots ({100*processed_roots/total_indexed_roots:.1f}%)")
                conn.commit()  # Commit periodically

        # STEP 2: Insert non-indexed roots (roots with definitions but no position data)
        print(f"  [2/2] Processing non-indexed roots...")
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
                print(f"    Added {unindexed_count} non-indexed roots...")
                conn.commit()  # Commit periodically

        print(f"  ✓ Added {len(dict_index)} indexed roots and {unindexed_count} non-indexed roots")

    # Final commit
    conn.commit()
    print(f"\n✓ Processed all roots:")
    print(f"  - Indexed roots: {processed_roots}")
    print(f"  - Non-indexed roots: {total_unindexed_roots}")
    print(f"  - Total: {processed_roots + total_unindexed_roots}")

def optimize_database(conn: sqlite3.Connection):
    """Optimize database for read performance."""
    print("\nOptimizing database...")
    cursor = conn.cursor()

    # Analyze tables for query optimization
    cursor.execute('ANALYZE')

    # Vacuum to reclaim space and optimize
    cursor.execute('VACUUM')

    conn.commit()
    print("✓ Database optimized")

def print_stats(conn: sqlite3.Connection):
    """Print database statistics."""
    cursor = conn.cursor()

    cursor.execute('SELECT COUNT(*) FROM dictionaries')
    dict_count = cursor.fetchone()[0]

    cursor.execute('SELECT COUNT(*) FROM roots')
    root_count = cursor.fetchone()[0]

    cursor.execute('SELECT COUNT(*) FROM words')
    word_count = cursor.fetchone()[0]

    print("\n" + "=" * 60)
    print("Database Statistics:")
    print("=" * 60)
    print(f"Dictionaries: {dict_count}")
    print(f"Roots: {root_count}")
    print(f"Words: {word_count}")
    print("=" * 60)

def main():
    """Main execution."""
    print("=" * 60)
    print("Generating SQLite Database")
    print("=" * 60)

    # Paths
    maajem_path = 'optimized/maajem-optimized.json.gz'
    index_path = 'optimized/index-optimized.json.gz'
    db_path = 'optimized/dictionary.db'

    # Load data
    print("\n[1/4] Loading dictionary data...")
    dictionaries = load_json_gz(maajem_path)

    print("[2/4] Loading index data...")
    index_data = load_json_gz(index_path)

    # Create and populate database
    print("[3/4] Creating database...")
    conn = create_database(db_path)

    populate_database(conn, dictionaries, index_data)

    # Optimize
    print("[4/4] Optimizing database...")
    optimize_database(conn)

    # Print stats
    print_stats(conn)

    # Get file size
    db_size_mb = os.path.getsize(db_path) / (1024 * 1024)
    print(f"\nDatabase file size: {db_size_mb:.2f} MB")

    conn.close()

    print("\n" + "=" * 60)
    print(f"✓ Complete! Database saved to: {db_path}")
    print("=" * 60)

if __name__ == '__main__':
    main()
