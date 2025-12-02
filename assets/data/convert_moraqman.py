#!/usr/bin/env python3
"""
Convert Moraqman Dictionaries to Unified Format
================================================
Converts AI-digitized dictionaries from various formats to the unified ommat.json format.

Supported formats:
    1. arabic_english_array: Array of {english, arabic, arabic_term}
    2. arabic_only_dict: Dictionary with {entries: {word: definition}} or direct {word: definition}

Output format (ommat-compatible):
    {
        "name": "معجم المصطلحات الميكانيكية",
        "description": "...",
        "type": "moraqman",
        "data": {
            "term1": "definition1",
            "term2": "definition2"
        }
    }

Usage:
    python3 convert_moraqman.py
"""

import json
import os
from typing import Dict, List, Union


def read_description_file(folder_path: str) -> tuple[str, str]:
    """
    Read name and description from the description file in a folder.

    Format:
        Line 1: Dictionary name
        Remaining lines: Description

    Returns:
        Tuple of (name, description)
    """
    desc_file = os.path.join(folder_path, 'description')

    if not os.path.exists(desc_file):
        folder_name = os.path.basename(folder_path)
        return folder_name, f'معجم {folder_name}'

    with open(desc_file, 'r', encoding='utf-8') as f:
        content = f.read().strip()

    if not content:
        folder_name = os.path.basename(folder_path)
        return folder_name, f'معجم {folder_name}'

    lines = content.split('\n')
    name = lines[0].strip()
    description = '\n'.join(lines[1:]).strip() if len(lines) > 1 else name

    return name, description


def detect_format(data: Union[List, Dict]) -> str:
    """
    Detect the format of the loaded JSON data.

    Returns:
        'arabic_english_array' - Array of {english, arabic, arabic_term}
        'arabic_only_dict_nested' - Dict with {entries: {word: definition}}
        'arabic_only_dict_flat' - Direct {word: definition} dict
    """
    if isinstance(data, list):
        return 'arabic_english_array'
    elif isinstance(data, dict):
        if 'entries' in data and isinstance(data['entries'], dict):
            return 'arabic_only_dict_nested'
        else:
            return 'arabic_only_dict_flat'
    else:
        raise ValueError(f"Unknown data type: {type(data)}")


def process_arabic_english_array(data: List[Dict]) -> Dict[str, str]:
    """
    Process Format: Array of {english, arabic, arabic_term}
    Returns: Dictionary {arabic_term: arabic}
    """
    result = {}
    skipped = 0

    for entry in data:
        arabic_term = entry.get('arabic_term') or entry.get('arabic_main_word', '')
        arabic = entry.get('arabic', '')

        if not arabic_term:
            skipped += 1
            continue

        result[arabic_term] = arabic

    if skipped > 0:
        print(f"  ⚠️ Skipped {skipped} entries without arabic_term")

    return result


def process_arabic_only_dict_nested(data: Dict) -> Dict[str, str]:
    """
    Process Format: {entries: {word: definition}}
    Returns: Dictionary {word: definition}
    """
    return data['entries']


def process_arabic_only_dict_flat(data: Dict) -> Dict[str, str]:
    """
    Process Format: Direct {word: definition}
    Returns: Dictionary as-is
    """
    return data


def load_dictionary_file(file_path: str) -> Union[List, Dict]:
    """Load JSON file and return data."""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def find_source_files(folder_path: str, output_filename: str) -> List[str]:
    """
    Find source JSON files in a folder, excluding the output file.

    Returns list of source file paths, sorted by priority.
    """
    json_files = [f for f in os.listdir(folder_path) if f.endswith('.json')]

    # Exclude already-converted output file
    json_files = [f for f in json_files if f != output_filename]

    if not json_files:
        return []

    # Priority order for source files
    priorities = [
        'arabic_english_output.json',
        'arabic_english_book.json',
        'output.json',
        'checkpoint.json',
        'book_1.json',  # For multi-file dicts like physica
    ]

    # Sort by priority
    def priority_key(filename):
        try:
            return priorities.index(filename)
        except ValueError:
            return len(priorities)  # Unknown files go last

    return sorted(json_files, key=priority_key)


