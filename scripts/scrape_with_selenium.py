#!/usr/bin/env python3
"""
Scrape Lisan al-Arab using Selenium to handle JavaScript navigation
"""

import json
import time
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
    
    def navigate_and_scrape(self, start_url, max_words=None):
        """Navigate through words using next button"""
        driver = self.setup_driver()
        
        try:
            print("Opening first word page...")
            driver.get(start_url)
            time.sleep(2)  # Let page load
            
            # First, try to extract all words from the page
            all_words = self.extract_words_from_page(driver)
            
            if all_words:
                driver.quit()
                return all_words
            
            # If that didn't work, navigate sequentially
            print("\nNavigating sequentially through words...")
            count = 0
            
            while max_words is None or count < max_words:
                # Get current URL to extract word
                current_url = driver.current_url
                word = current_url.split('/lisan/')[-1]
                word = urllib.parse.unquote(word)
                
                if word in self.scraped_words:
                    print(f"\n⚠ Loop detected at '{word}'")
                    break
                
                count += 1
                print(f"[{count}] {word}")
                
                self.scraped_words.add(word)
                
                # Try to find and click next button
                try:
                    # Wait for next button to be clickable
                    next_button = WebDriverWait(driver, 5).until(
                        EC.element_to_be_clickable((By.CLASS_NAME, "next-item"))
                    )
                    
                    next_button.click()
                    time.sleep(1)  # Wait for navigation
                    
                except Exception as e:
                    print(f"  ✗ Can't find/click next button: {e}")
                    # Try keyboard navigation
                    try:
                        from selenium.webdriver.common.action_chains import ActionChains
                        ActionChains(driver).send_keys(Keys.ARROW_LEFT).perform()  # Arabic is RTL
                        time.sleep(1)
                    except:
                        print("  ✗ Keyboard navigation failed too")
                        break
                
                if count % 10 == 0:
                    print(f"  [Progress: {count} words]")
            
            # Return list of words we found
            return list(self.scraped_words)
            
        finally:
            driver.quit()
    
    def scrape_with_api(self, words):
        """Scrape definitions using the API"""
        print(f"\nScraping {len(words)} words using API...")
        
        session = requests.Session()
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        })
        
        for idx, word in enumerate(words, 1):
            print(f"[{idx}/{len(words)}] {word}... ", end='', flush=True)
            
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
                    print("✓")
                else:
                    print("✗ (empty)")
                    
            except Exception as e:
                print(f"✗ ({e})")
            
            if idx % 50 == 0:
                self.save_checkpoint()
            
            time.sleep(0.5)
        
        return self.results
    
    def save_checkpoint(self):
        """Save progress"""
        checkpoint_file = "/Users/jalalirs/code/m3ajem/assets/data/scraped/selenium_checkpoint.json"
        with open(checkpoint_file, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, ensure_ascii=False)
        print(f"  [Saved {len(self.results)} words]")
    
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
    
    # Start from first word
    start_url = "https://tafsir.app/lisan/%D8%A2"  # آ
    
    # Step 1: Get word list by navigation
    words = scraper.navigate_and_scrape(start_url, max_words=None)  # No limit - scrape all words
    
    if words:
        print(f"\n✓ Discovered {len(words)} words")
        
        # Step 2: Scrape definitions
        scraper.scrape_with_api(words)
        
        # Step 3: Save
        output_file = output_dir / "lisan_selenium.json"
        scraper.save_final(output_file)
        
        print(f"\n{'='*80}")
        print(f"DONE! Scraped {len(scraper.results)} words")
    else:
        print("\n✗ Could not discover words")

