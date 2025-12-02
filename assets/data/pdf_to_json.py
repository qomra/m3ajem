import openai
import base64
from io import BytesIO
from PIL import Image
import fitz  # PyMuPDF
import json
import os
import argparse

# Set your API key (recommended: store in environment variable)
openai.api_key = "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"

# Model configuration
MODEL = "gpt-5.1"  # lower-cost, faster version of GPT-5.1

prompts = {
    "arabic_only_with_diacritics": """
You are given a page from a classical Arabic dictionary with fully diacritized text.

Extract data as a JSON object (dictionary) with this structure:
{"word1": "definition1", "word2": "definition2", ...}

CRITICAL INSTRUCTIONS FOR OCR:
- Preserve ALL diacritics (تشكيل) exactly as they appear: فَتْحَة، كَسْرَة، ضَمَّة، سُكُون، شَدَّة، تَنْوِين
- Extract the Arabic headword WITH full diacritics (e.g., "ائْتِلاَفُ الْفَاصِلَةِ")
- Extract the Arabic definition/content WITH full diacritics
- Be extremely careful to preserve vowel marks on every letter
- The headword is typically bold, larger, or at the start of an entry
- Definitions can span multiple lines on the same page

IMPORTANT NOTES:
- Each page may contain multiple dictionary entries
- Extract ALL entries visible on this page
- Return a flat dictionary object where keys are headwords and values are definitions
- Ensure the JSON is valid and properly formatted

Return only valid JSON object (not an array).
""",
    "arabic_only_with_diacritics_context": """
You are given a page from a classical Arabic dictionary with fully diacritized text.

IMPORTANT: Dictionary entries may span across multiple pages. When an entry is too long to fit on one page,
its definition continues on the next page (up to 3 pages maximum).

CONTEXT FROM PREVIOUS PAGES:
{previous_context}

CURRENT PAGE INSTRUCTIONS:
1. First, check if the FIRST text on this page is a continuation of the LAST entry from previous pages
2. If it IS a continuation:
   - DO NOT create a new entry for the continuation text
   - Mark it as a continuation (explained below)
3. If it is NOT a continuation:
   - Extract it as a new entry
4. Extract all other complete entries on this page

Extract data as a JSON object with this structure:
{{"word1": "definition1", "__continuation__": "continued text from previous page", "word2": "definition2", ...}}

CRITICAL INSTRUCTIONS FOR OCR:
- Preserve ALL diacritics (تشكيل) exactly as they appear: فَتْحَة، كَسْرَة، ضَمَّة، سُكُون، شَدَّة، تَنْوِين
- Extract the Arabic headword WITH full diacritics (e.g., "ائْتِلاَفُ الْفَاصِلَةِ")
- Extract the Arabic definition/content WITH full diacritics
- Be extremely careful to preserve vowel marks on every letter
- The headword is typically bold, larger, or at the start of an entry

HANDLING CONTINUATIONS:
- If the page starts with text that continues a previous entry, use the special key "__continuation__"
- The value should be the continued text from this page
- This text will be automatically merged with the previous entry

Return only valid JSON object (not an array).
""",
    "english_arabic_dictionary": """
You are given a page from a bilingual dictionary or lexicon.

Extract data as a JSON array with this structure:
[{"english":"...", "arabic":"...", "arabic_term":"..."}]

IMPORTANT INSTRUCTIONS:
- "english": The English term or phrase
- "arabic": The full Arabic text for this entry (may include definitions, notes, field markers like [MECH ENG])
- "arabic_term": A UNIQUE Arabic phrase that distinguishes this entry from others
  * This should NOT be just a single word if multiple entries share the same base word
  * Include context/field markers if present (e.g., "شطب [هندسة ميكانيكية]")
  * Make it specific enough to uniquely identify this term
  * Different technical meanings of the same word should have different arabic_term values

Return only valid JSON.
""",
    "english_arabic_dictionary_with_context": """
You are given a page from a bilingual dictionary or lexicon that flows right-to-left.

IMPORTANT: This book follows right-to-left page layout. When reading consecutive pages:
- Page N has a right column and a left column
- The left column top is the continuation of the right column bottom
- Page N+1's right column continues from Page N's left column

CONTEXT FROM PREVIOUS PAGES:
{previous_context}

CURRENT PAGE INSTRUCTIONS:
1. First, check if any entries on the CURRENT page appear to be continuations of entries from the PREVIOUS pages shown above
2. If an entry is a continuation, MERGE it with the previous entry by combining the text
3. If an entry is a continuation, DO NOT create a new entry for it
4. Only create new entries for content that is NOT a continuation

Extract data as a JSON array with this structure:
[{{"english":"...", "arabic":"...", "arabic_term":"...", "is_continuation": false}}]

FIELD DESCRIPTIONS:
- "english": The English term or phrase
- "arabic": The full Arabic text for this entry (may include definitions, notes, field markers)
- "arabic_term": A UNIQUE Arabic phrase that distinguishes this entry from others
  * This should NOT be just a single word if multiple entries share the same base word
  * Include context/field markers if present (e.g., "شطب [هندسة ميكانيكية]", "شطب [هندسة الإنتاج]")
  * Make it specific enough to uniquely identify this term
  * Different technical meanings of the same word should have different arabic_term values
- "is_continuation": true if this is a continuation of a previous entry, false otherwise

For continued entries, mark them with "is_continuation": true and include the full merged content.

Return only valid JSON.
""",
    "flat_dictionary_with_context": """
You are given a page from a dictionary or lexicon with entries that flow sequentially from top to bottom.

IMPORTANT: Dictionary entries may span across multiple pages. When an entry is too long to fit on one page, it continues on the next page.

CONTEXT FROM PREVIOUS PAGES:
{previous_context}

CURRENT PAGE INSTRUCTIONS:
1. First, check if the FIRST entry on the CURRENT page appears to be a continuation of the LAST entry from the PREVIOUS pages shown above
2. If an entry is a continuation, MERGE it with the previous entry by combining the text
3. If an entry is a continuation, DO NOT create a new entry for it
4. Only create new entries for content that is NOT a continuation
5. Extract all other complete entries on this page

Extract data as a JSON array with this structure:
[{{"english":"...", "arabic":"...", "arabic_term":"...", "is_continuation": false}}]

FIELD DESCRIPTIONS:
- "english": The English term or phrase
- "arabic": The full Arabic text for this entry (may include definitions, notes, field markers)
- "arabic_term": A UNIQUE Arabic phrase that distinguishes this entry from others
  * This should NOT be just a single word if multiple entries share the same base word
  * Include context/field markers if present (e.g., "شطب [هندسة ميكانيكية]", "شطب [هندسة الإنتاج]")
  * Make it specific enough to uniquely identify this term
  * Different technical meanings of the same word should have different arabic_term values
- "is_continuation": true if this is a continuation of a previous entry, false otherwise

For continued entries, mark them with "is_continuation": true and include the full merged content.

Return only valid JSON.
"""
}



