#!/usr/bin/env python3
"""
Load spectrum embeddings into SQLite database
Usage: python3 load-spectrum-embeddings.py
Input: assets/data/optimized/spectrum-embeddings.json
Output: Updates assets/data/optimized/dictionary.db
"""

import json
import sqlite3
import struct
import os

# Configuration
EMBEDDINGS_FILE = "../assets/data/optimized/spectrum-embeddings.json"
DATABASE_FILE = "../assets/data/optimized/dictionary.db"

def load_embeddings():
    """Load embeddings JSON file"""
    print(f"Loading embeddings from {EMBEDDINGS_FILE}...")
    with open(EMBEDDINGS_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def convert_to_blob(embedding):
    """Convert float array to binary blob for SQLite"""
    # Pack as array of floats (32-bit)
    return struct.pack(f'{len(embedding)}f', *embedding)

def load_sqlite_vec_extension(conn):
    """Try to load sqlite-vec extension"""
    # Try common extension paths
    extension_paths = [
        "./vec0",  # Current directory
        "/usr/local/lib/vec0",  # Unix system path
        "../vec0",  # Parent directory
    ]

    for path in extension_paths:
        try:
            conn.enable_load_extension(True)
            conn.load_extension(path)
            print(f"✓ Loaded sqlite-vec extension from {path}")
            return True
        except Exception as e:
            continue

    print("⚠ Warning: Could not load sqlite-vec extension")
    print("   The database will be created but vector search won't work until")
    print("   the extension is loaded at runtime in the app.")
    return False

def main():
    # Check if files exist
    if not os.path.exists(EMBEDDINGS_FILE):
        print(f"Error: Embeddings file not found: {EMBEDDINGS_FILE}")
        print("Please run generate-spectrum-embeddings.py first")
        return 1

    if not os.path.exists(DATABASE_FILE):
        print(f"Error: Database file not found: {DATABASE_FILE}")
        print("Please ensure the dictionary database exists")
        return 1

    # Load embeddings data
    data = load_embeddings()
    print(f"Loaded {len(data['roots'])} embeddings")
    print(f"Model: {data['model']}")
    print(f"Dimensions: {data['dimensions']}")

    # Connect to database
    print(f"\nConnecting to database: {DATABASE_FILE}")
    conn = sqlite3.connect(DATABASE_FILE)

    # Try to load extension (optional, app will load it at runtime)
    load_sqlite_vec_extension(conn)

    cursor = conn.cursor()

    try:
        # Check if table exists (migration should have created it)
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='spectrum_vectors'
        """)

        if not cursor.fetchone():
            print("\n⚠ Warning: spectrum_vectors table does not exist")
            print("   Migration 002 should create this table")
            print("   Attempting to create table now...")

            # Try to create the virtual table
            try:
                cursor.execute(f"""
                    CREATE VIRTUAL TABLE spectrum_vectors USING vec0(
                        root TEXT PRIMARY KEY,
                        embedding float[{data['dimensions']}]
                    )
                """)
                print("✓ Table created successfully")
            except Exception as e:
                print(f"✗ Could not create table: {e}")
                print("   Please run the app migrations first")
                return 1

        # Clear existing data
        print("\nClearing existing embeddings...")
        cursor.execute("DELETE FROM spectrum_vectors")
        conn.commit()

        # Insert embeddings
        print(f"Inserting {len(data['roots'])} embeddings...")

        inserted = 0
        for entry in data['roots']:
            root = entry['root']
            embedding_blob = convert_to_blob(entry['embedding'])

            try:
                cursor.execute(
                    "INSERT INTO spectrum_vectors (root, embedding) VALUES (?, ?)",
                    (root, embedding_blob)
                )
                inserted += 1

                if inserted % 100 == 0:
                    print(f"  Inserted {inserted}/{len(data['roots'])}...")
            except Exception as e:
                print(f"  Error inserting {root}: {e}")

        conn.commit()
        print(f"\n✓ Successfully inserted {inserted} embeddings")

        # Verify
        cursor.execute("SELECT COUNT(*) FROM spectrum_vectors")
        count = cursor.fetchone()[0]
        print(f"✓ Verified: {count} embeddings in database")

    except Exception as e:
        print(f"\n✗ Error: {e}")
        conn.rollback()
        return 1
    finally:
        conn.close()

    print("\n✓ Embeddings loaded successfully!")
    return 0

if __name__ == "__main__":
    exit(main())
