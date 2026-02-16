#!/usr/bin/env python3
"""
Audio generation script for إعراب القرآن وبيانه
Uses Google Gemini TTS API to generate audio for Quranic grammar entries.

Uses the إعراب-only extracted version (stripped of البلاغة، الفوائد، اللغة).

Features:
- Async concurrent generation
- Cloud TTS mode (150 RPM, no daily limit)
- Gemini API mode (daily limits)
- Text preprocessing and chunking
- Audio stitching for long entries
- Deterministic voice selection per entry from 4 curated voices

Usage:
    python generate_i3rab_audio.py --cloud-tts                # Cloud TTS (recommended)
    python generate_i3rab_audio.py --cloud-tts --voice Charon  # Fixed voice
    python generate_i3rab_audio.py --cloud-tts -n 10           # Test with 10 entries
    python generate_i3rab_audio.py --gemini                    # Gemini API
    python generate_i3rab_audio.py --samples                   # Generate voice samples

Requirements:
    pip install google-genai aiofiles google-cloud-texttospeech

Environment:
    GEMINI_API_KEY       - For --gemini mode
    GOOGLE_CLOUD_PROJECT - For --cloud-tts mode (also needs gcloud auth)
"""

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
CLOUD_TTS_MODEL = "gemini-2.5-flash-tts"

# Paths
INPUT_FILE = Path(__file__).parent / "scripts" / "إعراب القرآن (إعراب فقط).json"
OUTPUT_DIR = Path(__file__).parent / "maajim" / "audio" / "i3rab_quran"

# Maximum text length per chunk (in characters)
MAX_CHUNK_LENGTH = 2000

# Concurrent processing settings
MAX_CONCURRENT_REQUESTS = 5
RATE_LIMIT_DELAY = 0.1

# Selected voices for إعراب narration
SELECTED_VOICES = [
    "Algenib",      # Smooth
    "Charon",       # Informative
    "Enceladus",    # Breathy
    "Sadachbia",    # Lively
]

# Sample text for voice testing
SAMPLE_TEXT = """(بِسْمِ) جار ومجرور متعلقان بمحذوف والباء هنا للاستعانة أو للالصاق، وتقدير المحذوف أبتديء فالجار والمجرور في محل نصب مفعول به مقدم."""


def convert_to_wav(audio_data: bytes, mime_type: str) -> bytes:
    """Convert raw audio data to WAV format with proper header."""
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
        b"RIFF", chunk_size, b"WAVE", b"fmt ", 16, 1,
        num_channels, sample_rate, byte_rate, block_align,
        bits_per_sample, b"data", data_size
    )
    return header + audio_data


def parse_audio_mime_type(mime_type: str) -> dict:
    """Parse bits per sample and rate from audio MIME type string."""
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
    """Preprocess text for TTS."""
    # Remove content between [[ and ]] or [ and ]
    text = re.sub(r'\[\[.*?\]\]', '', text, flags=re.DOTALL)
    text = re.sub(r'\[.*?\]', '', text, flags=re.DOTALL)

    # Clean up whitespace
    text = re.sub(r' +', ' ', text)
    text = re.sub(r'\n+', '\n', text)

    return text.strip()


def chunk_text(text: str, max_length: int = MAX_CHUNK_LENGTH) -> List[str]:
    """Split long text into chunks at sentence boundaries."""
    if len(text) <= max_length:
        return [text]

    chunks = []
    current_chunk = ""

    sentences = re.split(r'([.،؛:\n])', text)

    for i in range(0, len(sentences), 2):
        sentence = sentences[i]
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

    # Force split chunks that are still too long
    final_chunks = []
    for chunk in chunks:
        if len(chunk) > max_length:
            for i in range(0, len(chunk), max_length):
                final_chunks.append(chunk[i:i + max_length])
        else:
            final_chunks.append(chunk)

    return final_chunks


def stitch_wav_files(wav_chunks: List[bytes]) -> bytes:
    """Stitch multiple WAV files together into one."""
    if not wav_chunks:
        return b""
    if len(wav_chunks) == 1:
        return wav_chunks[0]

    all_audio_data = b""
    for wav in wav_chunks:
        if len(wav) > 44:
            all_audio_data += wav[44:]

    first_wav = wav_chunks[0]
    sample_rate = struct.unpack("<I", first_wav[24:28])[0]
    bits_per_sample = struct.unpack("<H", first_wav[34:36])[0]

    return convert_to_wav(all_audio_data, f"audio/L{bits_per_sample};rate={sample_rate}")


def get_random_voice(key: str) -> str:
    """Get a deterministic random voice based on entry key."""
    random.seed(hash(key))
    voice = random.choice(SELECTED_VOICES)
    random.seed()
    return voice


