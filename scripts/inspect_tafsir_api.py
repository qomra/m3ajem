#!/usr/bin/env python3
"""
Inspect tafsir.app API to understand how to get next/previous words
"""

import requests
import json
import urllib.parse

def inspect_api_response(word: str, source: str = "lisan"):
    """Fetch a word and inspect the response structure."""
    # URL encode the word
    encoded_word = urllib.parse.quote(word)
    url = f"https://tafsir.app/get_word.php?src={source}&w={encoded_word}"
    
    print(f"Fetching: {url}")
    print(f"Word: {word}")
    print("-" * 80)
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        
        # Parse JSON response
        data = response.json()
        
        # Pretty print the response
        print("Response structure:")
        print(json.dumps(data, ensure_ascii=False, indent=2))
        
        # Check for next/previous word information
        print("\n" + "=" * 80)
        print("Looking for navigation info (next/prev word):")
        
        if isinstance(data, dict):
            for key in data.keys():
                print(f"  - Key: {key}")
                if "next" in key.lower() or "prev" in key.lower() or "nav" in key.lower():
                    print(f"    *** FOUND NAVIGATION KEY: {key} = {data[key]}")
        
        return data
        
    except Exception as e:
        print(f"Error: {e}")
        return None

if __name__ == "__main__":
    # Test with the word from the user's example
    word = "أبأ"
    
    print("=" * 80)
    print("INSPECTING TAFSIR.APP API")
    print("=" * 80 + "\n")
    
    data = inspect_api_response(word)
    
    if data:
        print("\n" + "=" * 80)
        print("ANALYSIS:")
        print("=" * 80)
        print("\nTo scrape all words, we need to:")
        print("1. Check if API returns next/prev word info")
        print("2. If not, we need to find a word list or index")
        print("3. Or iterate through Arabic alphabet combinations")

