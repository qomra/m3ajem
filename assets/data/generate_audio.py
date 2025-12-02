#!/usr/bin/env python3
"""
Audio generation script for M3ajem dictionary
Uses Google Gemini TTS API to generate audio for dictionary entries

Features:
- Sample generation with all available voices
- Full mofahras audio synthesis
- Two modes: Gemini API (daily limits) or Cloud TTS (no daily limits)
- Text preprocessing (removes [[]], chunks long texts)
- Audio stitching for long entries
- Random voice selection from curated list per root

Usage:
    python generate_audio.py --samples                  # Generate voice samples (9 selected)
    python generate_audio.py --samples-all              # Generate all 30 voice samples
    python generate_audio.py --mofahras                 # Gemini API (1000/day limit)
    python generate_audio.py --mofahras --voice Kore    # Use specific voice for all
    python generate_audio.py --cloud-tts                # Cloud TTS API (150/min, NO daily limit!)
    python generate_audio.py --cloud-tts --voice Kore -n 100

Requirements:
    pip install google-genai aiofiles google-cloud-texttospeech

Environment:
    GEMINI_API_KEY      - For --mofahras mode
    GOOGLE_CLOUD_PROJECT - For --cloud-tts mode (also needs gcloud auth)
"""

import base64
import json
import mimetypes
import os
import re
import struct
import argparse
import random
import asyncio
import aiofiles
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from google import genai
from google.genai import types

# Configuration
MODEL = "gemini-2.5-flash-preview-tts"
CLOUD_TTS_MODEL = "gemini-2.5-flash-tts"  # For Cloud TTS API
OUTPUT_DIR = Path(__file__).parent / "maajim" / "audio"
MOFAHRAS_PATH = Path(__file__).parent / "maajim" / "mofahras" / "resources.json"

# Maximum text length per chunk (in characters) - keep under 4000 bytes
MAX_CHUNK_LENGTH = 2000

# Concurrent processing settings
MAX_CONCURRENT_REQUESTS = 5  # Number of parallel requests
RATE_LIMIT_DELAY = 0.1  # Delay between requests (seconds) to avoid rate limiting

# All available Gemini TTS voices with their characteristics
ALL_VOICES = {
    "Zephyr": "Bright",
    "Puck": "Upbeat",
    "Charon": "Informative",
    "Kore": "Firm",
    "Fenrir": "Excitable",
    "Leda": "Youthful",
    "Orus": "Firm",
    "Aoede": "Breezy",
    "Callirrhoe": "Easy-going",
    "Autonoe": "Bright",
    "Enceladus": "Breathy",
    "Iapetus": "Clear",
    "Umbriel": "Easy-going",
    "Algieba": "Smooth",
    "Despina": "Smooth",
    "Erinome": "Clear",
    "Algenib": "Gravelly",
    "Rasalgethi": "Informative",
    "Laomedeia": "Upbeat",
    "Achernar": "Soft",
    "Alnilam": "Firm",
    "Schedar": "Even",
    "Gacrux": "Mature",
    "Pulcherrima": "Forward",
    "Achird": "Friendly",
    "Zubenelgenubi": "Casual",
    "Vindemiatrix": "Gentle",
    "Sadachbia": "Lively",
    "Sadaltager": "Knowledgeable",
    "Sulafat": "Warm",
}

# Selected voices for mofahras narration (randomly selected per root)
SELECTED_VOICES = [
    "Algenib",       # Gravelly
    "Algieba",       # Smooth
    "Charon",        # Informative
    "Iapetus",       # Clear
    "Kore",          # Firm
    "Laomedeia",     # Upbeat
    "Zephyr",        # Bright
    "Zubenelgenubi", # Casual
    "Sadaltager",    # Knowledgeable
]

# Sample Arabic text for voice testing
SAMPLE_TEXT = """كهن: الكاهنُ: مَعْرُوفٌ. كَهَنَ لَهُ يَكْهَنُ ويكهُنُ وكَهُنَ كَهانةً وتكَهَّنَ تكَهُّناً وتَكْهِيناً."""