# Function to extract pages as images from PDF
def extract_images_from_pdf(pdf_path):
    """Convert PDF pages to images using PyMuPDF"""
    doc = fitz.open(pdf_path)
    images = []
    for page_num in range(len(doc)):
        page = doc[page_num]
        # Render page as image at 300 DPI
        pix = page.get_pixmap(matrix=fitz.Matrix(300/72, 300/72))
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        images.append(img)
    doc.close()
    return images

# Function to convert image to base64
def image_to_base64(image):
    """Convert PIL Image to base64 string"""
    buffered = BytesIO()
    image.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    return img_str

# Function to call the model for one page
def process_page(page_image, prompt_name, previous_pages_text=None, max_retries=5):
    """Process a page image and extract data

    Args:
        page_image: PIL Image of the current page
        prompt_name: Name of the prompt to use
        previous_pages_text: List of extracted text from previous pages (for context)
        max_retries: Maximum number of retry attempts (default 5)
    """
    # Convert image to base64
    img_base64 = image_to_base64(page_image)

    prompt = prompts[prompt_name]

    # If we have context, format it into the prompt
    if previous_pages_text and "_with_context" in prompt_name:
        context_str = ""
        for i, page_text in enumerate(previous_pages_text):
            context_str += f"\n--- PAGE {i+1} CONTEXT ---\n"
            context_str += json.dumps(page_text, ensure_ascii=False, indent=2)
            context_str += "\n"
        prompt = prompt.format(previous_context=context_str)
    elif "_with_context" in prompt_name:
        # No context yet (first pages)
        prompt = prompt.format(previous_context="(No previous pages yet - this is one of the first pages)")

    # Retry loop
    for attempt in range(max_retries):
        try:
            response = openai.chat.completions.create(
                model=MODEL,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/png;base64,{img_base64}"
                                }
                            }
                        ]
                    }
                ],
                reasoning_effort="low",
                temperature=1
            )
            # The model should output pure JSON
            return json.loads(response.choices[0].message.content)
        except json.JSONDecodeError as e:
            print(f"\n⚠️  Attempt {attempt + 1}/{max_retries} failed: JSON parse error")
            print(f"Error: {e}")
            if attempt < max_retries - 1:
                print(f"Retrying...\n")
                continue
            else:
                # All retries exhausted
                print("\n" + "="*80)
                print("❌ CRITICAL ERROR: JSON parse error after all retries")
                print("="*80)
                print(f"Final error: {e}")
                print(f"Raw response: {response.choices[0].message.content}")
                print("="*80)
                print("\n⚠️  STOPPING: Cannot continue with corrupted context!")
                print("Please fix this page manually before continuing.\n")
                raise SystemExit(f"JSON parse error after {max_retries} attempts: {e}")
        except Exception as e:
            # Other errors (API errors, etc.)
            print(f"\n⚠️  Attempt {attempt + 1}/{max_retries} failed: {type(e).__name__}: {e}")
            if attempt < max_retries - 1:
                print(f"Retrying...\n")
                continue
            else:
                print("\n" + "="*80)
                print("❌ CRITICAL ERROR: API error after all retries")
                print("="*80)
                print(f"Final error: {e}")
                print("="*80)
                raise SystemExit(f"API error after {max_retries} attempts: {e}")

