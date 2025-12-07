#!/usr/bin/env python3
"""
Convert Hugging Face Dataset to M3ajem SQLite Database
=======================================================
Downloads parquet files from Hugging Face and creates the SQLite database.

Usage:
    python hf_to_db.py
    python hf_to_db.py --output ./database/dictionary.db
    python hf_to_db.py --local ./hf_dataset  # Use local parquet files

Output:
    database/dictionary.db with tables: dictionaries, roots, words
"""

import sqlite3
import os
import argparse

try:
    import pandas as pd
except ImportError:
    print("pandas not installed. Installing...")
    os.system("pip install pandas pyarrow")
    import pandas as pd

HF_DATASET = "mysamai/m3ajim"
DEFAULT_OUTPUT = "database/dictionary.db"


def download_from_huggingface(dataset_name: str) -> tuple:
    """Download parquet files from Hugging Face."""
    print(f"Downloading from Hugging Face: {dataset_name}")

    base_url = f"hf://datasets/{dataset_name}"

    print("  Loading dictionaries.parquet...")
    df_dicts = pd.read_parquet(f"{base_url}/dictionaries.parquet")

    print("  Loading roots.parquet...")
    df_roots = pd.read_parquet(f"{base_url}/roots.parquet")

    print("  Loading words.parquet...")
    df_words = pd.read_parquet(f"{base_url}/words.parquet")

    return df_dicts, df_roots, df_words


def load_from_local(input_dir: str) -> tuple:
    """Load parquet files from local directory."""
    print(f"Loading from local directory: {input_dir}")

    df_dicts = pd.read_parquet(os.path.join(input_dir, "dictionaries.parquet"))
    df_roots = pd.read_parquet(os.path.join(input_dir, "roots.parquet"))
    df_words = pd.read_parquet(os.path.join(input_dir, "words.parquet"))

    return df_dicts, df_roots, df_words


def create_database(df_dicts, df_roots, df_words, output_path: str):
    """Create SQLite database from dataframes."""

    print("\n" + "=" * 60)
    print("CREATING SQLITE DATABASE")
    print("=" * 60)

    # Create output directory if needed
    os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)

    # Remove existing database
    if os.path.exists(output_path):
        print(f"\nRemoving existing database: {output_path}")
        os.remove(output_path)

    conn = sqlite3.connect(output_path)
    cursor = conn.cursor()

    # Create dictionaries table
    print("\n[1/4] Creating dictionaries table...")
    cursor.execute("""
        CREATE TABLE dictionaries (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            indexing_pattern TEXT,
            type TEXT NOT NULL
        )
    """)

    # Insert dictionaries
    for _, row in df_dicts.iterrows():
        cursor.execute("""
            INSERT INTO dictionaries (id, name, description, indexing_pattern, type)
            VALUES (?, ?, ?, ?, ?)
        """, (
            int(row['id']),
            row['name'],
            row.get('description'),
            row.get('indexing_pattern'),
            row['type']
        ))
    print(f"  ✓ Inserted {len(df_dicts)} dictionaries")

    # Create roots table
    print("\n[2/4] Creating roots table...")
    cursor.execute("""
        CREATE TABLE roots (
            id INTEGER PRIMARY KEY,
            dictionary_id INTEGER NOT NULL,
            root TEXT NOT NULL,
            definition TEXT,
            first_word_position INTEGER DEFAULT -1,
            FOREIGN KEY (dictionary_id) REFERENCES dictionaries(id)
        )
    """)

    # Insert roots (only core columns, not the joined columns)
    print("  Inserting roots (this may take a moment)...")
    batch_size = 10000
    total = len(df_roots)

    for i in range(0, total, batch_size):
        batch = df_roots.iloc[i:i+batch_size]
        data = [
            (
                int(row['id']),
                int(row['dictionary_id']),
                row['root'],
                row['definition'],
                int(row.get('first_word_position', -1))
            )
            for _, row in batch.iterrows()
        ]
        cursor.executemany("""
            INSERT INTO roots (id, dictionary_id, root, definition, first_word_position)
            VALUES (?, ?, ?, ?, ?)
        """, data)

        progress = min(i + batch_size, total)
        print(f"    Progress: {progress:,}/{total:,} ({100*progress/total:.1f}%)")

    print(f"  ✓ Inserted {len(df_roots):,} roots")

    # Create words table
    print("\n[3/4] Creating words table...")
    cursor.execute("""
        CREATE TABLE words (
            id INTEGER PRIMARY KEY,
            root_id INTEGER NOT NULL,
            word TEXT NOT NULL,
            first_position INTEGER NOT NULL,
            all_positions TEXT,
            FOREIGN KEY (root_id) REFERENCES roots(id)
        )
    """)

    # Insert words
    if len(df_words) > 0:
        print("  Inserting indexed words...")
        for i in range(0, len(df_words), batch_size):
            batch = df_words.iloc[i:i+batch_size]
            data = [
                (
                    int(row['id']),
                    int(row['root_id']),
                    row['word'],
                    int(row['first_position']),
                    row.get('all_positions')
                )
                for _, row in batch.iterrows()
            ]
            cursor.executemany("""
                INSERT INTO words (id, root_id, word, first_position, all_positions)
                VALUES (?, ?, ?, ?, ?)
            """, data)

            progress = min(i + batch_size, len(df_words))
            print(f"    Progress: {progress:,}/{len(df_words):,} ({100*progress/len(df_words):.1f}%)")

    print(f"  ✓ Inserted {len(df_words):,} indexed words")

    # Create indexes
    print("\n[4/4] Creating indexes...")
    cursor.execute("CREATE INDEX idx_roots_dictionary_id ON roots(dictionary_id)")
    cursor.execute("CREATE INDEX idx_roots_root ON roots(root)")
    cursor.execute("CREATE INDEX idx_words_root_id ON words(root_id)")
    cursor.execute("CREATE INDEX idx_words_word ON words(word)")
    print("  ✓ Created indexes")

    conn.commit()
    conn.close()

    # Print summary
    file_size = os.path.getsize(output_path) / (1024 * 1024)
    print("\n" + "=" * 60)
    print("DATABASE CREATED SUCCESSFULLY")
    print("=" * 60)
    print(f"\nOutput: {output_path}")
    print(f"Size: {file_size:.2f} MB")
    print(f"\nContents:")
    print(f"  - {len(df_dicts)} dictionaries")
    print(f"  - {len(df_roots):,} roots/entries")
    print(f"  - {len(df_words):,} indexed words")


def main():
    parser = argparse.ArgumentParser(
        description='Convert Hugging Face dataset to M3ajem SQLite database'
    )
    parser.add_argument(
        '--output', '-o',
        type=str,
        default=DEFAULT_OUTPUT,
        help=f'Output database path (default: {DEFAULT_OUTPUT})'
    )
    parser.add_argument(
        '--local', '-l',
        type=str,
        default=None,
        help='Local directory with parquet files (skip download)'
    )
    parser.add_argument(
        '--dataset', '-d',
        type=str,
        default=HF_DATASET,
        help=f'Hugging Face dataset name (default: {HF_DATASET})'
    )
    args = parser.parse_args()

    print("=" * 60)
    print("M3AJEM HUGGING FACE TO DATABASE CONVERTER")
    print("=" * 60)

    try:
        if args.local:
            df_dicts, df_roots, df_words = load_from_local(args.local)
        else:
            df_dicts, df_roots, df_words = download_from_huggingface(args.dataset)

        create_database(df_dicts, df_roots, df_words, args.output)

    except Exception as e:
        print(f"\nERROR: {e}")
        raise


if __name__ == '__main__':
    main()
