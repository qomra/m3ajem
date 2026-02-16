#!/usr/bin/env python3
"""
Fetch book data from ketabonline.com
Book 2716: إعراب القرآن وبيانه - محيي الدين درويش
10 volumes, ~5,784 pages

Downloads the data.zip archive which contains the full book as JSON,
then extracts and saves as our standard format.
"""

import os
import json
import zipfile
import io
import requests

BOOK_ID = 2716
DATA_URL = f"https://s2.ketabonline.com/books/{BOOK_ID}/{BOOK_ID}.data.zip"
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(OUTPUT_DIR, f"ketabonline_book_{BOOK_ID}.json")


def main():
    # Check if already downloaded
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
            existing = json.load(f)
        print(f"Already downloaded: {OUTPUT_FILE}")
        print(f"Contains {len(existing)} pages")
        print("Delete the file to re-download.")
        return

    print(f"Downloading book {BOOK_ID} data from ketabonline.com...")
    print(f"URL: {DATA_URL}")
    print("-" * 50)

    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    })

    response = session.get(DATA_URL, timeout=120)

    if response.status_code != 200:
        print(f"Error: HTTP {response.status_code}")
        return

    print(f"Downloaded {len(response.content) / (1024*1024):.1f} MB")

    # Extract JSON from ZIP
    print("Extracting ZIP...")
    with zipfile.ZipFile(io.BytesIO(response.content)) as zf:
        names = zf.namelist()
        print(f"Files in archive: {names}")

        # Find the JSON data file
        json_file = None
        for name in names:
            if name.endswith('.json') or name.endswith('.data.json'):
                json_file = name
                break

        if not json_file:
            # Try the first file
            json_file = names[0] if names else None

        if not json_file:
            print("Error: No data file found in archive")
            return

        print(f"Extracting: {json_file}")
        raw_data = zf.read(json_file)

    # Parse JSON
    print("Parsing JSON...")
    data = json.loads(raw_data.decode('utf-8'))

    # Inspect the structure
    if isinstance(data, list):
        print(f"Data is a list with {len(data)} entries")
        if data:
            print(f"First entry keys: {list(data[0].keys()) if isinstance(data[0], dict) else type(data[0])}")
    elif isinstance(data, dict):
        print(f"Data is a dict with keys: {list(data.keys())[:20]}")
        # If it has a 'pages' key or similar, extract it
        if 'pages' in data:
            pages = data['pages']
            print(f"Found 'pages' key with {len(pages)} entries")
        elif 'data' in data:
            pages = data['data']
            print(f"Found 'data' key with {len(pages)} entries")

    # Save raw data as-is for the converter to process
    print(f"\nSaving to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    size_mb = os.path.getsize(OUTPUT_FILE) / (1024 * 1024)
    print(f"Saved: {size_mb:.1f} MB")

    # Show a sample
    print("\n" + "=" * 60)
    print("Sample content:")
    print("=" * 60)
    sample = json.dumps(data[:3] if isinstance(data, list) else dict(list(data.items())[:3]),
                        ensure_ascii=False, indent=2)
    print(sample[:2000])


if __name__ == '__main__':
    main()