# Checkpoint functions
def load_checkpoint(checkpoint_file):
    """Load existing checkpoint if it exists"""
    if os.path.exists(checkpoint_file):
        with open(checkpoint_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            entries = data.get('entries', [])
            # Convert list to dict with arabic_term as key (for deduplication)
            entries_dict = {}
            for entry in entries:
                key = entry.get('arabic_term', '')
                if key:
                    entries_dict[key] = entry
            print(f"✓ Loaded checkpoint: {len(entries_dict)} unique entries from {data.get('last_page', 0)} pages")
            return {
                'entries': entries_dict,
                'last_page': data.get('last_page', 0),
                'page_history': data.get('page_history', [])
            }
    return {'entries': {}, 'last_page': 0, 'page_history': []}

def save_checkpoint(checkpoint_file, entries_dict, last_page, page_history, max_history_pages=20):
    """Save checkpoint after processing a page

    Args:
        entries_dict: Dictionary with arabic_term as key
        last_page: Last processed page number
        page_history: List of previous pages' entries
        max_history_pages: Maximum pages to keep in history (default 20)
    """
    # Convert dict back to list for JSON storage
    entries_list = list(entries_dict.values())

    # Trim page_history to keep only last N pages for context
    # This prevents checkpoint file from growing too large
    trimmed_history = page_history[-max_history_pages:] if len(page_history) > max_history_pages else page_history
    # create directory if not exists
    os.makedirs(os.path.dirname(checkpoint_file), exist_ok=True)
    checkpoint_data = {
        'entries': entries_list,
        'last_page': last_page,
        'page_history': trimmed_history  # Store only recent pages for context
    }
    with open(checkpoint_file, 'w', encoding='utf-8') as f:
        json.dump(checkpoint_data, f, ensure_ascii=False, indent=2)
    print(f"  → Checkpoint saved: {len(entries_dict)} unique entries, page {last_page}, history: {len(trimmed_history)} pages")

# Main pipeline
def process_pdf(pdf_path, checkpoint_file="checkpoint.json", prompt_name="english_arabic_dictionary", context_pages=2):
    """Process PDF with context from previous pages

    Args:
        pdf_path: Path to PDF file
        checkpoint_file: Path to checkpoint file
        prompt_name: Name of prompt to use
        context_pages: Number of previous pages to include as context (default: 2)
    """
    images = extract_images_from_pdf(pdf_path)

    # Load existing checkpoint
    checkpoint = load_checkpoint(checkpoint_file)
    entries_dict = checkpoint['entries']  # Now a dict with arabic_term as key
    start_page = checkpoint['last_page']

    # Only load/maintain history if context_pages > 0
    if context_pages > 0:
        page_history = checkpoint.get('page_history', [])
    else:
        page_history = []  # Don't use history when context is disabled

    if start_page > 0:
        print(f"Resuming from page {start_page + 1}/{len(images)}")
        if context_pages > 0 and page_history:
            print(f"Loaded {len(page_history)} pages of context from checkpoint")

    for i, page_image in enumerate(images, start=1):
        # Skip pages already processed
        if i <= start_page:
            print(f"Skipping page {i}/{len(images)} (already processed)...")
            continue

        print(f"Processing page {i}/{len(images)}...")

        # Get context from previous pages (limit to context_pages)
        previous_context = page_history[-context_pages:] if context_pages > 0 else None

        if previous_context:
            print(f"  Using context from {len(previous_context)} previous page(s)")

        # Process current page with context
        entries = process_page(page_image, prompt_name, previous_context)

        # Handle continuations and add to dict (using arabic_term as key)
        new_entries = []
        for entry in entries:
            arabic_term = entry.get('arabic_term', '')
            if not arabic_term:
                print(f"  ⚠ Warning: Entry without arabic_term, skipping: {entry}")
                continue

            # Remove is_continuation flag if present
            if entry.get('is_continuation', False):
                entry_copy = entry.copy()
                entry_copy.pop('is_continuation', None)
                entry = entry_copy
                print(f"  ⚠ Entry marked as continuation (merged): {arabic_term}")

            # Add to dict - this will override any previous entry with same arabic_term
            if arabic_term in entries_dict:
                print(f"  🔄 Overriding existing entry: {arabic_term}")

            entries_dict[arabic_term] = entry
            new_entries.append(entry)

        print(f"  Extracted {len(new_entries)} entries from page {i}, total unique: {len(entries_dict)}")

        # Add current page entries to history for next page's context (only if context enabled)
        if context_pages > 0:
            page_history.append(new_entries)

        # Save checkpoint after each page
        save_checkpoint(checkpoint_file, entries_dict, i, page_history)

    # Convert dict back to list for return
    return list(entries_dict.values())

##############################################################################
# ARABIC-ONLY DICTIONARY FUNCTIONS (with diacritics)
# Output format: {"word": "definition", ...} instead of [{}, {}]
##############################################################################

def process_page_arabic_only(page_image, prompt_name, previous_pages_dict=None, max_retries=5):
    """Process a page image and extract Arabic-only dictionary data

    Args:
        page_image: PIL Image of the current page
        prompt_name: Name of the prompt to use (arabic_only_with_diacritics or arabic_only_with_diacritics_context)
        previous_pages_dict: Dictionary of extracted entries from previous pages (for context)
        max_retries: Maximum number of retry attempts (default 5)

    Returns:
        Dictionary with extracted entries
    """
    # Convert image to base64
    img_base64 = image_to_base64(page_image)

    prompt = prompts[prompt_name]

    # If we have context, format it into the prompt
    if previous_pages_dict and "_context" in prompt_name:
        context_str = ""
        for i, page_dict in enumerate(previous_pages_dict):
            context_str += f"\n--- PAGE {i+1} CONTEXT ---\n"
            context_str += json.dumps(page_dict, ensure_ascii=False, indent=2)
            context_str += "\n"
        prompt = prompt.format(previous_context=context_str)
    elif "_context" in prompt_name:
        # No context yet (first pages)
        prompt = prompt.format(previous_context="(No previous pages yet - this is one of the first pages)")

    # Retry loop
    for attempt in range(max_retries):
        try:
            response = openai.chat.completions.create(
                model=MODEL,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/png;base64,{img_base64}"
                                }
                            }
                        ]
                    }
                ],
                reasoning_effort="low",
                temperature=1
            )

            # The model should output pure JSON object (dict)
            result = json.loads(response.choices[0].message.content)
            if not isinstance(result, dict):
                print(f"\n⚠️  Attempt {attempt + 1}/{max_retries} failed: Wrong type returned")
                print(f"Expected: dict, Got: {type(result)}")
                if attempt < max_retries - 1:
                    print(f"Retrying...\n")
                    continue
                else:
                    print("\n" + "="*80)
                    print("❌ CRITICAL ERROR: Expected dict from AI, got wrong type after all retries")
                    print("="*80)
                    print(f"Expected: dict, Got: {type(result)}")
                    print(f"Raw response: {response.choices[0].message.content}")
                    print("="*80)
                    print("\n⚠️  STOPPING: Cannot continue with corrupted context!")
                    print("Please fix this page manually before continuing.\n")
                    raise SystemExit(f"Wrong type returned after {max_retries} attempts: {type(result)}")
            return result
        except json.JSONDecodeError as e:
            print(f"\n⚠️  Attempt {attempt + 1}/{max_retries} failed: JSON parse error")
            print(f"Error: {e}")
            if attempt < max_retries - 1:
                print(f"Retrying...\n")
                continue
            else:
                print("\n" + "="*80)
                print("❌ CRITICAL ERROR: JSON parse error after all retries")
                print("="*80)
                print(f"Final error: {e}")
                print(f"Raw response: {response.choices[0].message.content}")
                print("="*80)
                print("\n⚠️  STOPPING: Cannot continue with corrupted context!")
                print("Please fix this page manually before continuing.\n")
                raise SystemExit(f"JSON parse error after {max_retries} attempts: {e}")
        except Exception as e:
            # Other errors (API errors, etc.)
            print(f"\n⚠️  Attempt {attempt + 1}/{max_retries} failed: {type(e).__name__}: {e}")
            if attempt < max_retries - 1:
                print(f"Retrying...\n")
                continue
            else:
                print("\n" + "="*80)
                print("❌ CRITICAL ERROR: API error after all retries")
                print("="*80)
                print(f"Final error: {e}")
                print("="*80)
                raise SystemExit(f"API error after {max_retries} attempts: {e}")

