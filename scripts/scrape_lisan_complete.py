#!/usr/bin/env python3
"""
Scrape ALL words from tafsir.app/lisan by starting from the first word
and following navigation links to discover and scrape every word
"""

import requests
from bs4 import BeautifulSoup
import json
import time
import re
import urllib.parse
from pathlib import Path

class LisanScraper:
    def __init__(self):
        self.base_url = "https://tafsir.app"
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ar,en;q=0.9',
        })
        self.scraped_words = set()
        self.results = []
        
    def get_word_content(self, word):
        """Get word definition using the API"""
        url = f"{self.base_url}/get_word.php"
        params = {'src': 'lisan', 'w': word}
        
        try:
            response = self.session.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            return data.get('data', '')
        except Exception as e:
            print(f"  API Error: {e}")
            return None
    
    def find_next_word_in_page(self, html, current_word):
        """
        Try to find the next word from the HTML page
        This requires understanding the page structure
        """
        soup = BeautifulSoup(html, 'html.parser')
        
        # Method 1: Look for data attributes
        next_elem = soup.find(attrs={'data-next-word': True})
        if next_elem:
            return next_elem['data-next-word']
        
        # Method 2: Look for navigation buttons with onclick handlers
        buttons = soup.find_all('button', class_=re.compile(r'next'))
        for button in buttons:
            onclick = button.get('onclick', '')
            if onclick:
                # Try to extract word from onclick
                match = re.search(r'[\'"]([^\'"]+)[\'"]', onclick)
                if match:
                    potential_word = match.group(1)
                    if any(ord(c) > 1500 for c in potential_word[:5]):  # Arabic chars
                        return potential_word
        
        # Method 3: Look in JavaScript for next word
        scripts = soup.find_all('script')
        for script in scripts:
            if script.string:
                # Look for patterns like: nextWord = "...", next: "...", etc
                patterns = [
                    r'nextWord\s*[=:]\s*[\'"]([^\'"]+)[\'"]',
                    r'next\s*[=:]\s*[\'"]([^\'"]+)[\'"]',
                    r'word\s*\+\+',  # Might increment through array
                ]
                for pattern in patterns:
                    match = re.search(pattern, script.string)
                    if match and len(match.groups()) > 0:
                        word = match.group(1)
                        if any(ord(c) > 1500 for c in word[:5]):
                            return word
        
        # Method 4: Check if there's an embedded word list
        # and find the current word's position, then get next
        for script in scripts:
            if script.string and 'lisan' in script.string.lower():
                # Try to find array of words
                array_match = re.search(r'\[([^\]]{100,})\]', script.string)
                if array_match:
                    array_content = array_match.group(1)
                    # Split by common delimiters
                    potential_words = re.findall(r'[\'"]([^\'"]+)[\'"]', array_content)
                    # Filter for Arabic words
                    arabic_words = [w for w in potential_words if any(ord(c) > 1500 for c in w[:5])]
                    
                    if len(arabic_words) > 10:  # Looks like a word list
                        try:
                            idx = arabic_words.index(current_word)
                            if idx + 1 < len(arabic_words):
                                return arabic_words[idx + 1]
                        except ValueError:
                            pass
        
        return None
    
    def get_all_words_from_index(self):
        """
        Try to get complete word list by analyzing the dictionary index/structure
        """
        print("\nAttempting to extract full word list from website...")
        
        # Try accessing the main dictionary page
        url = f"{self.base_url}/lisan"
        try:
            response = self.session.get(url, timeout=10)
            html = response.text
            
            soup = BeautifulSoup(html, 'html.parser')
            
            # Look for a word list in various places
            # 1. Links to dictionary entries
            links = soup.find_all('a', href=re.compile(r'/lisan/'))
            words = []
            for link in links:
                href = link['href']
                word = href.split('/lisan/')[-1]
                word = urllib.parse.unquote(word)
                if word and any(ord(c) > 1500 for c in word[:3]):
                    words.append(word)
            
            if len(words) > 100:
                print(f"  ✓ Found {len(words)} words from links")
                return list(dict.fromkeys(words))  # Remove duplicates, preserve order
            
            # 2. Check for JSON data
            json_scripts = soup.find_all('script', type='application/json')
            for script in json_scripts:
                try:
                    data = json.loads(script.string)
                    # Navigate through the JSON to find word lists
                    def extract_words(obj):
                        words = []
                        if isinstance(obj, dict):
                            for v in obj.values():
                                words.extend(extract_words(v))
                        elif isinstance(obj, list):
                            for item in obj:
                                if isinstance(item, str) and any(ord(c) > 1500 for c in item[:3]):
                                    words.append(item)
                                else:
                                    words.extend(extract_words(item))
                        return words
                    
                    words = extract_words(data)
                    if len(words) > 100:
                        print(f"  ✓ Found {len(words)} words from JSON")
                        return list(dict.fromkeys(words))
                except:
                    pass
                    
        except Exception as e:
            print(f"  ✗ Error: {e}")
        
        return None
    
    def scrape_sequential(self, start_word="آ", max_words=None):
        """
        Scrape by following next word navigation
        """
        current_word = start_word
        count = 0
        
        while current_word and (max_words is None or count < max_words):
            if current_word in self.scraped_words:
                print(f"\n⚠ Loop detected at '{current_word}' - stopping")
                break
            
            count += 1
            print(f"[{count}] {current_word}... ", end='', flush=True)
            
            # Get definition from API
            definition = self.get_word_content(current_word)
            
            if definition:
                self.results.append({
                    'word': current_word,
                    'definition': definition
                })
                self.scraped_words.add(current_word)
                print("✓")
            else:
                print("✗ (no content)")
                break
            
            # Get the page HTML to find next word
            page_url = f"{self.base_url}/lisan/{urllib.parse.quote(current_word)}"
            try:
                response = self.session.get(page_url, timeout=10)
                html = response.text
                
                next_word = self.find_next_word_in_page(html, current_word)
                
                if next_word:
                    print(f"  → Next: {next_word}")
                    current_word = next_word
                else:
                    print(f"  ✗ No next word found - checking page structure...")
                    # Save page for debugging
                    with open('/Users/jalalirs/code/m3ajem/debug_no_next.html', 'w', encoding='utf-8') as f:
                        f.write(html)
                    print(f"  → Saved page to debug_no_next.html for inspection")
                    break
                    
            except Exception as e:
                print(f"  ✗ Page error: {e}")
                break
            
            # Checkpoint every 50 words
            if count % 50 == 0:
                self.save_checkpoint(count)
            
            # Be respectful
            time.sleep(0.5)
        
        return self.results
    
    def scrape_from_wordlist(self, words):
        """Scrape using a known word list"""
        print(f"\nScraping {len(words)} words...")
        
        for idx, word in enumerate(words, 1):
            if word in self.scraped_words:
                continue
                
            print(f"[{idx}/{len(words)}] {word}... ", end='', flush=True)
            
            definition = self.get_word_content(word)
            
            if definition:
                self.results.append({
                    'word': word,
                    'definition': definition
                })
                self.scraped_words.add(word)
                print("✓")
            else:
                print("✗")
            
            if idx % 50 == 0:
                self.save_checkpoint(idx)
            
            time.sleep(0.5)
        
        return self.results
    
    def save_checkpoint(self, count):
        """Save progress"""
        checkpoint_file = "/Users/jalalirs/code/m3ajem/assets/data/scraped/lisan_checkpoint.json"
        with open(checkpoint_file, 'w', encoding='utf-8') as f:
            json.dump({
                'count': count,
                'results': self.results,
                'scraped_words': list(self.scraped_words)
            }, f, ensure_ascii=False)
        print(f"  [Checkpoint: {len(self.results)} words]")
    
    def save_final(self, output_file):
        """Save final results"""
        print(f"\nSaving {len(self.results)} words...")
        
        # JSON
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, ensure_ascii=False, indent=2)
        print(f"  ✓ {output_file}")
        
        # TXT
        txt_file = str(output_file).replace('.json', '.txt')
        with open(txt_file, 'w', encoding='utf-8') as f:
            for item in self.results:
                f.write(f"\n{'='*80}\n")
                f.write(f"{item['word']}\n")
                f.write(f"{'-'*80}\n")
                f.write(f"{item['definition']}\n")
        print(f"  ✓ {txt_file}")

if __name__ == "__main__":
    import sys
    
    output_dir = Path("/Users/jalalirs/code/m3ajem/assets/data/scraped")
    output_dir.mkdir(exist_ok=True, parents=True)
    
    scraper = LisanScraper()
    
    print("="*80)
    print("LISAN AL-ARAB SCRAPER - TAFSIR.APP")
    print("="*80)
    
    # Strategy 1: Try to get full word list first
    word_list = scraper.get_all_words_from_index()
    
    if word_list:
        print(f"\n✓ Got word list with {len(word_list)} words")
        print(f"First 10: {word_list[:10]}")
        print(f"Last 10: {word_list[-10:]}")
        
        scraper.scrape_from_wordlist(word_list)
    else:
        # Strategy 2: Sequential scraping by following next links
        print("\nNo word list found. Using sequential navigation...")
        print("Starting from first word: آ")
        
        scraper.scrape_sequential(start_word="آ", max_words=None)  # Scrape all words
    
    # Save results
    output_file = output_dir / "lisan_scraped.json"
    scraper.save_final(output_file)
    
    print(f"\n{'='*80}")
    print(f"DONE! Scraped {len(scraper.results)} words")
    print(f"{'='*80}")

