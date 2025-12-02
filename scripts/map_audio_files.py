#!/usr/bin/env python3
"""
Map audio files from Google Drive folder.
"""

import os
import json
import requests

FOLDER_ID = '1aIVlLbrhxWjNJ_CsVV2BS4P9s4LqOeHD'
API_KEY = 'REMOVED_API_KEY'

def list_files():
    """List files using Drive API."""
    files = []
    page_token = None

    while True:
        url = 'https://www.googleapis.com/drive/v3/files'
        params = {
            'q': f"'{FOLDER_ID}' in parents",
            'key': API_KEY,
            'fields': 'nextPageToken, files(id, name, mimeType, size)',
            'pageSize': 1000
        }

        if page_token:
            params['pageToken'] = page_token

        response = requests.get(url, params=params)

        if response.status_code != 200:
            print(f"Error: {response.status_code}")
            print(f"Response: {response.text}")
            print("\nYou need to enable Google Drive API:")
            print("https://console.cloud.google.com/apis/library/drive.googleapis.com")
            return []

        data = response.json()
        files.extend(data.get('files', []))
        page_token = data.get('nextPageToken')

        if not page_token:
            break

    return files

def extract_word_from_filename(filename):
    """Extract word from filename."""
    name = os.path.splitext(filename)[0]
    parts = name.split('_')
    if len(parts) > 1 and parts[0].isdigit():
        return '_'.join(parts[1:]).strip()
    return name.strip()

def main():
    print("Fetching files from Google Drive...")
    files = list_files()

    if not files:
        return

    print(f"Found {len(files)} files")

    # Filter audio files
    audio_map = {}
    audio_files = []
    total_size = 0

    for file in files:
        name = file['name']
        if name.endswith(('.mp3', '.wav', '.m4a', '.aac', '.ogg', '.MP3', '.WAV')):
            word = extract_word_from_filename(name)
            size = int(file.get('size', 0))
            total_size += size

            file_info = {
                'id': file['id'],
                'name': name,
                'url': f"https://drive.google.com/uc?export=download&id={file['id']}",
                'size': size,
                'mimeType': file.get('mimeType', '')
            }

            audio_map[word] = file_info
            audio_files.append({'word': word, **file_info})

    audio_files.sort(key=lambda x: x['word'])

    # Save
    output_dir = '../src/data'
    os.makedirs(output_dir, exist_ok=True)

    with open(f'{output_dir}/audioMap.json', 'w', encoding='utf-8') as f:
        json.dump(audio_map, f, ensure_ascii=False, indent=2)

    with open(f'{output_dir}/audioFiles.json', 'w', encoding='utf-8') as f:
        json.dump(audio_files, f, ensure_ascii=False, indent=2)

    print(f"\n✓ Mapped {len(audio_map)} audio files")
    print(f"✓ Total size: {total_size / (1024*1024):.2f} MB")
    print(f"✓ Saved to {output_dir}/")

    if audio_files:
        print(f"\nFirst 3 files:")
        for i in range(min(3, len(audio_files))):
            print(f"  {audio_files[i]['word']} - {audio_files[i]['name']}")

if __name__ == '__main__':
    main()
