#!/usr/bin/env python3
"""
Finalize Batch Processing Results
==================================
Merges page-level results into final dictionary JSON files.

Key responsibilities:
1. Gather all page results for each completed dictionary
2. Handle continuations (__continuation__ markers)
3. Deduplicate entries (same key from different pages)
4. Generate final {folder_name}.json in unified format

Usage:
    python finalize_results.py                    # Finalize all completed
    python finalize_results.py --dict aami_faseeh # Finalize specific dictionary
    python finalize_results.py --dry-run          # Preview without writing
"""

import sqlite3
import os
import json
import argparse
from datetime import datetime
from typing import Dict, List, Any

DB_PATH = "jobs.db"
MORAQMAN_DIR = "maajim/moraqman"


def get_completed_dictionaries(conn: sqlite3.Connection, dict_filter: str = None) -> List[dict]:
    """Get dictionaries that are ready for finalization."""
    cursor = conn.cursor()

    query = '''
        SELECT d.id, d.folder_name, d.name, d.description, d.total_pages,
               COUNT(CASE WHEN j.status = 'completed' THEN 1 END) as completed_pages
        FROM dictionaries d
        JOIN jobs j ON d.id = j.dictionary_id
        WHERE d.status IN ('completed', 'processing', 'partial')
    '''
    params = []

    if dict_filter:
        query += ' AND d.folder_name = ?'
        params.append(dict_filter)

    query += ' GROUP BY d.id HAVING completed_pages > 0'

    cursor.execute(query, params)

    return [
        {
            'id': row[0],
            'folder_name': row[1],
            'name': row[2],
            'description': row[3],
            'total_pages': row[4],
            'completed_pages': row[5]
        }
        for row in cursor.fetchall()
    ]


def get_page_results(conn: sqlite3.Connection, dict_id: int) -> List[dict]:
    """Get all completed page results for a dictionary, ordered by page number."""
    cursor = conn.cursor()

    cursor.execute('''
        SELECT page_num, result_json
        FROM jobs
        WHERE dictionary_id = ? AND status = 'completed' AND result_json IS NOT NULL AND result_json != ''
        ORDER BY page_num ASC
    ''', (dict_id,))

    results = []
    for row in cursor.fetchall():
        try:
            results.append({'page_num': row[0], 'result': json.loads(row[1])})
        except json.JSONDecodeError as e:
            print(f"    ⚠️  Page {row[0]}: Invalid JSON, skipping")
    return results


def merge_page_results(page_results: List[dict]) -> Dict[str, str]:
    """
    Merge page results handling continuations and duplicates.

    Continuation handling:
    - If page N has "__continuation__", append to last entry from page N-1
    - Track last entry key for each page

    Deduplication:
    - Later pages override earlier pages (assumes later is more complete)
    - Track which page each entry came from for debugging

    Returns:
        Merged dictionary {term: definition}
    """
    merged = {}
    last_entry_key = None
    entry_sources = {}  # Track which page each entry came from

    for page_data in page_results:
        page_num = page_data['page_num']
        result = page_data['result']

        # Handle various wrapped formats from inconsistent LLM output
        if isinstance(result, dict):
            # Skip error results
            if 'error' in result:
                continue

            # Extract array from various wrapper keys
            for wrapper_key in ['data', 'entries', 'json', 'result', 'array', 'json_array']:
                if wrapper_key in result and isinstance(result[wrapper_key], list):
                    result = result[wrapper_key]
                    break

            # Handle single entry dict (has french/english/arabic directly)
            if isinstance(result, dict) and 'arabic_term' in result:
                result = [result]  # Wrap single entry in list

        # Handle different result formats
        if isinstance(result, list):
            # Array format (english_arabic_dictionary)
            for entry in result:
                # Skip continuation markers in list format
                if entry.get('is_continuation'):
                    continue

                arabic_term = entry.get('arabic_term', '')
                if not arabic_term:
                    continue

                english = entry.get('english', '')
                arabic_def = entry.get('arabic', '')

                # Create key in hydrology format: "Arabic term (english)"
                if english:
                    key = f"{arabic_term} ({english})"
                    # Value format: "Arabic term\ndefinition"
                    value = f"{arabic_term}\n{arabic_def}" if arabic_def else arabic_term
                else:
                    key = arabic_term
                    value = arabic_def

                merged[key] = value
                entry_sources[key] = page_num
                last_entry_key = key

        elif isinstance(result, dict):
            # Dictionary format (arabic_only_with_diacritics)

            # Check for continuation first
            if '__continuation__' in result:
                continuation_text = result['__continuation__']

                if last_entry_key and last_entry_key in merged:
                    # Append to previous entry
                    merged[last_entry_key] += ' ' + continuation_text
                    print(f"    Page {page_num}: Merged continuation to '{last_entry_key[:30]}...'")

                # Remove continuation from further processing
                result = {k: v for k, v in result.items() if k != '__continuation__'}

            # Process regular entries
            for key, value in result.items():
                if key in merged:
                    # Duplicate - keep the longer definition
                    if len(value) > len(merged[key]):
                        merged[key] = value
                        entry_sources[key] = page_num
                else:
                    merged[key] = value
                    entry_sources[key] = page_num

                last_entry_key = key

    return merged


