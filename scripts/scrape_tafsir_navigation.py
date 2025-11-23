#!/usr/bin/env python3
"""
Scrape tafsir.app to understand word navigation (next/prev word)
"""

import requests
from bs4 import BeautifulSoup
import urllib.parse
import json
import re

def scrape_word_page(word: str, source: str = "lisan"):
    """Scrape the word page and extract navigation info."""
    encoded_word = urllib.parse.quote(word)
    url = f"https://tafsir.app/{source}/{encoded_word}"
    
    print(f"Fetching: {url}")
    print(f"Word: {word}")
    print("-" * 80)
    
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Look for navigation elements
        print("\n1. Looking for navigation buttons/links:")
        print("-" * 80)
        
        # Find all links
        nav_links = []
        for link in soup.find_all('a'):
            href = link.get('href', '')
            text = link.get_text(strip=True)
            if 'lisan' in href or ('next' in text.lower() or 'prev' in text.lower() or 
                                    'سابق' in text or 'تالي' in text):
                nav_links.append({
                    'text': text,
                    'href': href,
                    'full_url': urllib.parse.urljoin(url, href) if not href.startswith('http') else href
                })
                print(f"  Link: {text} -> {href}")
        
        # Look for JavaScript that might contain word list
        print("\n2. Looking for JavaScript with word data:")
        print("-" * 80)
        
        scripts = soup.find_all('script')
        word_list_pattern = re.compile(r'(words|entries|list|index)\s*[=:]\s*[\[\{]', re.IGNORECASE)
        
        for i, script in enumerate(scripts):
            script_text = script.string
            if script_text and word_list_pattern.search(script_text):
                print(f"  Found potential word list in script {i}")
                # Show first 500 chars
                print(f"  Preview: {script_text[:500]}...")
        
        # Look for data attributes
        print("\n3. Looking for data attributes with navigation info:")
        print("-" * 80)
        
        for elem in soup.find_all(attrs={'data-next': True}):
            print(f"  data-next: {elem.get('data-next')}")
        
        for elem in soup.find_all(attrs={'data-prev': True}):
            print(f"  data-prev: {elem.get('data-prev')}")
        
        # Look for the main content area that might have navigation
        print("\n4. Looking for navigation in main content area:")
        print("-" * 80)
        
        # Common navigation button selectors
        nav_selectors = [
            '.next', '.prev', '.previous', '.navigation',
            'button[aria-label*="next"]', 'button[aria-label*="prev"]',
            '[class*="nav"]', '[id*="nav"]'
        ]
        
        for selector in nav_selectors:
            elements = soup.select(selector)
            if elements:
                print(f"  Found {len(elements)} elements for selector: {selector}")
                for elem in elements[:3]:  # Show first 3
                    print(f"    - {elem.name}: {elem.get('class')} - {elem.get_text(strip=True)[:50]}")
        
        # Try to get the API call data
        print("\n5. Checking if page makes API calls:")
        print("-" * 80)
        
        # Look for fetch/ajax calls in scripts
        for script in scripts:
            script_text = script.string
            if script_text:
                api_calls = re.findall(r'fetch\([\'"]([^\'"]+)[\'"]', script_text)
                if api_calls:
                    print(f"  Found fetch calls:")
                    for call in api_calls:
                        print(f"    - {call}")
                
                # Look for get_word.php calls
                if 'get_word.php' in script_text:
                    print(f"  Found get_word.php usage in script")
                    # Extract relevant section
                    idx = script_text.find('get_word.php')
                    print(f"    Context: {script_text[max(0, idx-100):idx+200]}")
        
        return {
            'url': url,
            'nav_links': nav_links,
            'page_title': soup.title.string if soup.title else None
        }
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return None

def find_word_list(source: str = "lisan"):
    """Try to find a word list or index page."""
    print("\n" + "=" * 80)
    print("LOOKING FOR WORD LIST/INDEX")
    print("=" * 80 + "\n")
    
    # Try common index URLs
    index_urls = [
        f"https://tafsir.app/{source}",
        f"https://tafsir.app/{source}/index",
        f"https://tafsir.app/{source}/list",
        f"https://tafsir.app/api/{source}/words",
    ]
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
    
    for url in index_urls:
        print(f"Trying: {url}")
        try:
            response = requests.get(url, headers=headers)
            if response.status_code == 200:
                print(f"  ✓ Success! Status: {response.status_code}")
                print(f"  Content-Type: {response.headers.get('Content-Type')}")
                print(f"  Content length: {len(response.text)} chars")
                
                # Check if it's JSON
                if 'application/json' in response.headers.get('Content-Type', ''):
                    data = response.json()
                    print(f"  JSON data keys: {list(data.keys()) if isinstance(data, dict) else 'array'}")
                else:
                    print(f"  First 500 chars: {response.text[:500]}")
            else:
                print(f"  ✗ Status: {response.status_code}")
        except Exception as e:
            print(f"  ✗ Error: {e}")
        print()

if __name__ == "__main__":
    # Test with the word from user's example
    word = "أبز"  # The word from the URL
    
    print("=" * 80)
    print("SCRAPING TAFSIR.APP WEB INTERFACE")
    print("=" * 80 + "\n")
    
    data = scrape_word_page(word)
    
    if data:
        print("\n" + "=" * 80)
        print("RESULTS:")
        print("=" * 80)
        print(json.dumps(data, ensure_ascii=False, indent=2))
    
    # Try to find word list
    find_word_list()

