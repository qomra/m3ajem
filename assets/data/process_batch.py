#!/usr/bin/env python3
"""
Process Dictionary Pages using OpenAI Batch API
================================================
Submits jobs to OpenAI Batch API, monitors until complete, imports results.

Usage:
    python process_batch.py --batch-size 50              # Process one batch of 50 jobs
    python process_batch.py --batch-size 50 --loop       # Process ALL pending jobs (loops until done)
    python process_batch.py --loop --max-batches 5       # Process up to 5 batches
    python process_batch.py --dict alqab --loop          # Process specific dictionary until done
    python process_batch.py --status                     # Check active batches
    python process_batch.py --resume                     # Import results from completed batches
"""

import sqlite3
import os
import json
import argparse
import base64
import asyncio
from io import BytesIO
from PIL import Image
import fitz  # PyMuPDF
from datetime import datetime
import time
import tempfile
from openai import OpenAI, AsyncOpenAI, APITimeoutError, APIConnectionError, InternalServerError, APIStatusError

# Configuration
DB_PATH = "jobs.db"
MODEL = "gpt-5.1"
POLL_INTERVAL = 30  # seconds between status checks
MAX_WAIT_TIME = 3600  # 1 hour max wait per batch

client = OpenAI()


def retry_on_error(func, *args, **kwargs):
    """Retry a function call on transient errors. Keeps retrying until success."""
    attempt = 0
    while True:
        try:
            return func(*args, **kwargs)
        except (APITimeoutError, APIConnectionError, InternalServerError) as e:
            attempt += 1
            wait_time = min(30 * attempt, 300)  # 30s, 60s, 90s... up to 5 min max
            error_type = type(e).__name__
            print(f"  ⏳ {error_type}, waiting {wait_time}s (attempt {attempt})...")
            time.sleep(wait_time)
            print(f"  Retrying...")
        except APIStatusError as e:
            # Retry on 5xx server errors
            if e.status_code >= 500:
                attempt += 1
                wait_time = min(30 * attempt, 300)
                print(f"  ⏳ Server error {e.status_code}, waiting {wait_time}s (attempt {attempt})...")
                time.sleep(wait_time)
                print(f"  Retrying...")
            else:
                raise