def save_binary_file(file_path: Path, data: bytes):
    """Save binary data to a file"""
    file_path.parent.mkdir(parents=True, exist_ok=True)
    with open(file_path, "wb") as f:
        f.write(data)
    print(f"  ✓ Saved: {file_path}")


def convert_to_wav(audio_data: bytes, mime_type: str) -> bytes:
    """Convert raw audio data to WAV format with proper header"""
    parameters = parse_audio_mime_type(mime_type)
    bits_per_sample = parameters["bits_per_sample"]
    sample_rate = parameters["rate"]
    num_channels = 1
    data_size = len(audio_data)
    bytes_per_sample = bits_per_sample // 8
    block_align = num_channels * bytes_per_sample
    byte_rate = sample_rate * block_align
    chunk_size = 36 + data_size

    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        chunk_size,
        b"WAVE",
        b"fmt ",
        16,
        1,
        num_channels,
        sample_rate,
        byte_rate,
        block_align,
        bits_per_sample,
        b"data",
        data_size
    )
    return header + audio_data


def parse_audio_mime_type(mime_type: str) -> dict:
    """Parse bits per sample and rate from audio MIME type string"""
    bits_per_sample = 16
    rate = 24000

    parts = mime_type.split(";")
    for param in parts:
        param = param.strip()
        if param.lower().startswith("rate="):
            try:
                rate = int(param.split("=", 1)[1])
            except (ValueError, IndexError):
                pass
        elif param.startswith("audio/L"):
            try:
                bits_per_sample = int(param.split("L", 1)[1])
            except (ValueError, IndexError):
                pass

    return {"bits_per_sample": bits_per_sample, "rate": rate}


def preprocess_text(text: str) -> str:
    """
    Preprocess text for TTS:
    - Remove content between [[ and ]]
    - Clean up extra whitespace
    - Normalize newlines
    """
    # Remove content between [[ and ]]
    text = re.sub(r'\[\[.*?\]\]', '', text, flags=re.DOTALL)

    # Remove content between [ and ] as well (single brackets)
    text = re.sub(r'\[.*?\]', '', text, flags=re.DOTALL)

    # Clean up multiple spaces
    text = re.sub(r' +', ' ', text)

    # Clean up multiple newlines
    text = re.sub(r'\n+', '\n', text)

    # Strip whitespace
    text = text.strip()

    return text


def chunk_text(text: str, max_length: int = MAX_CHUNK_LENGTH) -> List[str]:
    """
    Split long text into chunks for TTS processing.
    Tries to split at sentence boundaries (periods, newlines).
    """
    if len(text) <= max_length:
        return [text]

    chunks = []
    current_chunk = ""

    # Split by sentences (Arabic uses different punctuation)
    sentences = re.split(r'([.،؛:\n])', text)

    for i in range(0, len(sentences), 2):
        sentence = sentences[i]
        # Add back the punctuation if exists
        if i + 1 < len(sentences):
            sentence += sentences[i + 1]

        if len(current_chunk) + len(sentence) <= max_length:
            current_chunk += sentence
        else:
            if current_chunk:
                chunks.append(current_chunk.strip())
            current_chunk = sentence

    if current_chunk:
        chunks.append(current_chunk.strip())

    # If any chunk is still too long, force split
    final_chunks = []
    for chunk in chunks:
        if len(chunk) > max_length:
            # Force split at max_length
            for i in range(0, len(chunk), max_length):
                final_chunks.append(chunk[i:i + max_length])
        else:
            final_chunks.append(chunk)

    return final_chunks


