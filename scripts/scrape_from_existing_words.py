#!/usr/bin/env python3
"""
Use existing word list from maajim.json (Lisan dictionary)
and scrape definitions from tafsir.app
"""

import json
import requests
import time
from pathlib import Path

def load_existing_lisan_words():
    """Load Lisan al-Arab words from existing maajim.json"""
    maajim_file = Path("/Users/jalalirs/code/m3ajem/assets/data/optimized/maajim.json")
    
    print(f"Loading existing dictionary from {maajim_file}...")
    
    with open(maajim_file, 'r', encoding='utf-8') as f:
        dictionaries = json.load(f)
    
    # Find Lisan al-Arab
    lisan = None
    for dict_entry in dictionaries:
        if 'لسان' in dict_entry['name'] or 'lisān' in dict_entry.get('name', '').lower():
            lisan = dict_entry
            break
    
    if not lisan:
        print("ERROR: Could not find Lisan al-Arab in maajim.json")
        print("\nAvailable dictionaries:")
        for d in dictionaries:
            print(f"  - {d['name']}")
        return []
    
    print(f"✓ Found: {lisan['name']}")
    
    # Extract all words (keys from data dict)
    words = list(lisan['data'].keys())
    print(f"✓ Extracted {len(words)} words")
    
    return words

def scrape_from_tafsir(words, output_file, checkpoint_interval=100):
    """Scrape definitions from tafsir.app for the word list"""
    
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    })
    
    checkpoint_file = str(output_file).replace('.json', '_checkpoint.json')
    results = []
    
    # Load checkpoint
    if Path(checkpoint_file).exists():
        print(f"\nLoading checkpoint...")
        with open(checkpoint_file, 'r', encoding='utf-8') as f:
            checkpoint = json.load(f)
            results = checkpoint['results']
            start_idx = checkpoint['next_idx']
            print(f"Resuming from word #{start_idx + 1}")
    else:
        start_idx = 0
    
    print(f"\nScraping {len(words)} words from tafsir.app...")
    print(f"Output: {output_file}")
    print("="*80)
    
    for idx in range(start_idx, len(words)):
        word = words[idx]
        print(f"[{idx+1}/{len(words)}] {word}... ", end='', flush=True)
        
        try:
            url = "https://tafsir.app/get_word.php"
            params = {'src': 'lisan', 'w': word}
            response = session.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            definition = data.get('data', '')
            
            if definition:
                results.append({
                    'word': word,
                    'definition': definition
                })
                print("✓")
            else:
                print("✗ (empty)")
                
        except Exception as e:
            print(f"✗ ({e})")
        
        # Checkpoint
        if (idx + 1) % checkpoint_interval == 0:
            with open(checkpoint_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'results': results,
                    'next_idx': idx + 1
                }, f, ensure_ascii=False)
            print(f"  → Checkpoint saved ({len(results)} words)")
        
        # Be respectful
        time.sleep(0.5)
    
    # Save final
    print(f"\n{'='*80}")
    print(f"Saving {len(results)} words...")
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    # Also save as text
    text_file = str(output_file).replace('.json', '.txt')
    with open(text_file, 'w', encoding='utf-8') as f:
        for item in results:
            f.write(f"\n{'='*80}\n")
            f.write(f"كلمة: {item['word']}\n")
            f.write(f"{'-'*80}\n")
            f.write(f"{item['definition']}\n")
    
    print(f"✓ JSON: {output_file}")
    print(f"✓ TXT: {text_file}")
    
    # Clean up checkpoint
    if Path(checkpoint_file).exists():
        Path(checkpoint_file).unlink()
        print(f"✓ Checkpoint removed")

if __name__ == "__main__":
    output_dir = Path("/Users/jalalirs/code/m3ajem/assets/data/scraped")
    output_dir.mkdir(exist_ok=True, parents=True)
    
    print("="*80)
    print("SCRAPING LISAN AL-ARAB FROM TAFSIR.APP")
    print("="*80 + "\n")
    
    # Step 1: Get word list from existing data
    words = load_existing_lisan_words()
    
    if not words:
        print("\nERROR: No words found")
        exit(1)
    
    # Step 2: Scrape from tafsir.app
    output_file = output_dir / "lisan_tafsir.json"
    
    try:
        scrape_from_tafsir(words, output_file)
    except KeyboardInterrupt:
        print("\n\nInterrupted by user. Progress saved in checkpoint.")

