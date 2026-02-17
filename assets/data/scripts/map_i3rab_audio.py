#!/usr/bin/env python3
"""
Map i3rab audio files from Google Drive folder using service account.
Creates i3rabAudioMap.json keyed by dictionary entry names
(e.g. "001 سورة الفاتحة / آيات 001-007") pointing to the _with_tilawa.mp3 files.

Usage:
    python map_i3rab_audio.py
"""

import os
import re
import json
from google.oauth2 import service_account
from googleapiclient.discovery import build

CREDENTIALS_FILE = os.path.join(os.path.dirname(__file__), '..', 'm3ajem-0ea9c5d1f227.json')
FOLDER_ID = '1UmLvRAKrIdBcNgYXX_i-QiLE3pvSMkgh'
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'src', 'data')
I3RAB_JSON = os.path.join(os.path.dirname(__file__), '..', 'maajim', 'lo3awi', 'i3rab_quran', 'إعراب القرآن وبيانه.json')


def sanitize_filename(key):
    """Same logic as generate_i3rab_audio.py — converts dict key to filename."""
    m = re.match(r'(\d{3})\s+.*?/\s*آية\s+(\d{3})$', key)
    if m:
        return f"{m.group(1)}_{m.group(2)}_{m.group(2)}"
    m = re.match(r'(\d{3})\s+.*?/\s*آيات\s+(\d{3})-(\d{3})$', key)
    if m:
        return f"{m.group(1)}_{m.group(2)}_{m.group(3)}"
    return None


def get_drive_service():
    """Create Drive API service using service account."""
    credentials = service_account.Credentials.from_service_account_file(
        CREDENTIALS_FILE,
        scopes=['https://www.googleapis.com/auth/drive.readonly']
    )
    return build('drive', 'v3', credentials=credentials)


def list_files(service):
    """List files using Drive API."""
    files = []
    page_token = None

    while True:
        results = service.files().list(
            q=f"'{FOLDER_ID}' in parents and name contains '_with_tilawa'",
            fields='nextPageToken, files(id, name, mimeType, size)',
            pageSize=1000,
            pageToken=page_token
        ).execute()

        files.extend(results.get('files', []))
        page_token = results.get('nextPageToken')

        if not page_token:
            break

    return files


def main():
    # Load dictionary keys
    print(f"Loading dictionary keys from {I3RAB_JSON}...")
    with open(I3RAB_JSON, 'r', encoding='utf-8') as f:
        i3rab_data = json.load(f)

    dict_keys = list(i3rab_data['data'].keys())
    print(f"  {len(dict_keys)} entries")

    # Build filename -> dict key mapping
    filename_to_key = {}
    for key in dict_keys:
        fname = sanitize_filename(key)
        if fname:
            filename_to_key[fname] = key

    print(f"  {len(filename_to_key)} mapped to filenames")

    # Fetch Drive files
    print("\nConnecting to Google Drive...")
    try:
        service = get_drive_service()
    except Exception as e:
        print(f"Error connecting: {e}")
        print("\npip install google-api-python-client google-auth")
        return

    print(f"Fetching _with_tilawa files from folder...")
    files = list_files(service)

    if not files:
        print("No files found in folder")
        return

    print(f"Found {len(files)} files on Drive")

    # Match Drive files to dictionary keys
    audio_map = {}
    unmatched = []
    total_size = 0

    for file in files:
        name = file['name']
        # Extract SSS_FFF_TTT from SSS_FFF_TTT_with_tilawa.mp3
        stem = os.path.splitext(name)[0].replace('_with_tilawa', '')

        if stem not in filename_to_key:
            unmatched.append(name)
            continue

        dict_key = filename_to_key[stem]
        size = int(file.get('size', 0))
        total_size += size

        audio_map[dict_key] = {
            'id': file['id'],
            'name': name,
            'url': f"https://drive.google.com/uc?export=download&id={file['id']}",
            'size': size,
            'mimeType': file.get('mimeType', '')
        }

    # Sort by key
    audio_map = dict(sorted(audio_map.items()))

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    output_file = os.path.join(OUTPUT_DIR, 'i3rabAudioMap.json')

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(audio_map, f, ensure_ascii=False, indent=2)

    print(f"\nMapped {len(audio_map)} audio files")
    print(f"Total size: {total_size / (1024*1024):.1f} MB")
    print(f"Missing: {len(dict_keys) - len(audio_map)} entries have no audio")
    print(f"Saved to {output_file}")

    if unmatched:
        print(f"\nUnmatched Drive files: {len(unmatched)}")
        for name in unmatched[:5]:
            print(f"  {name}")

    # Show samples
    print("\nFirst 5 entries:")
    for key in list(audio_map.keys())[:5]:
        entry = audio_map[key]
        print(f"  {key} -> {entry['name']} ({entry['size'] // 1024} KB)")


if __name__ == '__main__':
    main()