def generate_audio(client: genai.Client, text: str, voice_name: str) -> bytes:
    """
    Generate audio for given text using specified voice.
    Returns WAV audio data.
    """
    contents = [
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=text)],
        ),
    ]

    config = types.GenerateContentConfig(
        temperature=1,
        response_modalities=["audio"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name=voice_name
                )
            )
        ),
    )

    audio_chunks = []

    for chunk in client.models.generate_content_stream(
        model=MODEL,
        contents=contents,
        config=config,
    ):
        if (
            chunk.candidates is None
            or chunk.candidates[0].content is None
            or chunk.candidates[0].content.parts is None
        ):
            continue

        part = chunk.candidates[0].content.parts[0]
        if part.inline_data and part.inline_data.data:
            inline_data = part.inline_data
            data_buffer = inline_data.data

            # Convert to WAV if needed
            file_extension = mimetypes.guess_extension(inline_data.mime_type)
            if file_extension is None:
                data_buffer = convert_to_wav(inline_data.data, inline_data.mime_type)

            audio_chunks.append(data_buffer)

    # Combine all chunks
    if len(audio_chunks) == 1:
        return audio_chunks[0]
    else:
        return stitch_wav_files(audio_chunks)


async def generate_audio_async(client: genai.Client, text: str, voice_name: str) -> bytes:
    """
    Async version: Generate audio for given text using specified voice.
    Returns WAV audio data.
    """
    contents = [
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=text)],
        ),
    ]

    config = types.GenerateContentConfig(
        temperature=1,
        response_modalities=["audio"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name=voice_name
                )
            )
        ),
    )

    audio_chunks = []

    # Use async streaming
    async for chunk in await client.aio.models.generate_content_stream(
        model=MODEL,
        contents=contents,
        config=config,
    ):
        if (
            chunk.candidates is None
            or chunk.candidates[0].content is None
            or chunk.candidates[0].content.parts is None
        ):
            continue

        part = chunk.candidates[0].content.parts[0]
        if part.inline_data and part.inline_data.data:
            inline_data = part.inline_data
            data_buffer = inline_data.data

            # Convert to WAV if needed
            file_extension = mimetypes.guess_extension(inline_data.mime_type)
            if file_extension is None:
                data_buffer = convert_to_wav(inline_data.data, inline_data.mime_type)

            audio_chunks.append(data_buffer)

    # Combine all chunks
    if len(audio_chunks) == 1:
        return audio_chunks[0]
    else:
        return stitch_wav_files(audio_chunks)


async def save_binary_file_async(file_path: Path, data: bytes):
    """Async save binary data to a file"""
    file_path.parent.mkdir(parents=True, exist_ok=True)
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(data)


def stitch_wav_files(wav_chunks: List[bytes]) -> bytes:
    """
    Stitch multiple WAV files together into one.
    Assumes all files have the same format (sample rate, bits, channels).
    """
    if not wav_chunks:
        return b""

    if len(wav_chunks) == 1:
        return wav_chunks[0]

    # Parse first WAV to get format info
    first_wav = wav_chunks[0]

    # WAV header is 44 bytes, data starts after that
    # Extract audio data from each chunk (skip 44-byte header)
    all_audio_data = b""
    for wav in wav_chunks:
        if len(wav) > 44:
            all_audio_data += wav[44:]

    # Rebuild WAV with combined data
    # Get format info from first file
    sample_rate = struct.unpack("<I", first_wav[24:28])[0]
    bits_per_sample = struct.unpack("<H", first_wav[34:36])[0]

    return convert_to_wav(all_audio_data, f"audio/L{bits_per_sample};rate={sample_rate}")


# ============================================================================
# Cloud TTS API Functions (150 RPM, NO daily limit)
# ============================================================================