def get_entries() -> List[Dict]:
    """Load entries from the إعراب-only JSON."""
    if not INPUT_FILE.exists():
        print(f"Error: {INPUT_FILE} not found.")
        print("Run extract_i3rab.py first.")
        return []

    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    entries = []
    for key, definition in data.get("data", {}).items():
        if definition:
            entries.append({
                "key": key,
                "definition": definition,
            })

    return entries


def sanitize_filename(key: str) -> str:
    """Convert entry key to a safe filename."""
    # Replace / with _
    name = key.replace(' / ', '_').replace('/', '_')
    # Remove characters that are problematic in filenames
    name = re.sub(r'[<>:"|?*]', '', name)
    return name


# ============================================================================
# Gemini API (async)
# ============================================================================

async def generate_audio_async(client: genai.Client, text: str, voice_name: str) -> bytes:
    """Generate audio using Gemini API (async streaming)."""
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

    async for chunk in await client.aio.models.generate_content_stream(
        model=MODEL, contents=contents, config=config,
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

            file_extension = mimetypes.guess_extension(inline_data.mime_type)
            if file_extension is None:
                data_buffer = convert_to_wav(inline_data.data, inline_data.mime_type)

            audio_chunks.append(data_buffer)

    if len(audio_chunks) == 1:
        return audio_chunks[0]
    else:
        return stitch_wav_files(audio_chunks)


async def process_entry_async(
    client: genai.Client,
    entry: Dict,
    voice_name: Optional[str],
    semaphore: asyncio.Semaphore,
    entry_num: int,
    total_entries: int,
) -> Tuple[str, bool, Optional[str]]:
    """Process a single entry asynchronously."""
    async with semaphore:
        key = entry["key"]
        filename = sanitize_filename(key)
        output_file = OUTPUT_DIR / f"{filename}.wav"

        text = preprocess_text(entry["definition"])
        if not text:
            print(f"   [{entry_num}/{total_entries}] {key}: empty text, skipping")
            return (key, True, "empty")

        selected_voice = voice_name if voice_name else get_random_voice(key)
        chunks = chunk_text(text)

        print(f"   [{entry_num}/{total_entries}] {key} [{selected_voice}] {len(text)} chars, {len(chunks)} chunk(s)...", end=" ", flush=True)

        try:
            await asyncio.sleep(RATE_LIMIT_DELAY)

            if len(chunks) == 1:
                audio_data = await generate_audio_async(client, chunks[0], selected_voice)
            else:
                audio_parts = []
                for i, chunk in enumerate(chunks, 1):
                    print(f"chunk {i}/{len(chunks)}...", end=" ", flush=True)
                    chunk_audio = await generate_audio_async(client, chunk, selected_voice)
                    audio_parts.append(chunk_audio)
                audio_data = stitch_wav_files(audio_parts)

            output_file.parent.mkdir(parents=True, exist_ok=True)
            async with aiofiles.open(output_file, "wb") as f:
                await f.write(audio_data)

            print("✓")
            return (key, True, None)

        except Exception as e:
            print(f"✗ {e}")
            return (key, False, str(e))


async def generate_gemini_async(voice_name: str = None, max_concurrent: int = MAX_CONCURRENT_REQUESTS, limit: int = None):
    """Generate audio using Gemini API (async concurrent)."""
    print("=" * 60)
    print("GENERATING إعراب القرآن AUDIO (Gemini API - Async)")
    print("=" * 60)
    if voice_name:
        print(f"Voice: {voice_name} (fixed)")
    else:
        print(f"Voices: Random from {', '.join(SELECTED_VOICES)}")
    print(f"Output: {OUTPUT_DIR}")
    print(f"Concurrent: {max_concurrent}")
    print("=" * 60)

    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

    entries = get_entries()
    print(f"Total entries: {len(entries)}")

    # Filter already generated
    pending = []
    existing = 0
    for entry in entries:
        filename = sanitize_filename(entry["key"])
        if (OUTPUT_DIR / f"{filename}.wav").exists() or (OUTPUT_DIR / f"{filename}.mp3").exists():
            existing += 1
        else:
            pending.append(entry)

    print(f"Already generated: {existing}")
    print(f"Pending: {len(pending)}")

    if limit and limit < len(pending):
        pending = pending[:limit]
        print(f"Limited to: {limit}")

    if not pending:
        print("✓ All entries already processed!")
        return

    semaphore = asyncio.Semaphore(max_concurrent)
    batch_size = 100
    total_processed = 0
    total_errors = 0

    for batch_start in range(0, len(pending), batch_size):
        batch = pending[batch_start:batch_start + batch_size]
        batch_num = batch_start // batch_size + 1
        total_batches = (len(pending) + batch_size - 1) // batch_size

        print(f"\n📦 Batch {batch_num}/{total_batches} ({len(batch)} entries)...")

        tasks = [
            process_entry_async(client, entry, voice_name, semaphore,
                                batch_start + i + 1, len(pending))
            for i, entry in enumerate(batch)
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        batch_ok = sum(1 for r in results if not isinstance(r, Exception) and r[1])
        batch_err = len(results) - batch_ok
        total_processed += batch_ok
        total_errors += batch_err

        print(f"\n   📊 Batch: {batch_ok} ok, {batch_err} errors | Total: {existing + total_processed}/{len(entries)} ({100*(existing + total_processed)/len(entries):.1f}%)")

    print("\n" + "=" * 60)
    print(f"COMPLETE! Processed: {total_processed} | Errors: {total_errors}")
    print(f"Total files: {existing + total_processed}/{len(entries)}")
    print("=" * 60)


# ============================================================================
# Cloud TTS API (150 RPM, no daily limit)
# ============================================================================

def generate_audio_cloud_tts(client, text: str, voice_name: str) -> bytes:
    """Generate audio using Google Cloud TTS API."""
    from google.cloud import texttospeech

    synthesis_input = texttospeech.SynthesisInput(
        text=text,
        prompt="Read this Arabic Quranic grammatical analysis clearly and naturally, with proper pronunciation and a scholarly tone."
    )

    voice = texttospeech.VoiceSelectionParams(
        language_code="ar-EG",
        name=voice_name,
        model_name=CLOUD_TTS_MODEL
    )

    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.LINEAR16,
        sample_rate_hertz=24000
    )

    response = client.synthesize_speech(
        input=synthesis_input, voice=voice, audio_config=audio_config
    )

    return response.audio_content


def generate_cloud_tts(voice_name: str = None, limit: int = None):
    """Generate audio using Cloud TTS (no daily limit)."""
    try:
        from google.cloud import texttospeech
    except ImportError:
        print("Error: google-cloud-texttospeech not installed")
        print("Run: pip install google-cloud-texttospeech")
        return

    print("=" * 60)
    print("GENERATING إعراب القرآن AUDIO (Cloud TTS)")
    print("=" * 60)
    if voice_name:
        print(f"Voice: {voice_name} (fixed)")
    else:
        print(f"Voices: Random from {', '.join(SELECTED_VOICES)}")
    print(f"Output: {OUTPUT_DIR}")
    print(f"Rate limit: 150 RPM (no daily cap)")
    print("=" * 60)

    client = texttospeech.TextToSpeechClient()

    entries = get_entries()
    print(f"Total entries: {len(entries)}")

    # Filter already generated
    pending = []
    existing = 0
    for entry in entries:
        filename = sanitize_filename(entry["key"])
        if (OUTPUT_DIR / f"{filename}.wav").exists() or (OUTPUT_DIR / f"{filename}.mp3").exists():
            existing += 1
        else:
            pending.append(entry)

    print(f"Already generated: {existing}")
    print(f"Pending: {len(pending)}")

    if limit and limit < len(pending):
        pending = pending[:limit]
        print(f"Limited to: {limit}")

    if not pending:
        print("✓ All entries already processed!")
        return

    print("=" * 60)

    total_processed = 0
    total_errors = 0

    for i, entry in enumerate(pending, 1):
        key = entry["key"]
        filename = sanitize_filename(key)
        output_file = OUTPUT_DIR / f"{filename}.wav"

        text = preprocess_text(entry["definition"])
        if not text:
            print(f"[{i}/{len(pending)}] {key}: empty text, skipping")
            continue

        selected_voice = voice_name if voice_name else get_random_voice(key)
        chunks = chunk_text(text)

        print(f"[{i}/{len(pending)}] {key} [{selected_voice}] {len(text)} chars, {len(chunks)} chunk(s)...", end=" ", flush=True)

        try:
            if len(chunks) == 1:
                raw_audio = generate_audio_cloud_tts(client, chunks[0], selected_voice)
                audio_data = convert_to_wav(raw_audio, "audio/L16;rate=24000")
            else:
                audio_parts = []
                for j, chunk in enumerate(chunks, 1):
                    print(f"chunk {j}/{len(chunks)}...", end=" ", flush=True)
                    chunk_audio = generate_audio_cloud_tts(client, chunk, selected_voice)
                    wav_chunk = convert_to_wav(chunk_audio, "audio/L16;rate=24000")
                    audio_parts.append(wav_chunk)
                audio_data = stitch_wav_files(audio_parts)

            output_file.parent.mkdir(parents=True, exist_ok=True)
            with open(output_file, "wb") as f:
                f.write(audio_data)

            print("✓")
            total_processed += 1

        except Exception as e:
            print(f"✗ {e}")
            total_errors += 1

        if i % 50 == 0:
            print(f"\n   📊 Progress: {existing + total_processed}/{len(entries)} ({100*(existing + total_processed)/len(entries):.1f}%)\n")

    print("\n" + "=" * 60)
    print(f"COMPLETE! Processed: {total_processed} | Errors: {total_errors}")
    print(f"Total files: {existing + total_processed}/{len(entries)}")
    print("=" * 60)


# ============================================================================
# Voice samples
# ============================================================================

def generate_voice_samples():
    """Generate audio samples with the 4 selected voices."""
    print("=" * 60)
    print("GENERATING VOICE SAMPLES")
    print("=" * 60)
    print(f"Sample text: {SAMPLE_TEXT[:60]}...")
    print(f"Voices: {', '.join(SELECTED_VOICES)}")
    print("=" * 60)

    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
    samples_dir = OUTPUT_DIR / "samples"
    samples_dir.mkdir(parents=True, exist_ok=True)

    for i, voice_name in enumerate(SELECTED_VOICES, 1):
        output_file = samples_dir / f"{voice_name}.wav"

        if output_file.exists():
            print(f"[{i}/{len(SELECTED_VOICES)}] {voice_name} - already exists, skipping")
            continue

        print(f"[{i}/{len(SELECTED_VOICES)}] Generating: {voice_name}...")

        try:
            contents = [
                types.Content(
                    role="user",
                    parts=[types.Part.from_text(text=SAMPLE_TEXT)],
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
                model=MODEL, contents=contents, config=config,
            ):
                if (chunk.candidates and chunk.candidates[0].content
                        and chunk.candidates[0].content.parts):
                    part = chunk.candidates[0].content.parts[0]
                    if part.inline_data and part.inline_data.data:
                        data_buffer = part.inline_data.data
                        file_ext = mimetypes.guess_extension(part.inline_data.mime_type)
                        if file_ext is None:
                            data_buffer = convert_to_wav(data_buffer, part.inline_data.mime_type)
                        audio_chunks.append(data_buffer)

            if audio_chunks:
                audio_data = audio_chunks[0] if len(audio_chunks) == 1 else stitch_wav_files(audio_chunks)
                output_file.parent.mkdir(parents=True, exist_ok=True)
                with open(output_file, "wb") as f:
                    f.write(audio_data)
                print(f"  ✓ Saved: {output_file}")
            else:
                print(f"  ✗ No audio data received")

        except Exception as e:
            print(f"  ✗ Error: {e}")

    print("\n✓ Voice samples generation complete!")


# ============================================================================
# Main
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Generate audio for إعراب القرآن وبيانه using Google Gemini TTS"
    )
    parser.add_argument("--cloud-tts", action="store_true",
                        help="Use Google Cloud TTS API (150 RPM, no daily limit)")
    parser.add_argument("--gemini", action="store_true",
                        help="Use Gemini API (async concurrent)")
    parser.add_argument("--samples", action="store_true",
                        help="Generate voice samples with 4 selected voices")
    parser.add_argument("--voice", type=str, default=None,
                        help=f"Voice to use (default: random). Available: {', '.join(SELECTED_VOICES)}")
    parser.add_argument("--concurrent", type=int, default=MAX_CONCURRENT_REQUESTS,
                        help=f"Concurrent requests for async mode (default: {MAX_CONCURRENT_REQUESTS})")
    parser.add_argument("-n", "--limit", type=int, default=None,
                        help="Limit number of entries (for testing)")

    args = parser.parse_args()

    if args.voice and args.voice not in SELECTED_VOICES:
        print(f"Error: Unknown voice '{args.voice}'")
        print(f"Available: {', '.join(SELECTED_VOICES)}")
        return

    if args.cloud_tts:
        generate_cloud_tts(args.voice, args.limit)
    elif args.gemini:
        if not os.environ.get("GEMINI_API_KEY"):
            print("Error: GEMINI_API_KEY not set")
            return
        asyncio.run(generate_gemini_async(args.voice, args.concurrent, args.limit))
    elif args.samples:
        if not os.environ.get("GEMINI_API_KEY"):
            print("Error: GEMINI_API_KEY not set")
            return
        generate_voice_samples()
    else:
        parser.print_help()
        print(f"\nVoices: {', '.join(SELECTED_VOICES)}")
        print(f"Input: {INPUT_FILE}")
        print(f"Output: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
