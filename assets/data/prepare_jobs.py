#!/usr/bin/env python3
"""
Prepare Jobs for Batch Processing
==================================
Scans moraqman/ for unprocessed dictionaries and creates jobs in SQLite.

Description file format:
    Line 1: Dictionary name (Arabic)
    Line 2: Description
    Line 3 (optional): prompt_name,context_pages (e.g., arabic_only_with_diacritics,1)

Usage:
    python prepare_jobs.py                    # Prepare all unprocessed
    python prepare_jobs.py --force folder     # Force re-prepare specific folder
    python prepare_jobs.py --status           # Show status of all dictionaries
"""

import sqlite3
import os
import argparse
import fitz  # PyMuPDF
from datetime import datetime
from typing import Optional

# Default settings
DEFAULT_PROMPT = "arabic_only_with_diacritics"
DEFAULT_CONTEXT_PAGES = 1
DB_PATH = "jobs.db"
MORAQMAN_DIR = "maajim/moraqman"


def init_database(db_path: str) -> sqlite3.Connection:
    """Initialize database with schema."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS dictionaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            folder_name TEXT UNIQUE,
            name TEXT,
            description TEXT,
            prompt_name TEXT DEFAULT 'arabic_only_with_diacritics',
            context_pages INTEGER DEFAULT 1,
            skip_pages INTEGER DEFAULT 0,
            pdf_path TEXT,
            total_pages INTEGER,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dictionary_id INTEGER REFERENCES dictionaries(id),
            page_num INTEGER,
            status TEXT DEFAULT 'pending',
            result_json TEXT,
            error TEXT,
            attempts INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP,
            UNIQUE(dictionary_id, page_num)
        )
    ''')

    cursor.execute('CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_jobs_dict ON jobs(dictionary_id)')

    conn.commit()
    return conn


def parse_description_file(folder_path: str) -> dict:
    """
    Parse description file to extract metadata.

    Format:
        Line 1: Dictionary name (Arabic)
        Line 2: Description
        Line 3 (optional): prompt_name,context_pages
        Line 4 (optional): skip N (skip first N pages)

    Returns:
        {
            'name': str,
            'description': str,
            'prompt_name': str,
            'context_pages': int,
            'skip_pages': int
        }
    """
    desc_file = os.path.join(folder_path, 'description')
    folder_name = os.path.basename(folder_path)

    result = {
        'name': folder_name,
        'description': f'معجم {folder_name}',
        'prompt_name': DEFAULT_PROMPT,
        'context_pages': DEFAULT_CONTEXT_PAGES,
        'skip_pages': 0
    }

    if not os.path.exists(desc_file):
        return result

    with open(desc_file, 'r', encoding='utf-8') as f:
        lines = f.read().strip().split('\n')

    if len(lines) >= 1:
        result['name'] = lines[0].strip()

    if len(lines) >= 2:
        result['description'] = lines[1].strip()

    if len(lines) >= 3:
        # Parse prompt_name,context_pages
        config_line = lines[2].strip()
        if ',' in config_line:
            parts = config_line.split(',')
            result['prompt_name'] = parts[0].strip()
            try:
                result['context_pages'] = int(parts[1].strip())
            except ValueError:
                pass
        else:
            result['prompt_name'] = config_line

    # Check for skip directive (can be on line 4 or any subsequent line)
    for line in lines[3:]:
        line = line.strip().lower()
        if line.startswith('skip'):
            parts = line.split()
            if len(parts) >= 2:
                try:
                    result['skip_pages'] = int(parts[1])
                except ValueError:
                    pass

    return result


def find_pdf_file(folder_path: str) -> Optional[str]:
    """Find PDF file in folder."""
    for f in os.listdir(folder_path):
        if f.endswith('.pdf'):
            return os.path.join(folder_path, f)
    return None


def is_already_processed(folder_path: str) -> bool:
    """Check if dictionary already has final JSON (completed processing)."""
    folder_name = os.path.basename(folder_path)
    output_file = os.path.join(folder_path, f'{folder_name}.json')
    return os.path.exists(output_file)


def get_pdf_page_count(pdf_path: str) -> int:
    """Get number of pages in PDF."""
    doc = fitz.open(pdf_path)
    count = len(doc)
    doc.close()
    return count


def prepare_dictionary(conn: sqlite3.Connection, folder_path: str, force: bool = False) -> bool:
    """
    Prepare jobs for a single dictionary.

    Returns True if jobs were created, False otherwise.
    """
    cursor = conn.cursor()
    folder_name = os.path.basename(folder_path)

    # Check if already in database
    cursor.execute('SELECT id, status FROM dictionaries WHERE folder_name = ?', (folder_name,))
    existing = cursor.fetchone()

    if existing and not force:
        print(f"  ⏭️  {folder_name}: Already in database (status: {existing[1]})")
        return False

    # Check if already has final JSON
    if is_already_processed(folder_path) and not force:
        print(f"  ✅ {folder_name}: Already has final JSON")
        return False

    # Find PDF
    pdf_path = find_pdf_file(folder_path)
    if not pdf_path:
        print(f"  ⚠️  {folder_name}: No PDF file found")
        return False

    # Parse description
    metadata = parse_description_file(folder_path)

    # Get page count
    total_pages = get_pdf_page_count(pdf_path)

    print(f"  📖 {folder_name}:")
    print(f"      Name: {metadata['name']}")
    print(f"      Prompt: {metadata['prompt_name']}")
    print(f"      Context: {metadata['context_pages']} pages")
    print(f"      Skip: {metadata['skip_pages']} pages")
    print(f"      PDF: {os.path.basename(pdf_path)} ({total_pages} pages)")

    # Delete existing if force
    if existing and force:
        cursor.execute('DELETE FROM jobs WHERE dictionary_id = ?', (existing[0],))
        cursor.execute('DELETE FROM dictionaries WHERE id = ?', (existing[0],))
        conn.commit()
        print(f"      (Force: deleted existing jobs)")

    # Insert dictionary
    cursor.execute('''
        INSERT INTO dictionaries (folder_name, name, description, prompt_name, context_pages, skip_pages, pdf_path, total_pages, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    ''', (folder_name, metadata['name'], metadata['description'],
          metadata['prompt_name'], metadata['context_pages'], metadata['skip_pages'], pdf_path, total_pages))

    dict_id = cursor.lastrowid

    # Create jobs for each page (respecting skip_pages)
    start_page = metadata['skip_pages'] + 1
    for page_num in range(start_page, total_pages + 1):
        cursor.execute('''
            INSERT INTO jobs (dictionary_id, page_num, status)
            VALUES (?, ?, 'pending')
        ''', (dict_id, page_num))

    conn.commit()
    jobs_created = total_pages - metadata['skip_pages']
    print(f"      ✓ Created {jobs_created} jobs")

    return True


def show_status(conn: sqlite3.Connection):
    """Show status of all dictionaries and jobs."""
    cursor = conn.cursor()

    print("\n" + "=" * 70)
    print("BATCH PROCESSING STATUS")
    print("=" * 70)

    # Dictionary status
    cursor.execute('''
        SELECT d.folder_name, d.name, d.total_pages, d.status,
               COUNT(CASE WHEN j.status = 'completed' THEN 1 END) as done,
               COUNT(CASE WHEN j.status = 'pending' THEN 1 END) as pending,
               COUNT(CASE WHEN j.status = 'failed' THEN 1 END) as failed
        FROM dictionaries d
        LEFT JOIN jobs j ON d.id = j.dictionary_id
        GROUP BY d.id
        ORDER BY d.created_at DESC
    ''')

    rows = cursor.fetchall()

    if not rows:
        print("\nNo dictionaries in database.")
        print("Run: python prepare_jobs.py")
        return

    print(f"\n{'Dictionary':<30} {'Pages':<8} {'Done':<8} {'Pending':<8} {'Failed':<8} {'Status'}")
    print("-" * 80)

    total_pages = 0
    total_done = 0
    total_pending = 0
    total_failed = 0

    for row in rows:
        folder, name, pages, status, done, pending, failed = row
        total_pages += pages or 0
        total_done += done or 0
        total_pending += pending or 0
        total_failed += failed or 0

        progress = f"{done}/{pages}" if pages else "?"
        print(f"{folder:<30} {pages or 0:<8} {done or 0:<8} {pending or 0:<8} {failed or 0:<8} {status}")

    print("-" * 80)
    print(f"{'TOTAL':<30} {total_pages:<8} {total_done:<8} {total_pending:<8} {total_failed:<8}")

    if total_pages > 0:
        pct = (total_done / total_pages) * 100
        print(f"\nOverall Progress: {pct:.1f}% ({total_done}/{total_pages} pages)")

    print("=" * 70)


def main():
    parser = argparse.ArgumentParser(description='Prepare batch processing jobs')
    parser.add_argument('--force', type=str, help='Force re-prepare specific folder')
    parser.add_argument('--status', action='store_true', help='Show status only')
    parser.add_argument('--db', type=str, default=DB_PATH, help='Database path')
    args = parser.parse_args()

    # Initialize database
    conn = init_database(args.db)

    if args.status:
        show_status(conn)
        conn.close()
        return

    print("=" * 70)
    print("PREPARING BATCH PROCESSING JOBS")
    print("=" * 70)
    print(f"Database: {args.db}")
    print(f"Scanning: {MORAQMAN_DIR}/")
    print()

    # Get all folders
    if not os.path.exists(MORAQMAN_DIR):
        print(f"❌ Directory not found: {MORAQMAN_DIR}")
        return

    folders = [
        f for f in os.listdir(MORAQMAN_DIR)
        if os.path.isdir(os.path.join(MORAQMAN_DIR, f))
    ]

    print(f"Found {len(folders)} dictionary folders\n")

    created_count = 0

    for folder_name in sorted(folders):
        folder_path = os.path.join(MORAQMAN_DIR, folder_name)

        # If --force specified, only process that folder
        if args.force and folder_name != args.force:
            continue

        force = args.force == folder_name
        if prepare_dictionary(conn, folder_path, force):
            created_count += 1

    print()
    print("=" * 70)
    print(f"✅ Prepared {created_count} new dictionaries")
    print("=" * 70)

    # Show final status
    show_status(conn)

    conn.close()


if __name__ == '__main__':
    main()