def generate_audio_cloud_tts(client, text: str, voice_name: str) -> bytes:
    """
    Generate audio using Google Cloud TTS API with Gemini voices.
    Returns WAV audio data for better quality.
    """
    from google.cloud import texttospeech

    # Add prompt for better narration style
    synthesis_input = texttospeech.SynthesisInput(
        text=text,
        prompt="Read this Arabic dictionary definition clearly and naturally, with proper pronunciation and a scholarly tone."
    )

    voice = texttospeech.VoiceSelectionParams(
        language_code="ar-EG",  # Arabic (Egypt) - supported by Gemini TTS
        name=voice_name,
        model_name=CLOUD_TTS_MODEL
    )

    # Use LINEAR16 (WAV) for better quality, higher sample rate
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.LINEAR16,
        sample_rate_hertz=24000
    )

    response = client.synthesize_speech(
        input=synthesis_input, voice=voice, audio_config=audio_config
    )

    return response.audio_content


def generate_mofahras_cloud_tts(voice_name: str = None, limit: int = None):
    """
    Generate audio using Google Cloud TTS API.
    NO daily limits - 150 requests per minute.
    """
    try:
        from google.cloud import texttospeech
    except ImportError:
        print("Error: google-cloud-texttospeech not installed")
        print("Run: pip install google-cloud-texttospeech")
        return

    print("=" * 60)
    print("GENERATING MOFAHRAS AUDIO (Cloud TTS - NO daily limit!)")
    print("=" * 60)
    if voice_name:
        print(f"Voice: {voice_name} (fixed)")
    else:
        print(f"Voices: Random selection from {len(SELECTED_VOICES)} voices")
        print(f"  {', '.join(SELECTED_VOICES)}")
    print(f"Output directory: {OUTPUT_DIR}")
    print(f"Rate limit: 150 requests/minute (no daily cap)")
    print("=" * 60)

    client = texttospeech.TextToSpeechClient()

    # Get all entries
    entries = get_mofahras_entries()
    print(f"Total entries: {len(entries)}")

    # Filter out entries that already have audio files (check both .wav and .mp3)
    pending_entries = []
    existing_count = 0
    for entry in entries:
        dict_name = entry["dictionary_name"]
        root = entry["root"]
        output_wav = OUTPUT_DIR / dict_name / f"{root}.wav"
        output_mp3 = OUTPUT_DIR / dict_name / f"{root}.mp3"

        if output_wav.exists() or output_mp3.exists():
            existing_count += 1
        else:
            pending_entries.append(entry)

    print(f"Already generated: {existing_count}")
    print(f"Pending entries: {len(pending_entries)}")

    # Apply limit if specified
    if limit and limit < len(pending_entries):
        pending_entries = pending_entries[:limit]
        print(f"Limited to: {limit} entries")

    print("=" * 60)

    if not pending_entries:
        print("✓ All entries already processed!")
        return

    total_processed = 0
    total_errors = 0

    for i, entry in enumerate(pending_entries, 1):
        root = entry["root"]
        dict_name = entry["dictionary_name"]
        output_file = OUTPUT_DIR / dict_name / f"{root}.wav"

        # Preprocess text
        text = preprocess_text(entry["definition"])

        if not text:
            print(f"[{i}/{len(pending_entries)}] {root}: empty text, skipping")
            continue

        # Select voice
        selected_voice = voice_name if voice_name else get_random_voice(root)

        # Chunk if needed
        chunks = chunk_text(text)

        print(f"[{i}/{len(pending_entries)}] {root} [{selected_voice}] {len(text)} chars, {len(chunks)} chunk(s)...", end=" ", flush=True)

        try:
            if len(chunks) == 1:
                raw_audio = generate_audio_cloud_tts(client, chunks[0], selected_voice)
                # Add WAV header to raw PCM data
                audio_data = convert_to_wav(raw_audio, "audio/L16;rate=24000")
            else:
                # Multiple chunks - generate and stitch WAV files
                audio_parts = []
                for j, chunk in enumerate(chunks, 1):
                    print(f"chunk {j}/{len(chunks)}...", end=" ", flush=True)
                    chunk_audio = generate_audio_cloud_tts(client, chunk, selected_voice)
                    # Add WAV header to raw PCM data
                    wav_chunk = convert_to_wav(chunk_audio, "audio/L16;rate=24000")
                    audio_parts.append(wav_chunk)
                # Stitch WAV files properly
                audio_data = stitch_wav_files(audio_parts)

            # Save file
            output_file.parent.mkdir(parents=True, exist_ok=True)
            with open(output_file, "wb") as f:
                f.write(audio_data)

            print("✓")
            total_processed += 1

        except Exception as e:
            print(f"✗ {e}")
            total_errors += 1

        # Progress update every 50 entries
        if i % 50 == 0:
            print(f"\n   📊 Progress: {existing_count + total_processed}/{len(entries)} ({100*(existing_count + total_processed)/len(entries):.1f}%)\n")

    print("\n" + "=" * 60)
    print(f"COMPLETE!")
    print(f"  Processed this run: {total_processed}")
    print(f"  Errors: {total_errors}")
    print(f"  Total files: {existing_count + total_processed}/{len(entries)}")
    print("=" * 60)


