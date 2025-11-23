#!/usr/bin/env python3
"""
Scrape all Lisan al-Arab words from tafsir.app
Strategy: Find the word list in the JavaScript, then scrape each word's definition
"""

import requests
import json
import re
import time
import urllib.parse
from pathlib import Path

class TafsirLisanScraper:
    def __init__(self):
        self.base_url = "https://tafsir.app"
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
        self.session = requests.Session()
        self.session.headers.update(self.headers)
    
    def extract_word_list_from_js(self):
        """Extract the word list from the JavaScript on the main page."""
        print("Fetching main page to extract word list...")
        url = f"{self.base_url}/lisan/%D8%A2"  # First word
        
        response = self.session.get(url)
        response.raise_for_status()
        
        html = response.text
        
        # Look for JavaScript arrays that might contain word lists
        # Common patterns: words = [...], entries = [...], list = [...]
        
        # Try to find the script that contains the word data
        # Look for patterns like: var words = [...] or const entries = [...]
        patterns = [
            r'(?:var|let|const)\s+(\w*words?\w*)\s*=\s*(\[[\s\S]*?\]);',
            r'(?:var|let|const)\s+(\w*entries\w*)\s*=\s*(\[[\s\S]*?\]);',
            r'(?:var|let|const)\s+(\w*list\w*)\s*=\s*(\[[\s\S]*?\]);',
            r'(\w*words?\w*)\s*:\s*(\[[\s\S]*?\])',
        ]
        
        for pattern in patterns:
            matches = re.finditer(pattern, html, re.IGNORECASE)
            for match in matches:
                var_name = match.group(1)
                array_content = match.group(2)
                
                # Check if it looks like Arabic words
                if 'ا' in array_content or '\\u0' in array_content:
                    print(f"Found potential word array: {var_name}")
                    print(f"Preview: {array_content[:200]}...")
                    
                    try:
                        # Try to parse as JSON
                        words = json.loads(array_content)
                        if isinstance(words, list) and len(words) > 10:
                            print(f"Successfully parsed {len(words)} words!")
                            return words
                    except:
                        pass
        
        # Alternative: Look for embedded JSON data
        json_pattern = r'<script[^>]*type=["\']application/json["\'][^>]*>(.*?)</script>'
        json_matches = re.finditer(json_pattern, html, re.DOTALL)
        
        for match in json_matches:
            try:
                data = json.loads(match.group(1))
                if isinstance(data, dict):
                    # Look for word lists in the data
                    for key, value in data.items():
                        if isinstance(value, list) and len(value) > 10:
                            # Check if first item looks like Arabic
                            if value and isinstance(value[0], str) and any(ord(c) > 1500 for c in value[0][:10]):
                                print(f"Found word list in JSON script: {key}")
                                return value
            except:
                pass
        
        print("Could not find word list in JavaScript")
        return None
    
    def get_word_definition(self, word):
        """Fetch word definition from API."""
        url = f"{self.base_url}/get_word.php"
        params = {
            'src': 'lisan',
            'w': word
        }
        
        try:
            response = self.session.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            return data.get('data', '')
        except Exception as e:
            print(f"Error fetching {word}: {e}")
            return None
    
    def scrape_all_words(self, output_file, checkpoint_interval=100):
        """Main scraping function."""
        print("="*80)
        print("STEP 1: Extract word list")
        print("="*80)
        
        word_list = self.extract_word_list_from_js()
        
        if not word_list:
            print("\nCould not extract word list from JavaScript.")
            print("Attempting alternative strategy: scrape from GitHub or find data file...")
            # The website might load words from a separate data file
            # Try common endpoints
            for endpoint in ['/data/lisan.json', '/data/words.json', '/lisan.json']:
                try:
                    url = self.base_url + endpoint
                    print(f"Trying: {url}")
                    response = self.session.get(url)
                    if response.status_code == 200:
                        data = response.json()
                        if isinstance(data, list):
                            word_list = data
                            print(f"Found word list at {endpoint}!")
                            break
                except:
                    pass
        
        if not word_list:
            print("\nERROR: Could not find word list.")
            print("The website likely loads words dynamically.")
            print("\nSuggested alternatives:")
            print("1. Check browser DevTools Network tab when navigating words")
            print("2. Look for the data file URL that contains the word list")
            print("3. Use browser automation (Selenium) to extract words")
            return
        
        print(f"\n{'='*80}")
        print(f"STEP 2: Scrape definitions for {len(word_list)} words")
        print(f"{'='*80}\n")
        
        checkpoint_file = str(output_file).replace('.json', '_checkpoint.json')
        results = []
        
        # Load checkpoint if exists
        if Path(checkpoint_file).exists():
            print(f"Loading checkpoint...")
            with open(checkpoint_file, 'r', encoding='utf-8') as f:
                checkpoint = json.load(f)
                results = checkpoint['results']
                start_idx = checkpoint['next_idx']
                print(f"Resuming from word #{start_idx}")
        else:
            start_idx = 0
        
        for idx, word in enumerate(word_list[start_idx:], start=start_idx):
            print(f"[{idx+1}/{len(word_list)}] {word}", end='')
            
            definition = self.get_word_definition(word)
            
            if definition:
                results.append({
                    'word': word,
                    'definition': definition
                })
                print(" ✓")
            else:
                print(" ✗")
            
            # Checkpoint
            if (idx + 1) % checkpoint_interval == 0:
                self.save_checkpoint(checkpoint_file, results, idx + 1)
                print(f"  → Checkpoint saved ({len(results)} words)")
            
            # Be nice to the server
            time.sleep(0.5)
        
        # Save final
        print(f"\n{'='*80}")
        print(f"Saving final results...")
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        
        print(f"✓ Saved {len(results)} words to {output_file}")
        
        # Clean up checkpoint
        if Path(checkpoint_file).exists():
            Path(checkpoint_file).unlink()
    
    def save_checkpoint(self, checkpoint_file, results, next_idx):
        """Save progress checkpoint."""
        with open(checkpoint_file, 'w', encoding='utf-8') as f:
            json.dump({
                'results': results,
                'next_idx': next_idx
            }, f, ensure_ascii=False)