# Prompts
PROMPTS = {
    "arabic_only_with_diacritics": """
You are given page image(s) from an Arabic dictionary with fully diacritized text.

{context_instruction}

Extract data as a JSON object (dictionary) with this structure:
{{"word1": "definition1", "word2": "definition2", ...}}

CRITICAL INSTRUCTIONS FOR OCR:
- Preserve ALL diacritics (تشكيل) exactly as they appear: فَتْحَة، كَسْرَة، ضَمَّة، سُكُون، شَدَّة، تَنْوِين
- Extract the Arabic headword WITH full diacritics
- Extract the Arabic definition/content WITH full diacritics
- The headword is typically bold, larger, or at the start of an entry

HANDLING CONTINUATIONS:
- If the CURRENT page starts with text that continues a previous entry (no new headword at top):
  - Use the special key "__continuation__" with the continued text
  - Example: {{"__continuation__": "continued definition text...", "nextWord": "definition..."}}

Return only valid JSON object (not an array).
""",

    "english_arabic_dictionary_with_context": """
You are given page image(s) from a bilingual English-Arabic dictionary.

{context_instruction}

This dictionary has a two-column layout flowing right-to-left (RTL).

Extract data as a JSON array with this structure:
[{{"english":"...", "arabic":"...", "arabic_term":"...", "is_continuation": false}}]

FIELD DESCRIPTIONS:
- "english": The English term or phrase
- "arabic": The full Arabic text for this entry (definitions, notes, field markers)
- "arabic_term": A UNIQUE Arabic phrase that distinguishes this entry
  * Include context/field markers if present (e.g., "شطب [هندسة ميكانيكية]")
  * Different technical meanings should have different arabic_term values
- "is_continuation": true if continuing from previous page, false otherwise

HANDLING CONTINUATIONS:
- If the CURRENT page starts with text continuing a previous entry, mark it with "is_continuation": true

Return only valid JSON array.
""",

    "flat_english_arabic_dictionary_with_context": """
You are given page image(s) from a bilingual English-Arabic dictionary with sequential entries (not two-column).

{context_instruction}

Extract data as a JSON array with this structure:
[{{"english":"...", "arabic":"...", "arabic_term":"...", "is_continuation": false}}]

FIELD DESCRIPTIONS:
- "english": The English term or phrase
- "arabic": The full Arabic text for this entry (definitions, notes, field markers)
- "arabic_term": A UNIQUE Arabic phrase that distinguishes this entry
  * Include context/field markers if present
  * Different technical meanings should have different arabic_term values
- "is_continuation": true if continuing from previous page, false otherwise

HANDLING CONTINUATIONS:
- If the CURRENT page starts with text continuing a previous entry, mark it with "is_continuation": true

Return only valid JSON array.
""",

    "english_arabic_dictionary_translation": """
You are given page image(s) from a bilingual English-Arabic translation dictionary.

{context_instruction}

Extract data as a JSON array with this structure:
[{{"english":"...", "arabic":"...", "arabic_term":"..."}}]

FIELD DESCRIPTIONS:
- "english": The English term or phrase
- "arabic": The Arabic translation/equivalent
- "arabic_term": A UNIQUE Arabic identifier for this entry

This is a simple translation dictionary - extract term pairs without extensive definitions.

Return only valid JSON array.
""",

    "french_english_arabic_dictionary_with_context": """
You are given page image(s) from a trilingual French-English-Arabic dictionary.

{context_instruction}

Extract data as a JSON array with this structure:
[{{"french":"...", "english":"...", "arabic":"...", "arabic_term":"...", "is_continuation": false}}]

FIELD DESCRIPTIONS:
- "french": The French term or phrase
- "english": The English term or phrase (may be empty if not present)
- "arabic": The full Arabic text for this entry (definitions, notes)
- "arabic_term": A UNIQUE Arabic phrase that distinguishes this entry
- "is_continuation": true if continuing from previous page, false otherwise

Return only valid JSON array.
""",

    "geography_english_arabic": """
You are given page image(s) from "معجم المصطلحات الجغرافية" (Dictionary of Geographical Terms).

{context_instruction}

PAGE LAYOUT:
- Each entry has an English term on the LEFT and Arabic term on the RIGHT (bold)
- The Arabic definition follows below
- Some entries have sub-points marked with (أ), (ب), etc.
- Cross-references appear as (انظر: term)

Extract data as a JSON object with this structure:
{{
  "Arabic term (english term)": "Arabic term\\ndefinition...",
  "مُناخ (climate)": "مُناخ\\nمتوسط حالة الجو على مدار فترة زمنية طويلة..."
}}

KEY FORMAT: "Arabic term (english term)"
- Arabic term first, then English in parentheses
- Preserve diacritics (تشكيل) on Arabic term

VALUE FORMAT: "Arabic term\\ndefinition"
- Start with the Arabic term
- Then newline (\\n)
- Then the full Arabic definition
- Include all sub-points (أ), (ب) if present
- Include cross-references like (انظر: Joint)

HANDLING CONTINUATIONS:
- If page starts mid-definition, use "__continuation__" as key

Return only valid JSON object.
""",

    "math_english_arabic": """
You are given page image(s) from "معجم الرياضيات" (Dictionary of Mathematics).

{context_instruction}

PAGE LAYOUT:
- Two-column layout, RTL flow (read right column first, then left)
- Each entry has an English term on the LEFT and Arabic term on the RIGHT (bold)
- The Arabic definition follows below, often containing mathematical formulas

Extract data as a JSON object with this structure:
{{
  "Arabic term (english term)": "Arabic term\\ndefinition with $LaTeX$...",
  "متباينة آبل (Abel's inequality)": "متباينة آبل\\nإذا كان $s_n \\leq s_{{n+1}} < $ صفر لكل عدد..."
}}

KEY FORMAT: "Arabic term (english term)"
- Arabic term first, then English in parentheses
- Preserve diacritics (تشكيل) on Arabic term

VALUE FORMAT: "Arabic term\\ndefinition"
- Start with the Arabic term
- Then newline (\\n)
- Then the full Arabic definition

MATHEMATICAL FORMULAS - USE LATEX:
- Wrap ALL math expressions in $...$ (inline) or $$...$$ (display)
- Summations: $\\sum_{{r=1}}^{{n}} a_r$
- Fractions: $\\frac{{a}}{{b}}$
- Subscripts: $x_n$, Superscripts: $x^2$
- Greek letters: $\\alpha$, $\\beta$, $\\gamma$
- Inequalities: $\\leq$, $\\geq$, $<$, $>$
- Infinity: $\\infty$
- Set notation: $\\in$, $\\subset$, $\\cup$, $\\cap$
- Arrows: $\\rightarrow$, $\\Rightarrow$
- Absolute value: $|x|$
- Square root: $\\sqrt{{x}}$

EXAMPLES:
- "مجموع ل إذا كانت $\\sum_{{n=0}}^{{\\infty}} a_n s_n$ موجودة وتساوي ل"
- "إذا كان $s_n \\leq s_{{n+1}} < $ صفر لكل عدد صحيح موجب ن"

HANDLING CONTINUATIONS:
- If page starts mid-definition, use "__continuation__" as key

Return only valid JSON object.
""",

    "arabic_poetry": """
You are given page image(s) from "شرح المعلقات السبع" (Commentary on the Seven Mu'allaqat).

{context_instruction}

PAGE LAYOUT:
- Header at TOP: "معلقة [poet name]" (e.g., معلقة لبيد بن ربيعة)
- Verses numbered: ١ - ٢ - ٣ - (Arabic numerals with dash)
- Each verse appears in BOLD/DISTINCT text on its own line
- The verse has TWO HALVES (شطرين) separated by spaces
- The explanation (شرح) follows below the verse in regular text

Extract data as a JSON object:
{{
  "معلقة لبيد بن ربيعة. ١- عفت الديار": "عَفَتِ الدِّيَارُ مَحَلُّهَا فَمُقَامُهَا   بِمِنًى تَأَبَّدَ غَوْلُهَا فَرِجَامُهَا\\n\\nعفا لازم ومتعد، يقال: عفت الريح المنزل...",
  "معلقة لبيد بن ربيعة. ٢- فمدافع الريان": "فَمَدَافِعُ الرَّيَّانِ عُرِّيَ رَسْمُهَا   خَلَقًا كَمَا ضَمِنَ الوُحِيَّ سِلامُهَا\\n\\nالمدافع: أماكن يندفع عنها الماء..."
}}

KEY FORMAT: "معلقة [poet name]. [number]- [first 2 words of verse]"
VALUE:
  1. FIRST: The COMPLETE verse (البيت الكامل) with BOTH halves (الشطر الأول والشطر الثاني)
  2. THEN: Two newlines (\\n\\n)
  3. THEN: The explanation (الشرح) text

CRITICAL:
- Extract poet name from page header
- Use Arabic numerals (١، ٢، ٣)
- KEY has only FIRST 2 WORDS of the verse
- VALUE MUST START with the FULL verse (both halves separated by spaces)
- Then TWO newlines, then the explanation
- Preserve ALL diacritics (تشكيل) - especially on the verse itself
- The verse is typically in BOLD or distinct formatting

HANDLING CONTINUATIONS:
- If page starts mid-explanation, use "__continuation__" key

Return only valid JSON object.
""",
}


