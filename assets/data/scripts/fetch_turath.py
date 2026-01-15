#!/usr/bin/env python3
"""
Fetch book from api.turath.io
Book 83: لسان العرب
"""

import os
import json
import time
import argparse
import requests

DEFAULT_BOOK_ID = 83
START_PAGE = 1
END_PAGE = 4577
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

API_URL = "https://api.turath.io/page"

def fetch_page(session, book_id: int, page_num: int, retries: int = 3) -> dict | None:
    """Fetch a single page from the API."""
    for attempt in range(retries):
        try:
            response = session.get(API_URL, params={
                'book_id': book_id,
                'pg': page_num,
                'ver': 3
            }, timeout=30)

            if response.status_code == 200:
                data = response.json()
                return {
                    'page': page_num,
                    'meta': data.get('meta', {}),
                    'text': data.get('text', '')
                }
            elif response.status_code == 404:
                return None
            else:
                print(f"[{page_num}] HTTP {response.status_code}")
                time.sleep(2)

        except Exception as e:
            print(f"[{page_num}] Error: {e}")
            if attempt < retries - 1:
                time.sleep(2)

    return None

def save_data(pages_data: dict, output_file: str):
    """Save data to JSON file."""
    sorted_pages = sorted(pages_data.values(), key=lambda x: x['page'])
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(sorted_pages, f, ensure_ascii=False, indent=2)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--start', type=int, default=START_PAGE)
    parser.add_argument('--end', type=int, default=END_PAGE)
    parser.add_argument('--book', type=int, default=DEFAULT_BOOK_ID)
    args = parser.parse_args()

    book_id = args.book
    output_file = os.path.join(OUTPUT_DIR, f"turath_book_{book_id}.json")

    print(f"Fetching book {book_id} from api.turath.io")
    print(f"Pages {args.start} to {args.end}")
    print(f"Output: {output_file}")
    print("-" * 50)

    # Load existing progress
    pages_data = {}
    if os.path.exists(output_file):
        try:
            with open(output_file, 'r', encoding='utf-8') as f:
                existing = json.load(f)
                pages_data = {p['page']: p for p in existing}
                print(f"Resuming: {len(pages_data)} pages already fetched")
        except:
            pass

    pages_to_fetch = [p for p in range(args.start, args.end + 1) if p not in pages_data]

    if not pages_to_fetch:
        print("All pages already fetched!")
        return

    print(f"Pages to fetch: {len(pages_to_fetch)}")
    print("-" * 50)

    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'Accept': 'application/json'
    })

    completed = 0
    failed = []

    for i, page_num in enumerate(pages_to_fetch):
        result = fetch_page(session, book_id, page_num)

        if result and result.get('text'):
            pages_data[page_num] = result
            completed += 1

            # Show preview
            meta = result.get('meta', {})
            vol = meta.get('vol', '?') if isinstance(meta, dict) else '?'
            text_preview = result['text'][:50].replace('\n', ' ')
            print(f"[{page_num}] vol.{vol} - {text_preview}...")
        else:
            failed.append(page_num)
            print(f"[{page_num}] No content")

        # Progress and save
        if (i + 1) % 50 == 0:
            print(f"Progress: {completed}/{i+1} ({len(failed)} failed)")
            save_data(pages_data, output_file)

        # Small delay to be nice to the API
        time.sleep(0.2)

    save_data(pages_data, output_file)

    print("-" * 50)
    print(f"Done: {completed}/{len(pages_to_fetch)} fetched")
    print(f"Failed: {len(failed)}")
    print(f"Total saved: {len(pages_data)}")

if __name__ == '__main__':
    main()
