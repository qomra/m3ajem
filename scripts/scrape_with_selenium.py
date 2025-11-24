#!/usr/bin/env python3
"""
Scrape Lisan al-Arab using Selenium to handle JavaScript navigation
"""

import json
import time
import urllib.parse
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys
import requests

class SeleniumLisanScraper:
    def __init__(self):
        self.api_url = "https://tafsir.app/get_word.php"
        self.results = []
        self.scraped_words = set()
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        })
    
    def get_word_content(self, word):
        """Fetch word definition from API"""
        try:
            response = self.session.get(
                self.api_url,
                params={'src': 'lisan', 'w': word},
                timeout=10
            )
            response.raise_for_status()
            data = response.json()
            return data.get('data', '')
        except Exception as e:
            return None
        
    def setup_driver(self):
        """Setup Chrome driver with options"""
        from selenium.webdriver.chrome.options import Options
        
        options = Options()
        options.add_argument('--headless')  # Run in background
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--lang=ar')
        
        driver = webdriver.Chrome(options=options)
        return driver
    
    def extract_words_from_page(self, driver):
        """Try to extract all words if they're loaded in the page"""
        try:
            # Execute JavaScript to get words array if it exists
            script = """
            // Try to find word arrays in global scope
            let words = [];
            for (let key in window) {
                try {
                    let val = window[key];
                    if (Array.isArray(val) && val.length > 100) {
                        // Check if first item looks like Arabic
                        if (typeof val[0] === 'string' && /[\u0600-\u06FF]/.test(val[0])) {
                            words = val;
                            break;
                        }
                    }
                } catch(e) {}
            }
            return words;
            """
            words = driver.execute_script(script)
            
            if words and len(words) > 0:
                print(f"✓ Found {len(words)} words in page JavaScript")
                return words
                
        except Exception as e:
            print(f"Error extracting words: {e}")
        
        return None
    
    def navigate_and_scrape(self, start_url, max_words=None, save_progress=True, resume_from=None):
        """Navigate through words using next button"""
        driver = self.setup_driver()
        wordlist_file = "/Users/jalalirs/code/m3ajem/assets/data/scraped/lisan_wordlist_progress.json"
        checkpoint_file = "/Users/jalalirs/code/m3ajem/assets/data/scraped/selenium_checkpoint.json"
        
        # Load existing definitions if resuming
        if Path(checkpoint_file).exists():
            print(f"Loading definitions checkpoint...")
            with open(checkpoint_file, 'r', encoding='utf-8') as f:
                self.results = json.load(f)
            print(f"✓ Loaded {len(self.results)} definitions")
        
        try:
            # If resuming, start from the last word
            if resume_from:
                print(f"Resuming from: {resume_from}")
                start_url = f"https://tafsir.app/lisan/{urllib.parse.quote(resume_from)}"
            
            print(f"Opening: {start_url}")
            driver.get(start_url)
            time.sleep(3)  # Let page fully load
            
            # Focus on body to enable keyboard navigation
            try:
                driver.find_element(By.TAG_NAME, "body").click()
            except:
                pass
            
            # First, try to extract all words from the page
            all_words = self.extract_words_from_page(driver)
            
            if all_words:
                driver.quit()
                return all_words
            
            # If that didn't work, navigate sequentially
            print("\nNavigating sequentially and discovering words...")
            count = len(self.scraped_words) if resume_from else 0
            
            # Use keyboard navigation - more reliable than clicking
            from selenium.webdriver.common.action_chains import ActionChains
            
            prev_url = None
            
            # If resuming, skip the first word check and navigate immediately
            if resume_from:
                print("Navigating to next word...")
                try:
                    body = driver.find_element(By.TAG_NAME, "body")
                    body.send_keys(Keys.ARROW_LEFT)
                    time.sleep(1)
                except:
                    pass
            
            while max_words is None or count < max_words:
                # Get current URL to extract word
                try:
                    current_url = driver.current_url
                except:
                    print(f"\n✗ Lost connection to browser")
                    break
                    
                word = current_url.split('/lisan/')[-1]
                word = urllib.parse.unquote(word)
                
                # Check if URL changed (successful navigation)
                if prev_url and current_url == prev_url:
                    print(f"\n⚠ Navigation stuck - URL didn't change")
                    break
                
                if word in self.scraped_words and not resume_from:
                    print(f"\n⚠ Loop detected at '{word}'")
                    break
                
                # Clear resume flag after first iteration
                if resume_from:
                    resume_from = None
                
                count += 1
                print(f"[{count}] {word}... ", end='', flush=True)
                
                self.scraped_words.add(word)
                
                # Scrape definition immediately while discovering
                definition = self.get_word_content(word)
                if definition:
                    self.results.append({
                        'word': word,
                        'definition': definition
                    })
                    print("✓")
                    
                    # Save checkpoint after each definition
                    with open(checkpoint_file, 'w', encoding='utf-8') as f:
                        json.dump(self.results, f, ensure_ascii=False, indent=4)
                else:
                    print("✗")
                
                prev_url = current_url
                
                # Try multiple navigation methods
                navigated = False
                
                # Method 1: Try clicking next button
                try:
                    next_btn = driver.find_element(By.CSS_SELECTOR, "button.next-item, .next-item, [class*='next']")
                    if next_btn and next_btn.is_displayed():
                        next_btn.click()
                        navigated = True
                        time.sleep(1)
                except:
                    pass
                
                # Method 2: Keyboard navigation
                if not navigated:
                    try:
                        # Press left arrow (next in RTL)
                        body = driver.find_element(By.TAG_NAME, "body")
                        body.send_keys(Keys.ARROW_LEFT)
                        time.sleep(1)
                        navigated = True
                    except Exception as e:
                        print(f"  ✗ Navigation error: {e}")
                        break
                
                if not navigated:
                    print(f"  ✗ Could not navigate")
                    break
                
                if count % 100 == 0:
                    print(f"  [Progress: {count} words discovered, {len(self.results)} with definitions]")
                    # Save word list progress
                    if save_progress:
                        with open(wordlist_file, 'w', encoding='utf-8') as f:
                            json.dump(list(self.scraped_words), f, ensure_ascii=False, indent=4)
                    # Save definitions checkpoint
                    checkpoint_file = "/Users/jalalirs/code/m3ajem/assets/data/scraped/selenium_checkpoint.json"
                    with open(checkpoint_file, 'w', encoding='utf-8') as f:
                        json.dump(self.results, f, ensure_ascii=False, indent=4)
                    print(f"  → Checkpoints saved")
            
            # Return list of words we found
            words_found = list(self.scraped_words)
            
            # Save final word list
            if save_progress and len(words_found) > 1:
                with open(wordlist_file, 'w', encoding='utf-8') as f:
                    json.dump(words_found, f, ensure_ascii=False, indent=4)
                print(f"\n→ Saved progress: {len(words_found)} words to {wordlist_file}")
            
            return words_found
            
        finally:
            driver.quit()
    
    def load_checkpoint(self, checkpoint_file):
        """Load checkpoint if exists"""
        if Path(checkpoint_file).exists():
            print(f"Loading checkpoint from {checkpoint_file}...")
            with open(checkpoint_file, 'r', encoding='utf-8') as f:
                checkpoint = json.load(f)
                if isinstance(checkpoint, list):
                    self.results = checkpoint
                    # Rebuild scraped_words set
                    self.scraped_words = {item['word'] for item in self.results}
                    print(f"✓ Loaded {len(self.results)} words from checkpoint")
                    return True
        return False
    
    def scrape_with_api(self, words, checkpoint_file=None):
        """Scrape definitions using the API"""
        if checkpoint_file is None:
            checkpoint_file = "/Users/jalalirs/code/m3ajem/assets/data/scraped/selenium_checkpoint.json"
        
        # Load checkpoint
        self.load_checkpoint(checkpoint_file)
        
        # Filter out already scraped words
        words_to_scrape = [w for w in words if w not in self.scraped_words]
        
        if len(words_to_scrape) == 0:
            print("\n✓ All words already scraped!")
            return self.results
        
        print(f"\nScraping {len(words_to_scrape)} remaining words (out of {len(words)} total)...")
        print(f"Already have: {len(self.scraped_words)} words")
        
        session = requests.Session()
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        })
        
        for idx, word in enumerate(words_to_scrape, 1):
            total_done = len(self.results) + idx
            print(f"[{total_done}/{len(words)}] {word}... ", end='', flush=True)
            
            try:
                response = session.get(
                    self.api_url,
                    params={'src': 'lisan', 'w': word},
                    timeout=10
                )
                response.raise_for_status()
                data = response.json()
                definition = data.get('data', '')
                
                if definition:
                    self.results.append({
                        'word': word,
                        'definition': definition
                    })
                    self.scraped_words.add(word)  # Track scraped words
                    print("✓")
                else:
                    print("✗ (empty)")
                    
            except Exception as e:
                print(f"✗ ({e})")
            
            # Checkpoint after EVERY word (to be safe)
            with open(checkpoint_file, 'w', encoding='utf-8') as f:
                json.dump(self.results, f, ensure_ascii=False, indent=4)
            
            # Show progress every 10 words
            if idx % 10 == 0:
                print(f"  → Checkpoint: {len(self.results)} words saved")
            
            time.sleep(0.5)
        
        # Final checkpoint
        if len(self.results) > 0:
            with open(checkpoint_file, 'w', encoding='utf-8') as f:
                json.dump(self.results, f, ensure_ascii=False, indent=4)
            print(f"\n→ Final checkpoint: {len(self.results)} words saved")
        
        return self.results
    
    def scrape_from_file(self, word_file, output_file, checkpoint_file):
        """Scrape words from a text file (one word per line)"""
        print("="*80)
        print(f"SCRAPING WORDS FROM FILE: {word_file}")
        print("="*80)
        
        # Read words from file
        words = []
        with open(word_file, 'r', encoding='utf-8') as f:
            for line in f:
                word = line.strip()
                if word:
                    words.append(word)
        
        print(f"✓ Loaded {len(words)} words from file")
        
        # Scrape definitions
        self.scrape_with_api(words, checkpoint_file)
        
        # Save results
        self.save_final(output_file)
        
        return self.results
    
    def save_final(self, output_file):
        """Save final results"""
        print(f"\nSaving {len(self.results)} words...")
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, ensure_ascii=False, indent=2)
        print(f"  ✓ {output_file}")
        
        txt_file = str(output_file).replace('.json', '.txt')
        with open(txt_file, 'w', encoding='utf-8') as f:
            for item in self.results:
                f.write(f"\n{'='*80}\n{item['word']}\n{'-'*80}\n{item['definition']}\n")
        print(f"  ✓ {txt_file}")

