#!/usr/bin/env python3
"""
Map audio files from Google Drive folder using service account.
"""

import os
import json
from google.oauth2 import service_account
from googleapiclient.discovery import build

# Path to service account credentials
CREDENTIALS_FILE = os.path.join(os.path.dirname(__file__), '../assets/data/m3ajem-0ea9c5d1f227.json')
FOLDER_ID = os.environ.get('GOOGLE_DRIVE_FOLDER_ID', '1aIVlLbrhxWjNJ_CsVV2BS4P9s4LqOeHD')

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
            q=f"'{FOLDER_ID}' in parents",
            fields='nextPageToken, files(id, name, mimeType, size)',
            pageSize=1000,
            pageToken=page_token
        ).execute()

        files.extend(results.get('files', []))
        page_token = results.get('nextPageToken')

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
    print("Connecting to Google Drive...")

    try:
        service = get_drive_service()
    except Exception as e:
        print(f"Error connecting: {e}")
        print("\nMake sure google-api-python-client and google-auth are installed:")
        print("pip install google-api-python-client google-auth")
        return

    print("Fetching files from Google Drive...")
    files = list_files(service)

    if not files:
        print("No files found in folder")
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
        print(f"\nFirst 5 files:")
        for i in range(min(5, len(audio_files))):
            print(f"  {audio_files[i]['word']} - {audio_files[i]['name']}")

if __name__ == '__main__':
    main()
