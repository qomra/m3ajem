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
def process_page(page_image, prompt_name, previous_pages_text=None):
    """Process a page image and extract data

    Args:
        page_image: PIL Image of the current page
        prompt_name: Name of the prompt to use
        previous_pages_text: List of extracted text from previous pages (for context)
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
    try:
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print("JSON parse error:", e)
        print("Raw response:", response.choices[0].message.content)
        return []

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

def save_checkpoint(checkpoint_file, entries_dict, last_page, page_history):
    """Save checkpoint after processing a page

    Args:
        entries_dict: Dictionary with arabic_term as key
        last_page: Last processed page number
        page_history: List of previous pages' entries
    """
    # Convert dict back to list for JSON storage
    entries_list = list(entries_dict.values())

    checkpoint_data = {
        'entries': entries_list,
        'last_page': last_page,
        'page_history': page_history  # Store extracted text from previous pages
    }
    with open(checkpoint_file, 'w', encoding='utf-8') as f:
        json.dump(checkpoint_data, f, ensure_ascii=False, indent=2)
    print(f"  → Checkpoint saved: {len(entries_dict)} unique entries, page {last_page}, history: {len(page_history)} pages")

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

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Extract structured data from PDF files using GPT-5.1 with optional page context"
    )
    parser.add_argument("--prompt", type=str, required=True,
                        help="Prompt name to use (e.g., 'english_arabic_dictionary', 'english_arabic_dictionary_with_context', 'flat_dictionary_with_context')")
    parser.add_argument("--pdf_file", type=str, required=True,
                        help="Path to PDF file to process")
    parser.add_argument("--checkpoint_file", type=str, required=True,
                        help="Path to checkpoint file for resumable processing")
    parser.add_argument("--output_file", type=str, required=True,
                        help="Path to output JSON file")
    parser.add_argument("--context_pages", type=int, default=2,
                        help="Number of previous pages to include as context (default: 2, set to 0 to disable)")
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

    data = process_pdf(pdf_file, checkpoint_file, prompt, context_pages)

    # Save the final results as JSON
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"✅ Extraction complete! Results saved to {output_file}")
    print(f"   Total entries: {len(data)}")

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