if __name__ == "__main__":
    import sys
    import urllib.parse
    
    output_dir = Path("/Users/jalalirs/code/m3ajem/assets/data/scraped")
    output_dir.mkdir(exist_ok=True, parents=True)
    
    # Check for --missed mode
    if len(sys.argv) > 1 and sys.argv[1] == "--missed":
        print("="*80)
        print("SCRAPING MISSED WORDS FROM FILE")
        print("="*80)
        
        word_file = "/Users/jalalirs/code/m3ajem/assets/data/scraped/missed.text"
        output_file = output_dir / "missed_words.json"
        checkpoint_file = output_dir / "missed_checkpoint.json"
        
        scraper = SeleniumLisanScraper()
        scraper.scrape_from_file(word_file, output_file, checkpoint_file)
        
        print(f"\n{'='*80}")
        print(f"DONE! Scraped {len(scraper.results)} missed words")
        print(f"Checkpoint: {checkpoint_file}")
        print(f"Output: {output_file}")
        print(f"{'='*80}")
        sys.exit(0)
    
    print("="*80)
    print("SELENIUM SCRAPER FOR LISAN AL-ARAB")
    print("="*80)
    print("\nInstalling selenium if needed...")
    
    try:
        import selenium
        print("✓ Selenium installed")
    except ImportError:
        print("Installing selenium...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "selenium", "--user", "-q"])
        print("✓ Installed selenium")
    
    scraper = SeleniumLisanScraper()
    
    # Check for existing checkpoint with definitions
    checkpoint_file = output_dir / "selenium_checkpoint.json"
    if checkpoint_file.exists():
        print("Loading definitions checkpoint...")
        with open(checkpoint_file, 'r', encoding='utf-8') as f:
            scraper.results = json.load(f)
        scraper.scraped_words = {item['word'] for item in scraper.results}
        print(f"✓ Loaded {len(scraper.results)} words with definitions")
        
        # Resume from last scraped word
        if len(scraper.results) < 9000:
            last_word = scraper.results[-1]['word']
            print(f"  → Continuing from: {last_word}")
            start_url = f"https://tafsir.app/lisan/{urllib.parse.quote(last_word)}"
            words = scraper.navigate_and_scrape(start_url, max_words=None, resume_from=last_word)
        else:
            print("  → Scraping complete!")
            words = [item['word'] for item in scraper.results]
    else:
        # Start fresh
        print("Starting word discovery from first word...")
        start_url = "https://tafsir.app/lisan/%D8%A2"  # آ
        words = scraper.navigate_and_scrape(start_url, max_words=None, resume_from=None)
    
    if not words:
        print("\n✗ No words discovered")
        sys.exit(1)
    
    print(f"\n✓ Total discovered: {len(words)} words")
    
    # Save complete word list
    wordlist_file = output_dir / "lisan_wordlist.json"
    with open(wordlist_file, 'w', encoding='utf-8') as f:
        json.dump(words, f, ensure_ascii=False, indent=2)
    print(f"✓ Saved word list to {wordlist_file}")
    
    # Save final results
    print(f"\n{'='*80}")
    print("SAVING FINAL RESULTS")
    print(f"{'='*80}")
    
    output_file = output_dir / "lisan_selenium.json"
    scraper.save_final(output_file)
    
    # NEVER remove checkpoint - keep it for resume!
    # Only remove when user confirms scraping is complete
    
    print(f"\n{'='*80}")
    print(f"DONE! Total words with definitions: {len(scraper.results)}")
    print(f"Checkpoint saved at: {output_dir / 'selenium_checkpoint.json'}")
    print(f"Run again to continue if not complete (target: ~9280 words)")
    print(f"{'='*80}")

