#!/usr/bin/env python3
"""
Scrape all words from tafsir.app Lisan al-Arab dictionary
Starting from the first word and following the "next" navigation
"""

import requests
from bs4 import BeautifulSoup
import urllib.parse
import json
import time
import os
from pathlib import Path

class TafsirScraper:
    def __init__(self, source="lisan", delay=1.0):
        self.source = source
        self.delay = delay  # Delay between requests (be respectful)
        self.base_url = "https://tafsir.app"
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
        self.words_data = []
        
    def get_word_page(self, word):
        """Fetch a word page and extract content + navigation."""
        encoded_word = urllib.parse.quote(word)
        url = f"{self.base_url}/{self.source}/{encoded_word}"
        
        print(f"Fetching: {word}")
        
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Extract the word definition/content
            # The content is likely in a main article or content div
            content = None
            
            # Try to find the main content - adjust selectors based on actual HTML
            # Common selectors for Arabic dictionary content
            for selector in ['article', '.content', '.entry', '.definition', 'main']:
                content_elem = soup.select_one(selector)
                if content_elem:
                    content = content_elem.get_text(strip=True)
                    break
            
            if not content:
                # Fallback: get all text from body
                body = soup.find('body')
                if body:
                    content = body.get_text(strip=True)
            
            # Find the "next" link
            # Look for navigation arrows: → ← 
            # "المصدر ↓ التالي" means "Next Source"
            next_word = None
            next_url = None
            
            # Try different methods to find the next link
            # Method 1: Look for links with navigation text
            for link in soup.find_all('a'):
                text = link.get_text(strip=True)
                href = link.get('href', '')
                
                # Check for "next" indicators in Arabic
                if any(marker in text for marker in ['التالي', 'التالى', '↓', '←']) or \
                   'onclick' in str(link) and 'next' in str(link):
                    if f"/{self.source}/" in href:
                        next_url = href
                        # Extract word from URL
                        next_word = href.split(f"/{self.source}/")[-1]
                        next_word = urllib.parse.unquote(next_word)
                        break
            
            # Method 2: Look for data attributes
            if not next_word:
                for elem in soup.find_all(attrs=lambda x: x and any('next' in str(k).lower() for k in x)):
                    for attr, value in elem.attrs.items():
                        if 'next' in attr.lower() and value:
                            next_word = value
                            break
            
            # Method 3: Look in JavaScript for navigation
            if not next_word:
                scripts = soup.find_all('script')
                for script in scripts:
                    if script.string and 'next' in script.string.lower():
                        # Try to extract word from script
                        # This is a fallback and may need adjustment
                        pass
            
            return {
                'word': word,
                'url': url,
                'content': content,
                'next_word': next_word,
                'html': response.text  # Store full HTML for debugging
            }
            
        except Exception as e:
            print(f"Error fetching {word}: {e}")
            return None
    
    def scrape_all_words(self, start_word="آ", output_file="lisan_scraped.json", checkpoint_interval=50):
        """Scrape all words starting from start_word."""
        current_word = start_word
        word_count = 0
        checkpoint_file = output_file.replace('.json', '_checkpoint.json')
        
        # Load checkpoint if exists
        if os.path.exists(checkpoint_file):
            print(f"Loading checkpoint from {checkpoint_file}")
            with open(checkpoint_file, 'r', encoding='utf-8') as f:
                checkpoint_data = json.load(f)
                self.words_data = checkpoint_data['words']
                current_word = checkpoint_data['next_word']
                word_count = len(self.words_data)
                print(f"Resuming from word #{word_count + 1}: {current_word}")
        
        print(f"Starting scrape from: {current_word}")
        print(f"Output file: {output_file}")
        print(f"Checkpoint every {checkpoint_interval} words")
        print("-" * 80)
        
        visited = set()  # Prevent infinite loops
        
        while current_word:
            # Check for loops
            if current_word in visited:
                print(f"Loop detected at word: {current_word}")
                break
            
            visited.add(current_word)
            
            # Fetch word data
            word_data = self.get_word_page(current_word)
            
            if word_data:
                self.words_data.append({
                    'word': word_data['word'],
                    'content': word_data['content'],
                    'url': word_data['url']
                })
                
                word_count += 1
                print(f"  [{word_count}] {word_data['word'][:50]}... -> Next: {word_data['next_word']}")
                
                # Save checkpoint periodically
                if word_count % checkpoint_interval == 0:
                    self.save_checkpoint(checkpoint_file, word_data['next_word'])
                    print(f"  ✓ Checkpoint saved ({word_count} words)")
                
                # Move to next word
                if word_data['next_word']:
                    current_word = word_data['next_word']
                else:
                    print(f"No next word found. Reached the end!")
                    break
            else:
                print(f"Failed to fetch word: {current_word}")
                break
            
            # Be respectful - delay between requests
            time.sleep(self.delay)
        
        # Save final data
        print(f"\n{'='*80}")
        print(f"Scraping complete! Total words: {word_count}")
        self.save_final(output_file)
        
        # Clean up checkpoint
        if os.path.exists(checkpoint_file):
            os.remove(checkpoint_file)
            print(f"Checkpoint file removed")
        
        return self.words_data
    
    def save_checkpoint(self, checkpoint_file, next_word):
        """Save checkpoint to resume scraping."""
        checkpoint_data = {
            'words': self.words_data,
            'next_word': next_word,
            'timestamp': time.time()
        }
        with open(checkpoint_file, 'w', encoding='utf-8') as f:
            json.dump(checkpoint_data, f, ensure_ascii=False, indent=2)
    
    def save_final(self, output_file):
        """Save final scraped data."""
        print(f"Saving to {output_file}...")
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(self.words_data, f, ensure_ascii=False, indent=2)
        
        # Also save as plain text
        text_file = output_file.replace('.json', '.txt')
        with open(text_file, 'w', encoding='utf-8') as f:
            for item in self.words_data:
                f.write(f"\n{'='*80}\n")
                f.write(f"Word: {item['word']}\n")
                f.write(f"URL: {item['url']}\n")
                f.write(f"{'-'*80}\n")
                f.write(f"{item['content']}\n")
        
        print(f"  ✓ Saved JSON: {output_file}")
        print(f"  ✓ Saved TXT: {text_file}")