def inspect_page_source():
    """Inspect the page to understand its structure."""
    print("="*80)
    print("INSPECTING PAGE SOURCE")
    print("="*80 + "\n")
    
    scraper = TafsirLisanScraper()
    url = f"{scraper.base_url}/lisan/%D8%A2"
    
    response = scraper.session.get(url)
    html = response.text
    
    # Save for manual inspection
    with open('/Users/jalalirs/code/m3ajem/tafsir_page_source.html', 'w', encoding='utf-8') as f:
        f.write(html)
    
    print(f"✓ Saved page source to tafsir_page_source.html")
    print(f"Page size: {len(html)} bytes")
    
    # Look for script tags
    script_tags = re.findall(r'<script[^>]*>(.*?)</script>', html, re.DOTALL)
    print(f"\nFound {len(script_tags)} script tags")
    
    # Look for suspicious variable names
    print("\nSearching for word-related variables...")
    keywords = ['word', 'entry', 'list', 'data', 'items', 'roots', 'dictionary']
    for keyword in keywords:
        pattern = rf'(?:var|let|const)\s+\w*{keyword}\w*\s*='
        matches = re.findall(pattern, html, re.IGNORECASE)
        if matches:
            print(f"  Found '{keyword}': {matches[:5]}")

if __name__ == "__main__":
    import sys
    
    output_dir = Path("/Users/jalalirs/code/m3ajem/assets/data/scraped")
    output_dir.mkdir(exist_ok=True, parents=True)
    
    if len(sys.argv) > 1 and sys.argv[1] == '--inspect':
        inspect_page_source()
    else:
        scraper = TafsirLisanScraper()
        output_file = output_dir / "lisan_tafsir_app.json"
        scraper.scrape_all_words(output_file)