def get_context_instruction(context_pages: int, page_num: int) -> str:
    """Generate context instruction based on number of context images."""
    if context_pages == 0 or page_num == 1:
        return "Extract all entries from this single page image."

    actual_context = min(context_pages, page_num - 1)
    if actual_context == 0:
        return "Extract all entries from this single page image."

    return f"""IMAGES PROVIDED (in order):
{chr(10).join([f'- Image {i+1}: Page {page_num - actual_context + i} (context)' for i in range(actual_context)])}
- Image {actual_context + 1}: Page {page_num} (CURRENT - extract from this one)

The LAST image is the CURRENT page - extract entries ONLY from it.
Previous image(s) are for VISUAL CONTEXT only."""


def extract_page_image_base64(pdf_path: str, page_num: int) -> str:
    """Extract a single page as base64 string."""
    doc = fitz.open(pdf_path)
    page = doc[page_num - 1]
    pix = page.get_pixmap(matrix=fitz.Matrix(200/72, 200/72))
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    doc.close()

    buffered = BytesIO()
    img.save(buffered, format="PNG", optimize=True)
    return base64.b64encode(buffered.getvalue()).decode()


def create_batch_request(job: dict) -> dict:
    """Create a single batch request for a job."""
    pdf_path = job['pdf_path']
    page_num = job['page_num']
    context_pages = job['context_pages']
    prompt_name = job['prompt_name']
    custom_id = f"{job['folder_name']}_page_{page_num}"

    # Get pages to include (context + current)
    start_page = max(1, page_num - context_pages)
    pages_to_send = list(range(start_page, page_num + 1))

    # Build prompt
    base_prompt = PROMPTS.get(prompt_name, PROMPTS["arabic_only_with_diacritics"])
    context_instruction = get_context_instruction(context_pages, page_num)
    prompt = base_prompt.format(context_instruction=context_instruction)

    # Build content with images
    content = [{"type": "text", "text": prompt}]

    for i, p in enumerate(pages_to_send):
        img_base64 = extract_page_image_base64(pdf_path, p)
        is_current = (i == len(pages_to_send) - 1)
        content.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:image/png;base64,{img_base64}",
                "detail": "high" if is_current else "low"
            }
        })

    return {
        "custom_id": custom_id,
        "method": "POST",
        "url": "/v1/chat/completions",
        "body": {
            "model": MODEL,
            "messages": [{"role": "user", "content": content}],
            "reasoning_effort": "low",
            "temperature": 1,
            "max_completion_tokens": 4096,
            "response_format": {"type": "json_object"}
        }
    }