def load_checkpoint_arabic_only(checkpoint_file):
    """Load existing checkpoint for Arabic-only dictionary

    Returns:
        {
            'entries': dict,  # Single dictionary with all entries
            'last_page': int,
            'page_history': list,  # List of dicts from previous pages
            'last_entry_word': str  # Last word for continuation tracking
        }
    """
    if os.path.exists(checkpoint_file):
        with open(checkpoint_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            entries = data.get('entries', {})
            last_page = data.get('last_page', 0)
            page_history = data.get('page_history', [])
            last_entry_word = data.get('last_entry_word', '')

            print(f"✓ Loaded checkpoint: {len(entries)} unique entries from {last_page} pages")
            if last_entry_word:
                print(f"  Last entry: {last_entry_word}")

            return {
                'entries': entries,
                'last_page': last_page,
                'page_history': page_history,
                'last_entry_word': last_entry_word
            }
    return {'entries': {}, 'last_page': 0, 'page_history': [], 'last_entry_word': ''}

def save_checkpoint_arabic_only(checkpoint_file, entries_dict, last_page, page_history, last_entry_word, max_history_pages=20):
    """Save checkpoint for Arabic-only dictionary

    Args:
        entries_dict: Dictionary with all entries
        last_page: Last processed page number
        page_history: List of previous pages' dictionaries
        last_entry_word: Word of the last entry (for continuation tracking)
        max_history_pages: Maximum pages to keep in history (default 20)
    """
    # Trim page_history to keep only last N pages for context
    # This prevents checkpoint file from growing too large
    trimmed_history = page_history[-max_history_pages:] if len(page_history) > max_history_pages else page_history

    checkpoint_data = {
        'entries': entries_dict,
        'last_page': last_page,
        'page_history': trimmed_history,
        'last_entry_word': last_entry_word
    }
    os.makedirs(os.path.dirname(checkpoint_file), exist_ok=True)
    with open(checkpoint_file, 'w', encoding='utf-8') as f:
        json.dump(checkpoint_data, f, ensure_ascii=False, indent=2)
    print(f"  → Checkpoint saved: {len(entries_dict)} unique entries, page {last_page}, history: {len(trimmed_history)} pages")

def process_pdf_arabic_only(pdf_path, checkpoint_file="checkpoint.json", prompt_name="arabic_only_with_diacritics", context_pages=3):
    """Process PDF with Arabic-only dictionary (preserving diacritics)

    Args:
        pdf_path: Path to PDF file
        checkpoint_file: Path to checkpoint file
        prompt_name: Name of prompt to use
        context_pages: Number of previous pages to include as context (default: 3, for definitions spanning up to 3 pages)

    Returns:
        Dictionary with all entries
    """
    images = extract_images_from_pdf(pdf_path)

    # Load existing checkpoint
    checkpoint = load_checkpoint_arabic_only(checkpoint_file)
    entries_dict = checkpoint['entries']
    start_page = checkpoint['last_page']
    last_entry_word = checkpoint['last_entry_word']

    # Only load/maintain history if context_pages > 0
    if context_pages > 0:
        page_history = checkpoint.get('page_history', [])
    else:
        page_history = []

    if start_page > 0:
        print(f"Resuming from page {start_page + 1}/{len(images)}")
        if context_pages > 0 and page_history:
            print(f"Loaded {len(page_history)} pages of context from checkpoint")

    for i, page_image in enumerate(images, start=1):
        # Skip pages already processed
        if i <= start_page:
            print(f"Skipping page {i}/{len(images)} (already processed)...")
            continue

        print(f"Processing page {i}/{len(images)}...")

        # Get context from previous pages (limit to context_pages)
        previous_context = page_history[-context_pages:] if context_pages > 0 else None

        if previous_context:
            print(f"  Using context from {len(previous_context)} previous page(s)")

        # Process current page with context
        page_dict = process_page_arabic_only(page_image, prompt_name, previous_context)

        # Handle continuations and merge entries
        new_entries_count = 0

        # Check for continuation marker
        if "__continuation__" in page_dict:
            continuation_text = page_dict.pop("__continuation__")

            if last_entry_word and last_entry_word in entries_dict:
                # Append continuation to last entry
                entries_dict[last_entry_word] += " " + continuation_text
                print(f"  📝 Continuation merged to: {last_entry_word}")
            else:
                print(f"  ⚠️ Warning: Continuation found but no previous entry to merge with")

        # Add all other entries from this page
        for word, definition in page_dict.items():
            if word in entries_dict:
                print(f"  🔄 Overriding existing entry: {word}")

            entries_dict[word] = definition
            last_entry_word = word  # Track last word for next page's continuation
            new_entries_count += 1

        print(f"  Extracted {new_entries_count} entries from page {i}, total unique: {len(entries_dict)}")

        # Add current page dict to history for next page's context (only if context enabled)
        if context_pages > 0:
            page_history.append(page_dict)

        # Save checkpoint after each page
        save_checkpoint_arabic_only(checkpoint_file, entries_dict, i, page_history, last_entry_word)

    return entries_dict

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Extract structured data from PDF files using GPT-5.1 with optional page context"
    )
    parser.add_argument("--prompt", type=str, required=True,
                        help="Prompt name to use (e.g., 'english_arabic_dictionary', 'arabic_only_with_diacritics_context', etc.)")
    parser.add_argument("--pdf_file", type=str, required=True,
                        help="Path to PDF file to process")
    parser.add_argument("--checkpoint_file", type=str, required=True,
                        help="Path to checkpoint file for resumable processing")
    parser.add_argument("--output_file", type=str, required=True,
                        help="Path to output JSON file")
    parser.add_argument("--context_pages", type=int, default=2,
                        help="Number of previous pages to include as context (default: 2 for bilingual, 3 for Arabic-only, set to 0 to disable)")
    args = parser.parse_args()

    pdf_file = args.pdf_file
    checkpoint_file = args.checkpoint_file
    output_file = args.output_file
    prompt = args.prompt
    context_pages = args.context_pages

    print(f"Configuration:")
    print(f"  PDF: {pdf_file}")
    print(f"  Prompt: {prompt}")
    print(f"  Context pages: {context_pages}")
    print(f"  Checkpoint: {checkpoint_file}")
    print(f"  Output: {output_file}")
    print()

    # Detect which type of processing to use based on prompt name
    if prompt.startswith("arabic_only"):
        # Use Arabic-only processing (outputs dictionary format)
        print("📖 Using Arabic-only dictionary processing")
        data = process_pdf_arabic_only(pdf_file, checkpoint_file, prompt, context_pages)
    else:
        # Use bilingual processing (outputs list format)
        print("📖 Using bilingual dictionary processing")
        data = process_pdf(pdf_file, checkpoint_file, prompt, context_pages)

    # Save the final results as JSON
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"✅ Extraction complete! Results saved to {output_file}")

    if isinstance(data, dict):
        print(f"   Total entries: {len(data)} (dictionary format)")
    elif isinstance(data, list):
        print(f"   Total entries: {len(data)} (list format)")

    # Optionally remove checkpoint after successful completion
    if os.path.exists(checkpoint_file):
        os.remove(checkpoint_file)
        print(f"✓ Checkpoint file removed")

