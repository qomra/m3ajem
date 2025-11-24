import openai
import base64
from io import BytesIO
from PIL import Image
import fitz  # PyMuPDF
import json
import os

# Set your API key (recommended: store in environment variable)
openai.api_key = "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"

# Model configuration
MODEL = "gpt-5.1"  # lower-cost, faster version of GPT-5.1

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
def process_page(page_image):
    """Process a page image and extract data"""
    # Convert image to base64
    img_base64 = image_to_base64(page_image)
    
    prompt = """
You are given a page from a bilingual English–Arabic botanical lexicon.
Extract data as a JSON array like:
[{"english":"...", "arabic":"...", "arabic_main_word":"..."}]
Return only valid JSON.
"""
    
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
        temperature=1
    )
    # The model should output pure JSON
    import json
    try:
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print("JSON parse error:", e)
        return []

# Checkpoint functions
def load_checkpoint(checkpoint_file):
    """Load existing checkpoint if it exists"""
    if os.path.exists(checkpoint_file):
        with open(checkpoint_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            print(f"✓ Loaded checkpoint: {len(data.get('entries', []))} entries from {data.get('last_page', 0)} pages")
            return data
    return {'entries': [], 'last_page': 0}

def save_checkpoint(checkpoint_file, entries, last_page):
    """Save checkpoint after processing a page"""
    checkpoint_data = {
        'entries': entries,
        'last_page': last_page
    }
    with open(checkpoint_file, 'w', encoding='utf-8') as f:
        json.dump(checkpoint_data, f, ensure_ascii=False, indent=2)
    print(f"  → Checkpoint saved: {len(entries)} entries, page {last_page}")

# Main pipeline
def process_pdf(pdf_path, checkpoint_file="checkpoint.json"):
    images = extract_images_from_pdf(pdf_path)
    
    # Load existing checkpoint
    checkpoint = load_checkpoint(checkpoint_file)
    all_entries = checkpoint['entries']
    start_page = checkpoint['last_page']
    
    if start_page > 0:
        print(f"Resuming from page {start_page + 1}/{len(images)}")
    
    for i, page_image in enumerate(images, start=1):
        # Skip pages already processed
        if i <= start_page:
            print(f"Skipping page {i}/{len(images)} (already processed)...")
            continue
            
        print(f"Processing page {i}/{len(images)}...")
        entries = process_page(page_image)
        all_entries.extend(entries)
        print(f"  Extracted {len(entries)} entries from page {i}")
        
        # Save checkpoint after each page
        save_checkpoint(checkpoint_file, all_entries, i)
    
    return all_entries

if __name__ == "__main__":
    pdf_file = "mojama_nabat.pdf"
    checkpoint_file = "checkpoint.json"
    output_file = "arabic_english_output.json"
    
    data = process_pdf(pdf_file, checkpoint_file)

    # Save the final results as JSON
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"✅ Extraction complete! Results saved to {output_file}")
    print(f"   Total entries: {len(data)}")
    
    # Optionally remove checkpoint after successful completion
    if os.path.exists(checkpoint_file):
        os.remove(checkpoint_file)
        print(f"✓ Checkpoint file removed")
