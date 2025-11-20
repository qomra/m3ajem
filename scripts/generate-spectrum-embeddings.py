#!/usr/bin/env python3
"""
Generate embeddings for spectrum.json semantic descriptions
Usage: python3 generate-spectrum-embeddings.py <OPENAI_API_KEY>
Output: assets/data/optimized/spectrum-embeddings.json
"""

import json
import sys
import time
from openai import OpenAI

# Configuration
SPECTRUM_FILE = "../assets/data/optimized/spectrum.json"
OUTPUT_FILE = "../assets/data/optimized/spectrum-embeddings.json"
EMBEDDING_MODEL = "text-embedding-3-small"  # 1536 dimensions, cost-effective
BATCH_SIZE = 100  # Process in batches to avoid rate limits

def load_spectrum():
    """Load spectrum.json file"""
    with open(SPECTRUM_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def generate_embeddings(client, texts, batch_size=BATCH_SIZE):
    """Generate embeddings for a list of texts in batches"""
    all_embeddings = []

    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        print(f"Processing batch {i // batch_size + 1}/{(len(texts) + batch_size - 1) // batch_size}...")

        try:
            response = client.embeddings.create(
                model=EMBEDDING_MODEL,
                input=batch
            )

            batch_embeddings = [item.embedding for item in response.data]
            all_embeddings.extend(batch_embeddings)

            # Rate limiting - wait 1 second between batches
            if i + batch_size < len(texts):
                time.sleep(1)

        except Exception as e:
            print(f"Error processing batch: {e}")
            raise

    return all_embeddings

def main():
    if len(sys.argv) != 2:
        print("Usage: python3 generate-spectrum-embeddings.py <OPENAI_API_KEY>")
        sys.exit(1)

    api_key = sys.argv[1]
    client = OpenAI(api_key=api_key)

    print("Loading spectrum.json...")
    spectrum = load_spectrum()

    print(f"Found {len(spectrum)} roots")

    # Prepare data
    roots = list(spectrum.keys())
    descriptions = list(spectrum.values())

    print(f"Generating embeddings using {EMBEDDING_MODEL}...")
    embeddings = generate_embeddings(client, descriptions)

    # Create output structure
    output = {
        "model": EMBEDDING_MODEL,
        "dimensions": len(embeddings[0]),
        "roots": []
    }

    for root, embedding in zip(roots, embeddings):
        output["roots"].append({
            "root": root,
            "embedding": embedding
        })

    # Save to file
    print(f"Saving to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, separators=(',', ':'))

    print(f"✓ Successfully generated {len(embeddings)} embeddings")
    print(f"  Model: {EMBEDDING_MODEL}")
    print(f"  Dimensions: {len(embeddings[0])}")
    print(f"  Output: {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