def get_pending_jobs(conn: sqlite3.Connection, dict_filter: str = None, limit: int = None) -> list:
    """Get pending jobs from database."""
    cursor = conn.cursor()

    query = '''
        SELECT j.id, j.page_num,
               d.folder_name, d.pdf_path, d.total_pages, d.context_pages, d.prompt_name
        FROM jobs j
        JOIN dictionaries d ON j.dictionary_id = d.id
        WHERE j.status = 'pending'
    '''
    params = []

    if dict_filter:
        query += ' AND d.folder_name = ?'
        params.append(dict_filter)

    query += ' ORDER BY d.id, j.page_num'

    if limit:
        query += ' LIMIT ?'
        params.append(limit)

    cursor.execute(query, params)

    return [
        {
            'id': row[0],
            'page_num': row[1],
            'folder_name': row[2],
            'pdf_path': row[3],
            'total_pages': row[4],
            'context_pages': row[5],
            'prompt_name': row[6]
        }
        for row in cursor.fetchall()
    ]


def process_single_batch(conn, cursor, args):
    """Process a single batch. Returns True if batch was processed successfully, False if no jobs or error."""
    # Get pending jobs
    jobs = get_pending_jobs(conn, args.dict, args.batch_size)

    if not jobs:
        return False

    print(f"\nProcessing {len(jobs)} jobs...")

    # Build job mapping
    job_mapping = {f"{j['folder_name']}_page_{j['page_num']}": j['id'] for j in jobs}

    # Mark jobs as processing
    job_ids = [j['id'] for j in jobs]
    cursor.executemany(
        'UPDATE jobs SET status = ? WHERE id = ?',
        [('processing', jid) for jid in job_ids]
    )
    conn.commit()

    # Create JSONL content in memory and write to temp file
    print("Rendering images and creating batch request...")

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', suffix='.jsonl', delete=False, encoding='utf-8') as f:
            temp_path = f.name
            for i, job in enumerate(jobs):
                if (i + 1) % 5 == 0 or i == len(jobs) - 1:
                    print(f"  Prepared {i + 1}/{len(jobs)} jobs...")
                request = create_batch_request(job)
                f.write(json.dumps(request, ensure_ascii=False) + '\n')

        # Upload file to OpenAI
        print("\nUploading to OpenAI...")
        with open(temp_path, 'rb') as f:
            file_response = retry_on_error(client.files.create, file=f, purpose='batch')
        print(f"  File ID: {file_response.id}")

        # Create batch
        print("Creating batch...")
        batch = retry_on_error(
            client.batches.create,
            input_file_id=file_response.id,
            endpoint="/v1/chat/completions",
            completion_window="24h"
        )
        print(f"  Batch ID: {batch.id}")
        print(f"  Status: {batch.status}")

        # Store batch ID in database for tracking
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS batches (
                id TEXT PRIMARY KEY,
                file_id TEXT,
                created_at TIMESTAMP,
                status TEXT,
                job_ids TEXT
            )
        ''')
        cursor.execute(
            'INSERT INTO batches (id, file_id, created_at, status, job_ids) VALUES (?, ?, ?, ?, ?)',
            (batch.id, file_response.id, datetime.now(), batch.status, json.dumps(job_ids))
        )
        conn.commit()

        # Poll until complete
        print("\nWaiting for completion...")
        start_time = time.time()

        while True:
            elapsed = time.time() - start_time
            if elapsed > MAX_WAIT_TIME:
                print(f"\n⚠️  Timeout after {MAX_WAIT_TIME}s. Batch still processing.")
                print(f"   Check later with: python process_batch.py --status")
                return True  # Still counts as processed, just not complete yet

            batch = retry_on_error(client.batches.retrieve, batch.id)
            completed = batch.request_counts.completed
            failed = batch.request_counts.failed
            total = batch.request_counts.total

            print(f"  [{int(elapsed)}s] Status: {batch.status} | Progress: {completed}/{total} | Failed: {failed}")

            if batch.status == 'completed':
                print("\n✓ Batch completed!")
                break
            elif batch.status == 'failed':
                print(f"\n❌ Batch failed: {batch.errors}")
                cursor.executemany(
                    'UPDATE jobs SET status = ?, error = ? WHERE id = ?',
                    [('failed', 'Batch failed', jid) for jid in job_ids]
                )
                conn.commit()
                return True  # Batch was processed (even if failed)
            elif batch.status in ('cancelled', 'expired'):
                print(f"\n❌ Batch {batch.status}")
                cursor.executemany(
                    'UPDATE jobs SET status = ?, error = ? WHERE id = ?',
                    [('pending', f'Batch {batch.status}', jid) for jid in job_ids]
                )
                conn.commit()
                return True

            time.sleep(POLL_INTERVAL)

        # Download and import results
        if batch.status == 'completed' and batch.output_file_id:
            print("\nDownloading results...")
            content = retry_on_error(client.files.content, batch.output_file_id)
            results_data = content.read().decode('utf-8')

            success = 0
            failed_count = 0

            print("Importing results...")
            for line in results_data.strip().split('\n'):
                result = json.loads(line)
                custom_id = result['custom_id']
                job_id = job_mapping.get(custom_id)

                if not job_id:
                    print(f"  ⚠ Unknown custom_id: {custom_id}")
                    continue

                response = result.get('response', {})

                if result.get('error') or response.get('status_code') != 200:
                    error_msg = result.get('error', {}).get('message', 'Unknown error')
                    cursor.execute('''
                        UPDATE jobs SET status = 'failed', error = ?, attempts = attempts + 1
                        WHERE id = ?
                    ''', (error_msg, job_id))
                    failed_count += 1
                else:
                    body = response.get('body', {})
                    choices = body.get('choices', [])
                    if choices:
                        msg_content = choices[0].get('message', {}).get('content', '{}')
                        cursor.execute('''
                            UPDATE jobs SET status = 'completed', result_json = ?, completed_at = ?
                            WHERE id = ?
                        ''', (msg_content, datetime.now(), job_id))
                        success += 1
                    else:
                        cursor.execute('''
                            UPDATE jobs SET status = 'failed', error = 'No choices in response'
                            WHERE id = ?
                        ''', (job_id,))
                        failed_count += 1

            conn.commit()
            print(f"\n✓ Imported: {success} success, {failed_count} failed")

            # Update batch status
            cursor.execute('UPDATE batches SET status = ? WHERE id = ?', ('imported', batch.id))
            conn.commit()

    finally:
        # Clean up temp file
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

    return True


def process_batch(args):
    """Main processing loop - continues until no more pending jobs."""
    conn = sqlite3.connect(args.db)
    cursor = conn.cursor()

    batch_num = 0
    max_batches = args.max_batches if args.max_batches else float('inf')

    print("=" * 60)
    print("BATCH PROCESSING")
    print("=" * 60)

    while batch_num < max_batches:
        batch_num += 1
        print(f"\n{'='*60}")
        print(f"BATCH #{batch_num}")
        print("=" * 60)

        processed = process_single_batch(conn, cursor, args)

        if not processed:
            print("\n✓ No more pending jobs!")
            break

        # Show summary after each batch
        print_job_summary(cursor)

        cursor.execute("SELECT COUNT(*) FROM jobs WHERE status = 'pending'")
        pending = cursor.fetchone()[0]

        if pending == 0:
            print("\n✓ All jobs completed!")
            break

        if not args.loop:
            print("\nStopping after one batch. Use --loop to continue automatically.")
            break

    conn.close()
    print("\n" + "=" * 60)
    print("DONE")
    print("=" * 60)


def resume_batches(args):
    """Check for completed batches and import their results."""
    conn = sqlite3.connect(args.db)
    cursor = conn.cursor()

    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='batches'")
    if not cursor.fetchone():
        print("No batches table found")
        conn.close()
        return

    cursor.execute("SELECT id, job_ids FROM batches WHERE status != 'imported'")
    batches = cursor.fetchall()

    if not batches:
        print("No pending batches to resume")
        conn.close()
        return

    print(f"Found {len(batches)} batches to check...")

    for batch_id, job_ids_json in batches:
        try:
            batch = retry_on_error(client.batches.retrieve, batch_id)
            print(f"\n{batch_id}: {batch.status} ({batch.request_counts.completed}/{batch.request_counts.total})")

            if batch.status == 'completed' and batch.output_file_id:
                job_ids = json.loads(job_ids_json)

                # Build mapping
                cursor.execute('''
                    SELECT j.id, j.page_num, d.folder_name
                    FROM jobs j JOIN dictionaries d ON j.dictionary_id = d.id
                    WHERE j.id IN ({})
                '''.format(','.join('?' * len(job_ids))), job_ids)

                job_mapping = {f'{folder}_page_{page}': jid for jid, page, folder in cursor.fetchall()}

                # Download and import
                print("  Downloading results...")
                content = retry_on_error(client.files.content, batch.output_file_id)
                results_data = content.read().decode('utf-8')

                success = failed = 0
                for line in results_data.strip().split('\n'):
                    result = json.loads(line)
                    job_id = job_mapping.get(result['custom_id'])
                    if not job_id:
                        continue

                    response = result.get('response', {})
                    if result.get('error') or response.get('status_code') != 200:
                        cursor.execute('UPDATE jobs SET status = "failed", error = ? WHERE id = ?',
                                       (str(result.get('error', 'Unknown')), job_id))
                        failed += 1
                    else:
                        choices = response.get('body', {}).get('choices', [])
                        if choices:
                            cursor.execute('UPDATE jobs SET status = "completed", result_json = ?, completed_at = ? WHERE id = ?',
                                           (choices[0]['message']['content'], datetime.now(), job_id))
                            success += 1

                conn.commit()
                cursor.execute('UPDATE batches SET status = "imported" WHERE id = ?', (batch_id,))
                conn.commit()
                print(f"  Imported: {success} success, {failed} failed")

            elif batch.status in ('failed', 'cancelled', 'expired'):
                # Reset jobs to pending
                job_ids = json.loads(job_ids_json)
                cursor.executemany('UPDATE jobs SET status = "pending" WHERE id = ?', [(jid,) for jid in job_ids])
                cursor.execute('UPDATE batches SET status = ? WHERE id = ?', (batch.status, batch_id))
                conn.commit()
                print(f"  Reset {len(job_ids)} jobs to pending")

        except Exception as e:
            print(f"  Error: {e}")

    conn.close()


def show_status(args):
    """Show status of batches and jobs."""
    conn = sqlite3.connect(args.db)
    cursor = conn.cursor()

    print("=" * 60)
    print("BATCH PROCESSING STATUS")
    print("=" * 60)

    # Check for batches table
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='batches'")
    if cursor.fetchone():
        cursor.execute('SELECT id, status, created_at FROM batches ORDER BY created_at DESC LIMIT 5')
        batches = cursor.fetchall()
        if batches:
            print("\nRecent Batches:")
            for batch_id, status, created in batches:
                # Check OpenAI status if not imported
                if status != 'imported':
                    try:
                        batch = retry_on_error(client.batches.retrieve, batch_id)
                        print(f"  {batch_id[:20]}... | {batch.status} | {batch.request_counts.completed}/{batch.request_counts.total}")
                    except Exception:
                        print(f"  {batch_id[:20]}... | {status} (local)")
                else:
                    print(f"  {batch_id[:20]}... | {status}")

    print_job_summary(cursor)
    conn.close()


async def process_single_job_async(async_client, job: dict, db_path: str) -> tuple:
    """Process a single job asynchronously. Returns (job_id, success, error)."""
    job_id = job['id']
    page_num = job['page_num']
    folder_name = job['folder_name']
    pdf_path = job['pdf_path']
    context_pages = job['context_pages']
    prompt_name = job['prompt_name']

    try:
        # Build request content
        start_page = max(1, page_num - context_pages)
        pages_to_send = list(range(start_page, page_num + 1))

        base_prompt = PROMPTS.get(prompt_name, PROMPTS["arabic_only_with_diacritics"])
        context_instruction = get_context_instruction(context_pages, page_num)
        prompt = base_prompt.format(context_instruction=context_instruction)

        content = [{"type": "text", "text": prompt}]

        for i, p in enumerate(pages_to_send):
            img_base64 = extract_page_image_base64(pdf_path, p)
            is_current = (i == len(pages_to_send) - 1)
            content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/png;base64,{img_base64}",
                    "detail": "high" if is_current else "low"
                }
            })

        # Make async API call with retry
        attempt = 0
        while True:
            try:
                response = await async_client.chat.completions.create(
                    model=MODEL,
                    messages=[{"role": "user", "content": content}],
                    reasoning_effort="low",
                    temperature=1,
                    max_completion_tokens=4096,
                    response_format={"type": "json_object"}
                )
                break
            except (APITimeoutError, APIConnectionError, InternalServerError) as e:
                attempt += 1
                wait_time = min(30 * attempt, 300)
                print(f"\n  ⏳ {folder_name} p{page_num}: {type(e).__name__}, waiting {wait_time}s...")
                await asyncio.sleep(wait_time)
            except APIStatusError as e:
                if e.status_code >= 500:
                    attempt += 1
                    wait_time = min(30 * attempt, 300)
                    print(f"\n  ⏳ {folder_name} p{page_num}: Server {e.status_code}, waiting {wait_time}s...")
                    await asyncio.sleep(wait_time)
                else:
                    raise

        result_text = response.choices[0].message.content

        # Save result to DB
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE jobs SET status = ?, result_json = ?, completed_at = ?
            WHERE id = ?
        ''', ('completed', result_text, datetime.now(), job_id))
        conn.commit()
        conn.close()

        return (job_id, folder_name, page_num, True, None)

    except Exception as e:
        # Save error to DB
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute('UPDATE jobs SET status = ?, error = ? WHERE id = ?',
                      ('failed', str(e), job_id))
        conn.commit()
        conn.close()
        return (job_id, folder_name, page_num, False, str(e))