def generate_voice_samples(voices_to_generate: List[str] = None):
    """
    Generate audio samples with specified voices (or all available voices).
    Saves to OUTPUT_DIR/samples/
    """
    voices = {k: v for k, v in ALL_VOICES.items() if k in voices_to_generate} if voices_to_generate else ALL_VOICES

    print("=" * 60)
    print("GENERATING VOICE SAMPLES")
    print("=" * 60)
    print(f"Sample text: {SAMPLE_TEXT[:50]}...")
    print(f"Output directory: {OUTPUT_DIR / 'samples'}")
    print(f"Total voices: {len(voices)}")
    print("=" * 60)

    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
    samples_dir = OUTPUT_DIR / "samples"
    samples_dir.mkdir(parents=True, exist_ok=True)

    for i, (voice_name, characteristic) in enumerate(voices.items(), 1):
        output_file = samples_dir / f"{voice_name}_{characteristic}.wav"

        # Skip if already exists
        if output_file.exists():
            print(f"[{i}/{len(voices)}] {voice_name} ({characteristic}) - Already exists, skipping")
            continue

        print(f"[{i}/{len(voices)}] Generating: {voice_name} ({characteristic})...")

        try:
            audio_data = generate_audio(client, SAMPLE_TEXT, voice_name)
            save_binary_file(output_file, audio_data)
        except Exception as e:
            print(f"  ✗ Error: {e}")

    print("\n✓ Voice samples generation complete!")


