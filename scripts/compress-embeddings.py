#!/usr/bin/env python3
"""
Convert embeddings JSON to compressed binary format
This reduces size from ~289MB to ~20-30MB
"""

import json
import struct
import gzip

INPUT_FILE = "../assets/data/optimized/spectrum-embeddings.json"
OUTPUT_FILE = "../assets/data/optimized/spectrum-embeddings.bin.gz"

def main():
    print("Loading embeddings JSON...")
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print(f"Loaded {len(data['roots'])} embeddings")
    print(f"Dimensions: {data['dimensions']}")

    # Create binary format
    print("\nCreating binary format...")
    binary_data = bytearray()

    # Header: magic number, version, dimensions, count
    binary_data.extend(b'SPEC')  # Magic number
    binary_data.extend(struct.pack('<I', 1))  # Version
    binary_data.extend(struct.pack('<I', data['dimensions']))  # Dimensions
    binary_data.extend(struct.pack('<I', len(data['roots'])))  # Count

    # For each root
    for entry in data['roots']:
        root = entry['root']
        embedding = entry['embedding']

        # Write root string: length (2 bytes) + UTF-8 bytes
        root_bytes = root.encode('utf-8')
        binary_data.extend(struct.pack('<H', len(root_bytes)))
        binary_data.extend(root_bytes)

        # Write embedding: array of float32
        for value in embedding:
            binary_data.extend(struct.pack('<f', value))

    uncompressed_size = len(binary_data)
    print(f"Uncompressed binary size: {uncompressed_size / 1024 / 1024:.2f} MB")

    # Compress with gzip
    print("Compressing with gzip...")
    with gzip.open(OUTPUT_FILE, 'wb', compresslevel=9) as f:
        f.write(binary_data)

    import os
    compressed_size = os.path.getsize(OUTPUT_FILE)
    print(f"Compressed size: {compressed_size / 1024 / 1024:.2f} MB")
    print(f"Compression ratio: {compressed_size / uncompressed_size * 100:.1f}%")

    print(f"\n✓ Saved to {OUTPUT_FILE}")
    print(f"\nSize reduction: {289 - compressed_size / 1024 / 1024:.2f} MB saved!")

if __name__ == "__main__":
    main()