async def process_realtime_async(args):
    """Process jobs using real-time API with parallel workers."""
    conn = sqlite3.connect(args.db)
    cursor = conn.cursor()

    concurrent = args.concurrent if args.concurrent else 5
    max_jobs = args.max_jobs if args.max_jobs else float('inf')

    print("=" * 60)
    print("REAL-TIME PARALLEL PROCESSING")
    print("=" * 60)
    print(f"Concurrent workers: {concurrent}")
    print(f"Cost: 2x batch API (but instant results)")
    print("=" * 60)

    # Get all pending jobs
    jobs = get_pending_jobs(conn, args.dict, limit=int(max_jobs) if max_jobs != float('inf') else None)
    if not jobs:
        print("\n✓ No pending jobs!")
        conn.close()
        return

    print(f"Jobs to process: {len(jobs)}")

    # Mark all as processing
    job_ids = [j['id'] for j in jobs]
    cursor.executemany('UPDATE jobs SET status = ? WHERE id = ?', [('processing', jid) for jid in job_ids])
    conn.commit()
    conn.close()

    # Create async client
    async_client = AsyncOpenAI()

    # Process with worker pool
    total = len(jobs)
    completed = 0
    success = 0
    failed = 0

    queue = asyncio.Queue()
    for job in jobs:
        await queue.put(job)

    async def worker(worker_id: int):
        nonlocal completed, success, failed
        while True:
            try:
                job = queue.get_nowait()
            except asyncio.QueueEmpty:
                return

            result = await process_single_job_async(async_client, job, args.db)
            job_id, folder_name, page_num, ok, error = result

            completed += 1
            if ok:
                success += 1
                print(f"✓ [{completed}/{total}] {folder_name} p{page_num} | Done: {success}, Failed: {failed}")
            else:
                failed += 1
                print(f"✗ [{completed}/{total}] {folder_name} p{page_num}: {error}")

    # Start workers
    workers = [asyncio.create_task(worker(i)) for i in range(concurrent)]
    await asyncio.gather(*workers)

    print("\n" + "=" * 60)
    print(f"COMPLETE! Success: {success}, Failed: {failed}")

    # Show final summary
    conn = sqlite3.connect(args.db)
    cursor = conn.cursor()
    print_job_summary(cursor)
    conn.close()