# Examples:
#
# Basic extraction without context:
# python pdf_to_json.py --prompt english_arabic_dictionary --pdf_file pdf/mojam_nabat.pdf --checkpoint_file json/mojam_nabat/checkpoint.json --output_file json/mojam_nabat/output.json
#
# Right-to-left dictionary with context from previous 2 pages (for handling continuations):
# python pdf_to_json.py --prompt english_arabic_dictionary_with_context --pdf_file pdf/physica1.pdf --checkpoint_file json/physica1/checkpoint.json --output_file json/physica1/output.json --context_pages 2
#
# Right-to-left dictionary with context from previous 3 pages:
# python pdf_to_json.py --prompt english_arabic_dictionary_with_context --pdf_file pdf/physica1.pdf --checkpoint_file json/physica1/checkpoint.json --output_file json/physica1/output.json --context_pages 3
#
# Flat dictionary with context from previous 2 pages (for handling continuations):
# python pdf_to_json.py --prompt flat_dictionary_with_context --pdf_file pdf/some_dictionary.pdf --checkpoint_file json/some_dictionary/checkpoint.json --output_file json/some_dictionary/output.json --context_pages 2
#
# Arabic-only dictionary with diacritics (no context):
# python pdf_to_json.py --prompt arabic_only_with_diacritics --pdf_file pdf/arabic_dict.pdf --checkpoint_file json/arabic_dict/checkpoint.json --output_file json/arabic_dict/output.json --context_pages 0
#
# Arabic-only dictionary with diacritics and context for multi-page definitions:
# python pdf_to_json.py --prompt arabic_only_with_diacritics_context --pdf_file pdf/arabic_dict.pdf --checkpoint_file json/arabic_dict/checkpoint.json --output_file json/arabic_dict/output.json --context_pages 3