def create_unified_json(dict_info: dict, merged_data: Dict[str, str]) -> dict:
    """Create unified JSON format compatible with ommat.json."""
    return {
        'name': dict_info['name'],
        'description': dict_info['description'],
        'type': 'moraqman',
        'data': merged_data
    }


def finalize_dictionary(conn: sqlite3.Connection, dict_info: dict, dry_run: bool = False) -> bool:
    """
    Finalize a single dictionary.

    Returns True if successful, False otherwise.
    """
    folder_name = dict_info['folder_name']
    dict_id = dict_info['id']

    print(f"\n📖 {dict_info['name']}")
    print(f"   Folder: {folder_name}")
    print(f"   Pages: {dict_info['completed_pages']}/{dict_info['total_pages']}")

    # Get page results
    page_results = get_page_results(conn, dict_id)

    if not page_results:
        print(f"   ⚠️  No completed pages found")
        return False

    # Merge results
    print(f"   Merging {len(page_results)} pages...")
    merged_data = merge_page_results(page_results)

    print(f"   ✓ Merged: {len(merged_data)} unique entries")

    if dry_run:
        print(f"   (Dry run - not writing file)")
        # Show sample entries
        sample = list(merged_data.items())[:3]
        for key, value in sample:
            print(f"      • {key[:40]}: {value[:50]}...")
        return True

    # Create unified JSON
    unified = create_unified_json(dict_info, merged_data)

    # Save to file
    output_path = os.path.join(MORAQMAN_DIR, folder_name, f'{folder_name}.json')
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(unified, f, ensure_ascii=False, indent=2)

    print(f"   ✓ Saved to {output_path}")

    # Update dictionary status
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE dictionaries SET status = 'finalized', completed_at = ?
        WHERE id = ?
    ''', (datetime.now(), dict_id))
    conn.commit()

    return True


def show_summary(conn: sqlite3.Connection):
    """Show summary of all dictionaries."""
    cursor = conn.cursor()

    cursor.execute('''
        SELECT d.folder_name, d.name, d.status, d.total_pages,
               COUNT(CASE WHEN j.status = 'completed' THEN 1 END) as done,
               COUNT(CASE WHEN j.status = 'failed' THEN 1 END) as failed
        FROM dictionaries d
        LEFT JOIN jobs j ON d.id = j.dictionary_id
        GROUP BY d.id
        ORDER BY d.status DESC, d.folder_name
    ''')

    print("\n" + "=" * 70)
    print("FINALIZATION SUMMARY")
    print("=" * 70)
    print(f"\n{'Dictionary':<25} {'Status':<12} {'Progress':<15}")
    print("-" * 60)

    for row in cursor.fetchall():
        folder, name, status, total, done, failed = row
        progress = f"{done}/{total}" if total else "?"
        status_icon = {
            'finalized': '✅',
            'completed': '🔄',
            'processing': '⏳',
            'partial': '⚠️',
            'pending': '📋',
            'failed': '❌'
        }.get(status, '❓')
        print(f"{folder:<25} {status_icon} {status:<10} {progress}")

    print("=" * 70)


def main():
    parser = argparse.ArgumentParser(description='Finalize batch processing results')
    parser.add_argument('--dict', type=str, help='Finalize specific dictionary only')
    parser.add_argument('--dry-run', action='store_true', help='Preview without writing files')
    parser.add_argument('--db', type=str, default=DB_PATH, help='Database path')
    parser.add_argument('--summary', action='store_true', help='Show summary only')
    args = parser.parse_args()

    if not os.path.exists(args.db):
        print(f"❌ Database not found: {args.db}")
        print("   Run prepare_jobs.py first")
        return

    conn = sqlite3.connect(args.db)

    if args.summary:
        show_summary(conn)
        conn.close()
        return

    print("=" * 70)
    print("FINALIZING BATCH RESULTS")
    print("=" * 70)

    if args.dry_run:
        print("(DRY RUN - no files will be written)\n")

    # Get completed dictionaries
    dicts = get_completed_dictionaries(conn, args.dict)

    if not dicts:
        print("No completed dictionaries to finalize.")
        print("Run process_batch.py to process more pages.")
        conn.close()
        return

    print(f"Found {len(dicts)} dictionaries to finalize")

    finalized = 0
    failed = 0

    for dict_info in dicts:
        try:
            if finalize_dictionary(conn, dict_info, args.dry_run):
                finalized += 1
            else:
                failed += 1
        except Exception as e:
            print(f"   ❌ Error: {e}")
            failed += 1

    print("\n" + "=" * 70)
    print(f"✅ Finalized: {finalized}")
    if failed:
        print(f"❌ Failed: {failed}")
    print("=" * 70)

    show_summary(conn)
    conn.close()


if __name__ == '__main__':
    main()