def process_realtime(args):
    """Wrapper to run async realtime processing."""
    asyncio.run(process_realtime_async(args))


def print_job_summary(cursor):
    """Print job status summary table."""
    cursor.execute('''
        SELECT d.folder_name,
               COUNT(*) as total,
               COUNT(CASE WHEN j.status = 'completed' THEN 1 END) as done,
               COUNT(CASE WHEN j.status = 'pending' THEN 1 END) as pending,
               COUNT(CASE WHEN j.status = 'failed' THEN 1 END) as failed,
               COUNT(CASE WHEN j.status = 'processing' THEN 1 END) as processing
        FROM jobs j
        JOIN dictionaries d ON j.dictionary_id = d.id
        GROUP BY d.id
    ''')

    print(f"\n{'Dictionary':<25} {'Total':<8} {'Done':<8} {'Pending':<8} {'Failed':<8} {'Processing'}")
    print("-" * 75)

    for row in cursor.fetchall():
        folder, total, done, pending, failed, processing = row
        print(f"{folder:<25} {total:<8} {done:<8} {pending:<8} {failed:<8} {processing}")


def main():
    parser = argparse.ArgumentParser(description='Process with OpenAI Batch API')
    parser.add_argument('--db', type=str, default=DB_PATH, help='Database path')
    parser.add_argument('--batch-size', type=int, default=50, help='Number of jobs per batch')
    parser.add_argument('--dict', type=str, help='Process specific dictionary only')
    parser.add_argument('--status', action='store_true', help='Show status only')
    parser.add_argument('--resume', action='store_true', help='Resume/import completed batches')
    parser.add_argument('--loop', action='store_true', help='Continue processing batches until done')
    parser.add_argument('--max-batches', type=int, help='Maximum number of batches to process')
    parser.add_argument('--realtime', action='store_true', help='Use real-time API (faster, 2x cost)')
    parser.add_argument('--max-jobs', type=int, help='Maximum number of jobs for realtime mode')
    parser.add_argument('--concurrent', type=int, default=5, help='Number of parallel workers for realtime mode (default: 5)')

    args = parser.parse_args()

    if args.status:
        show_status(args)
    elif args.resume:
        resume_batches(args)
    elif args.realtime:
        process_realtime(args)
    else:
        process_batch(args)


if __name__ == '__main__':
    main()