def get_mofahras_entries() -> List[Dict]:
    """
    Load mofahras entries from resources.json.
    Returns list of {root, dictionary_name, definition}
    """
    if not MOFAHRAS_PATH.exists():
        print(f"Mofahras file not found at {MOFAHRAS_PATH}")
        return []

    with open(MOFAHRAS_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    dictionary_name = data.get("name", "mofahras")
    roots_data = data.get("data", {})

    entries = []
    for root, definition in roots_data.items():
        if definition:  # Skip empty definitions
            entries.append({
                "root": root,
                "dictionary_name": dictionary_name,
                "definition": definition
            })

    return entries


def get_random_voice(root: str) -> str:
    """
    Get a deterministic random voice based on root string.
    Uses hash of root to ensure same root always gets same voice.
    """
    # Use hash of root for deterministic randomness
    random.seed(hash(root))
    voice = random.choice(SELECTED_VOICES)
    random.seed()  # Reset seed
    return voice


def generate_mofahras_audio(voice_name: str = None):
    """
    Generate audio for the entire mofahras dictionary.
    Supports checkpoint/resume.

    Args:
        voice_name: If specified, use this voice for all entries.
                   If None, randomly select from SELECTED_VOICES per root.
    """
    print("=" * 60)
    print("GENERATING MOFAHRAS AUDIO")
    print("=" * 60)
    if voice_name:
        print(f"Voice: {voice_name} (fixed)")
    else:
        print(f"Voices: Random selection from {len(SELECTED_VOICES)} voices")
        print(f"  {', '.join(SELECTED_VOICES)}")
    print(f"Output directory: {OUTPUT_DIR}")
    print("=" * 60)

    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

    # Load checkpoint
    checkpoint = load_checkpoint()
    completed = set(checkpoint.get("completed_roots", []))

    print(f"Checkpoint loaded: {len(completed)} entries already completed")

    # Get all entries
    entries = get_mofahras_entries()
    print(f"Total entries in database: {len(entries)}")

    # Group by dictionary
    by_dictionary = {}
    for entry in entries:
        dict_name = entry["dictionary_name"]
        if dict_name not in by_dictionary:
            by_dictionary[dict_name] = []
        by_dictionary[dict_name].append(entry)

    print(f"Dictionaries: {len(by_dictionary)}")
    print("=" * 60)

    total_processed = 0
    total_skipped = 0

    for dict_name, dict_entries in by_dictionary.items():
        print(f"\n📖 Dictionary: {dict_name}")
        print(f"   Entries: {len(dict_entries)}")

        # Create directory for this dictionary
        dict_dir = OUTPUT_DIR / dict_name
        dict_dir.mkdir(parents=True, exist_ok=True)

        for entry in dict_entries:
            root = entry["root"]
            unique_key = f"{dict_name}:{root}"

            # Skip if already completed
            if unique_key in completed:
                total_skipped += 1
                continue

            output_file = dict_dir / f"{root}.wav"

            # Also skip if file exists (extra safety)
            if output_file.exists():
                completed.add(unique_key)
                total_skipped += 1
                continue

            # Preprocess text
            text = preprocess_text(entry["definition"])

            if not text:
                print(f"   ⚠️ Empty text for root: {root}")
                completed.add(unique_key)
                continue

            # Select voice for this root (same voice for all chunks)
            selected_voice = voice_name if voice_name else get_random_voice(root)

            # Chunk if needed
            chunks = chunk_text(text)

            print(f"   🔊 {root} [{selected_voice}] ({len(text)} chars, {len(chunks)} chunks)...", end=" ")

            try:
                if len(chunks) == 1:
                    # Single chunk - direct generation
                    audio_data = generate_audio(client, chunks[0], selected_voice)
                else:
                    # Multiple chunks - generate and stitch (same voice for all)
                    audio_parts = []
                    for i, chunk in enumerate(chunks):
                        chunk_audio = generate_audio(client, chunk, selected_voice)
                        audio_parts.append(chunk_audio)
                    audio_data = stitch_wav_files(audio_parts)

                save_binary_file(output_file, audio_data)

                # Update checkpoint
                completed.add(unique_key)
                checkpoint["completed_roots"] = list(completed)
                checkpoint["last_dictionary"] = dict_name
                save_checkpoint(checkpoint)

                total_processed += 1
                print("✓")

            except Exception as e:
                print(f"✗ Error: {e}")

    print("\n" + "=" * 60)
    print(f"COMPLETE!")
    print(f"  Processed: {total_processed}")
    print(f"  Skipped (already done): {total_skipped}")
    print("=" * 60)


async def process_entry_async(
    client: genai.Client,
    entry: Dict,
    voice_name: Optional[str],
    output_dir: Path,
    semaphore: asyncio.Semaphore,
    entry_num: int,
    total_entries: int
) -> Tuple[str, bool, Optional[str]]:
    """
    Process a single entry asynchronously.
    Returns (unique_key, success, error_message)
    """
    async with semaphore:
        root = entry["root"]
        dict_name = entry["dictionary_name"]
        unique_key = f"{dict_name}:{root}"
        output_file = output_dir / dict_name / f"{root}.wav"

        # Preprocess text
        text = preprocess_text(entry["definition"])

        if not text:
            print(f"   [{entry_num}/{total_entries}] {root}: empty text, skipping")
            return (unique_key, True, "empty")

        # Select voice for this root
        selected_voice = voice_name if voice_name else get_random_voice(root)

        # Chunk if needed
        chunks = chunk_text(text)

        print(f"   [{entry_num}/{total_entries}] {root} [{selected_voice}] {len(text)} chars, {len(chunks)} chunk(s)...", end=" ", flush=True)

        try:
            # Small delay to avoid rate limiting
            await asyncio.sleep(RATE_LIMIT_DELAY)

            if len(chunks) == 1:
                audio_data = await generate_audio_async(client, chunks[0], selected_voice)
            else:
                # Multiple chunks - generate sequentially and stitch
                audio_parts = []
                for i, chunk in enumerate(chunks, 1):
                    print(f"chunk {i}/{len(chunks)}...", end=" ", flush=True)
                    chunk_audio = await generate_audio_async(client, chunk, selected_voice)
                    audio_parts.append(chunk_audio)
                audio_data = stitch_wav_files(audio_parts)

            # Save file
            output_file.parent.mkdir(parents=True, exist_ok=True)
            await save_binary_file_async(output_file, audio_data)

            print("✓")
            return (unique_key, True, None)

        except Exception as e:
            print(f"✗ {e}")
            return (unique_key, False, str(e))


async def generate_mofahras_audio_async(voice_name: str = None, max_concurrent: int = MAX_CONCURRENT_REQUESTS, limit: int = None):
    """
    Generate audio for the entire mofahras dictionary using async concurrent processing.
    Skips entries that already have audio files.

    Args:
        voice_name: If specified, use this voice for all entries.
                   If None, randomly select from SELECTED_VOICES per root.
        max_concurrent: Maximum number of concurrent API requests.
        limit: If specified, only process this many entries (for testing).
    """
    print("=" * 60)
    print("GENERATING MOFAHRAS AUDIO (ASYNC)")
    print("=" * 60)
    if voice_name:
        print(f"Voice: {voice_name} (fixed)")
    else:
        print(f"Voices: Random selection from {len(SELECTED_VOICES)} voices")
        print(f"  {', '.join(SELECTED_VOICES)}")
    print(f"Output directory: {OUTPUT_DIR}")
    print(f"Concurrent requests: {max_concurrent}")
    print("=" * 60)

    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

    # Get all entries
    entries = get_mofahras_entries()
    print(f"Total entries: {len(entries)}")

    # Filter out entries that already have audio files
    pending_entries = []
    existing_count = 0
    for entry in entries:
        dict_name = entry["dictionary_name"]
        root = entry["root"]
        output_file = OUTPUT_DIR / dict_name / f"{root}.wav"

        if output_file.exists():
            existing_count += 1
        else:
            pending_entries.append(entry)

    print(f"Already generated: {existing_count}")
    print(f"Pending entries: {len(pending_entries)}")

    # Apply limit if specified
    if limit and limit < len(pending_entries):
        pending_entries = pending_entries[:limit]
        print(f"Limited to: {limit} entries")

    print("=" * 60)

    if not pending_entries:
        print("✓ All entries already processed!")
        return

    # Create semaphore for rate limiting
    semaphore = asyncio.Semaphore(max_concurrent)

    # Process in batches for progress tracking and checkpoint saving
    batch_size = 100
    total_processed = 0
    total_errors = 0

    for batch_start in range(0, len(pending_entries), batch_size):
        batch = pending_entries[batch_start:batch_start + batch_size]
        batch_num = batch_start // batch_size + 1
        total_batches = (len(pending_entries) + batch_size - 1) // batch_size

        print(f"\n📦 Batch {batch_num}/{total_batches} ({len(batch)} entries)...")

        # Create tasks for this batch
        tasks = [
            process_entry_async(client, entry, voice_name, OUTPUT_DIR, semaphore,
                               batch_start + i + 1, len(pending_entries))
            for i, entry in enumerate(batch)
        ]

        # Run batch concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results
        batch_success = 0
        batch_errors = 0
        for result in results:
            if isinstance(result, Exception):
                batch_errors += 1
                print(f"   ✗ Exception: {result}")
            else:
                unique_key, success, error = result
                if success:
                    batch_success += 1
                else:
                    batch_errors += 1

        total_processed += batch_success
        total_errors += batch_errors

        print(f"\n   📊 Batch done: {batch_success} ok, {batch_errors} errors | Total: {existing_count + total_processed}/{len(entries)} ({100*(existing_count + total_processed)/len(entries):.1f}%)")

    print("\n" + "=" * 60)
    print(f"COMPLETE!")
    print(f"  Processed this run: {total_processed}")
    print(f"  Errors: {total_errors}")
    print(f"  Total files: {existing_count + total_processed}/{len(entries)}")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(
        description="Generate audio for M3ajem dictionary using Google Gemini TTS"
    )
    parser.add_argument(
        "--samples",
        action="store_true",
        help="Generate voice samples with selected voices"
    )
    parser.add_argument(
        "--samples-all",
        action="store_true",
        help="Generate voice samples with ALL available voices (30 voices)"
    )
    parser.add_argument(
        "--mofahras",
        action="store_true",
        help="Generate audio for the entire mofahras dictionary (async concurrent)"
    )
    parser.add_argument(
        "--mofahras-sync",
        action="store_true",
        help="Generate audio for mofahras dictionary (sequential, slower)"
    )
    parser.add_argument(
        "--cloud-tts",
        action="store_true",
        help="Use Google Cloud TTS API (150 RPM, NO daily limit!)"
    )
    parser.add_argument(
        "--voice",
        type=str,
        default=None,
        help=f"Voice to use for mofahras (default: random from selected). Available: {', '.join(SELECTED_VOICES)}"
    )
    parser.add_argument(
        "--concurrent",
        type=int,
        default=MAX_CONCURRENT_REQUESTS,
        help=f"Number of concurrent requests for async mode (default: {MAX_CONCURRENT_REQUESTS})"
    )
    parser.add_argument(
        "-n", "--limit",
        type=int,
        default=None,
        help="Limit number of entries to generate (for testing)"
    )

    args = parser.parse_args()

    # Check for API key (not needed for cloud-tts)
    if not args.cloud_tts and not os.environ.get("GEMINI_API_KEY"):
        print("Error: GEMINI_API_KEY environment variable not set")
        print("Set it with: export GEMINI_API_KEY='your-api-key'")
        return

    if args.cloud_tts:
        # Use Google Cloud TTS (no daily limits)
        if args.voice and args.voice not in SELECTED_VOICES:
            print(f"Error: Unknown voice '{args.voice}'")
            print(f"Available voices: {', '.join(SELECTED_VOICES)}")
            return
        generate_mofahras_cloud_tts(args.voice, args.limit)
    elif args.samples:
        # Generate samples for selected voices only
        generate_voice_samples(SELECTED_VOICES)
    elif args.samples_all:
        # Generate samples for all voices
        generate_voice_samples()
    elif args.mofahras:
        if args.voice and args.voice not in SELECTED_VOICES:
            print(f"Error: Unknown voice '{args.voice}'")
            print(f"Available voices: {', '.join(SELECTED_VOICES)}")
            return
        # Run async version
        asyncio.run(generate_mofahras_audio_async(args.voice, args.concurrent, args.limit))
    elif args.mofahras_sync:
        if args.voice and args.voice not in SELECTED_VOICES:
            print(f"Error: Unknown voice '{args.voice}'")
            print(f"Available voices: {', '.join(SELECTED_VOICES)}")
            return
        # Run sync version
        generate_mofahras_audio(args.voice)
    else:
        parser.print_help()
        print("\n" + "=" * 60)
        print("Selected voices for mofahras:")
        for voice in SELECTED_VOICES:
            print(f"  - {voice} ({ALL_VOICES[voice]})")
        print("=" * 60)
        print(f"\nAsync mode uses {MAX_CONCURRENT_REQUESTS} concurrent requests by default.")
        print("Adjust with --concurrent flag.")


if __name__ == "__main__":
    main()