def inspect_first_word():
    """Inspect the first word to understand the HTML structure."""
    print("=" * 80)
    print("INSPECTING FIRST WORD TO FIND NAVIGATION STRUCTURE")
    print("=" * 80 + "\n")
    
    scraper = TafsirScraper()
    word_data = scraper.get_word_page("آ")
    
    if word_data:
        # Save HTML for inspection
        html_file = "first_word_debug.html"
        with open(html_file, 'w', encoding='utf-8') as f:
            f.write(word_data['html'])
        
        print(f"HTML saved to: {html_file}")
        print(f"Word: {word_data['word']}")
        print(f"Next word: {word_data['next_word']}")
        print(f"Content length: {len(word_data['content'])} chars")
        print(f"\nFirst 500 chars of content:")
        print(word_data['content'][:500])
        
        return word_data
    return None

if __name__ == "__main__":
    import sys
    
    output_dir = Path("/Users/jalalirs/code/m3ajem/assets/data/scraped")
    output_dir.mkdir(exist_ok=True)
    
    output_file = output_dir / "lisan_dictionary.json"
    
    if len(sys.argv) > 1 and sys.argv[1] == "--inspect":
        # Just inspect the first word to understand the structure
        inspect_first_word()
    else:
        # Full scrape
        print("=" * 80)
        print("SCRAPING LISAN AL-ARAB DICTIONARY FROM TAFSIR.APP")
        print("=" * 80 + "\n")
        
        scraper = TafsirScraper(delay=1.0)  # 1 second delay between requests
        
        try:
            words = scraper.scrape_all_words(
                start_word="آ",
                output_file=str(output_file),
                checkpoint_interval=50
            )
            print(f"\n✓ Success! Scraped {len(words)} words")
        except KeyboardInterrupt:
            print("\n\nScraping interrupted by user")
            print(f"Progress saved in checkpoint file")
            scraper.save_final(str(output_file))