def convert_dictionary(folder_path: str) -> Dict:
    """
    Convert a dictionary from its source format to unified format.

    Args:
        folder_path: Path to dictionary folder

    Returns:
        Unified dictionary object
    """
    folder_name = os.path.basename(folder_path)
    output_filename = f"{folder_name}.json"

    # Read metadata from description file
    name, description = read_description_file(folder_path)

    print(f"\n📖 Processing {name}...")
    print(f"   Folder: {folder_name}")

    # Find source files
    source_files = find_source_files(folder_path, output_filename)

    if not source_files:
        raise FileNotFoundError(f"No source JSON files found in {folder_path}")

    # Check if this is a multi-file dictionary (like physica with book_1, book_2)
    book_files = [f for f in source_files if f.startswith('book_')]

    if len(book_files) > 1:
        # Multi-file dictionary - combine all book files
        print(f"   Loading {len(book_files)} book files...")
        combined_data = []
        for book_file in sorted(book_files):
            file_path = os.path.join(folder_path, book_file)
            data = load_dictionary_file(file_path)
            if isinstance(data, list):
                combined_data.extend(data)
                print(f"     ✓ {book_file}: {len(data)} entries")
            else:
                print(f"     ⚠️ {book_file}: unexpected format")
        data = combined_data
    else:
        # Single file - use the highest priority source
        source_file = source_files[0]
        file_path = os.path.join(folder_path, source_file)
        print(f"   Loading {source_file}...")
        data = load_dictionary_file(file_path)

    # Detect format and process
    format_type = detect_format(data)
    print(f"   Format: {format_type}")

    if format_type == 'arabic_english_array':
        processed_data = process_arabic_english_array(data)
    elif format_type == 'arabic_only_dict_nested':
        processed_data = process_arabic_only_dict_nested(data)
    elif format_type == 'arabic_only_dict_flat':
        processed_data = process_arabic_only_dict_flat(data)
    else:
        raise ValueError(f"Unknown format: {format_type}")

    print(f"   ✓ Processed {len(processed_data)} entries")

    # Create unified format
    unified = {
        'name': name,
        'description': description,
        'type': 'moraqman',
        'data': processed_data
    }

    # Save to output file
    output_path = os.path.join(folder_path, output_filename)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(unified, f, ensure_ascii=False, indent=2)

    print(f"   ✓ Saved to {output_filename}")

    return unified


def main():
    """Main conversion process."""
    print("=" * 70)
    print("Converting Moraqman Dictionaries to Unified Format")
    print("=" * 70)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    moraqman_dir = os.path.join(base_dir, 'maajim', 'moraqman')

    if not os.path.exists(moraqman_dir):
        print(f"❌ Moraqman directory not found: {moraqman_dir}")
        return [], ["Moraqman directory not found"]

    # Get all subdirectories in moraqman folder
    folders = [
        f for f in os.listdir(moraqman_dir)
        if os.path.isdir(os.path.join(moraqman_dir, f))
    ]

    print(f"\nFound {len(folders)} dictionary folders:")
    for folder in sorted(folders):
        print(f"   • {folder}")

    converted_dicts = []
    errors = []

    # Convert each dictionary
    for folder_name in sorted(folders):
        try:
            folder_path = os.path.join(moraqman_dir, folder_name)
            unified_dict = convert_dictionary(folder_path)
            converted_dicts.append(unified_dict)
        except Exception as e:
            error_msg = f"Error converting {folder_name}: {str(e)}"
            print(f"\n❌ {error_msg}")
            errors.append(error_msg)

    # Summary
    print("\n" + "=" * 70)
    print(f"✅ Conversion Complete!")
    print(f"   Converted: {len(converted_dicts)} dictionaries")
    if errors:
        print(f"   Errors: {len(errors)}")
        for error in errors:
            print(f"     - {error}")
    print("=" * 70)

    # Display converted dictionaries
    print("\n📚 Converted Dictionaries:")
    total_entries = 0
    for d in converted_dicts:
        entries = len(d['data'])
        total_entries += entries
        print(f"   • {d['name']}: {entries:,} entries")

    print(f"\n   Total: {total_entries:,} entries across {len(converted_dicts)} dictionaries")

    return converted_dicts, errors


if __name__ == '__main__':
    converted, errors = main()
    if errors:
        exit(1)
