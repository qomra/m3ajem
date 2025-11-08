# Audio Files Mapping Script

This script maps audio files from Google Drive to the indexed words.

## Setup

### 1. Install Python dependencies

```bash
pip install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client
```

### 2. Set up Google Drive API credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable Google Drive API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Drive API"
   - Click "Enable"
4. Create credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Desktop app"
   - Download the JSON file
   - Save it as `credentials.json` in the `scripts/` folder

### 3. Make the folder publicly accessible (IMPORTANT)

For the audio files to be streamable/downloadable in the app:

1. Go to your Google Drive folder
2. Right-click > Share > Change to "Anyone with the link"
3. Set permission to "Viewer"

OR keep private and we'll implement proper Drive API in the app.

## Usage

```bash
cd scripts
python map_audio_files.py
```

This will:
1. Authenticate with Google (opens browser first time)
2. List all files in the Drive folder
3. Create two JSON files in `src/data/`:
   - `audioMap.json` - Object mapping word -> file info
   - `audioFiles.json` - Array of all audio files

## Output Format

### audioMap.json
```json
{
  "كلمة": {
    "id": "1abc...",
    "name": "كلمة.mp3",
    "url": "https://drive.google.com/uc?export=download&id=1abc...",
    "size": 123456,
    "mimeType": "audio/mpeg"
  }
}
```

### audioFiles.json
```json
[
  {
    "word": "كلمة",
    "id": "1abc...",
    "name": "كلمة.mp3",
    "url": "https://drive.google.com/uc?export=download&id=1abc...",
    "size": 123456,
    "mimeType": "audio/mpeg"
  }
]
```

## Notes

- The script filters only audio files (mp3, wav, m4a, aac, ogg)
- File names should match the words in المفهرس
- The `extract_word_from_filename()` function may need adjustment based on your actual filename format
