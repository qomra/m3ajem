#!/usr/bin/env python3
"""
Fetch book from shamela.ws using your real Chrome browser
Book 83: لسان العرب
Pages 1 to 4577

Instructions:
1. Close all Chrome windows
2. Run: /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
3. In that Chrome window, go to shamela.ws and make sure you can browse normally
4. Then run this script
"""

import os
import json
import random
import asyncio
import argparse
from playwright.async_api import async_playwright

BOOK_ID = 83
START_PAGE = 1
END_PAGE = 4577
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "shamela_book_83.json")

async def human_like_delay():
    """Add random human-like delay."""
    await asyncio.sleep(random.uniform(2, 4))

async def fetch_page(page, page_num: int, retries: int = 3) -> dict | None:
    """Fetch a single page and extract content."""
    url = f"https://shamela.ws/book/{BOOK_ID}/{page_num}"

    for attempt in range(retries):
        try:
            response = await page.goto(url, wait_until='domcontentloaded', timeout=30000)
            await asyncio.sleep(random.uniform(1, 2))

            if response and response.status == 403:
                print(f"[{page_num}] 403 Forbidden - waiting...")
                await asyncio.sleep(15 + random.uniform(5, 10))
                continue

            # Wait for content
            try:
                await page.wait_for_selector('.nass, .betaka-index, article', timeout=10000)
            except:
                await asyncio.sleep(2)

            # Extract content
            content = await page.evaluate('''() => {
                const nass = document.querySelector('.nass');
                if (nass) return nass.innerText;
                const betaka = document.querySelector('.betaka-index');
                if (betaka) return betaka.innerText;
                const article = document.querySelector('article');
                if (article) return article.innerText;
                return null;
            }''')

            title = await page.evaluate('''() => {
                const h1 = document.querySelector('h1');
                if (h1) return h1.innerText;
                const title = document.querySelector('.title');
                if (title) return title.innerText;
                return '';
            }''')

            if content and len(content) > 50:
                return {
                    'page': page_num,
                    'title': title.strip() if title else '',
                    'content': content.strip(),
                    'url': url
                }
            else:
                # Check if blocked
                body = await page.evaluate('() => document.body.innerText')
                if 'تحقق' in body or '403' in body:
                    print(f"[{page_num}] Blocked - solve CAPTCHA in browser and press Enter...")
                    input()
                    continue
                print(f"[{page_num}] No content found")
                return None

        except Exception as e:
            print(f"[{page_num}] Attempt {attempt+1} failed: {e}")
            if attempt < retries - 1:
                await asyncio.sleep(5)
            else:
                return None

    return None

def save_data(pages_data: dict):
    """Save data to JSON file."""
    sorted_pages = sorted(pages_data.values(), key=lambda x: x['page'])
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(sorted_pages, f, ensure_ascii=False, indent=2)

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--start', type=int, default=START_PAGE)
    parser.add_argument('--end', type=int, default=END_PAGE)
    args = parser.parse_args()

    print(f"Fetching book {BOOK_ID} pages {args.start}-{args.end}")
    print(f"Output: {OUTPUT_FILE}")
    print("-" * 50)

    # Load existing
    pages_data = {}
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                existing = json.load(f)
                pages_data = {p['page']: p for p in existing}
                print(f"Resuming: {len(pages_data)} pages already fetched")
        except:
            pass

    pages_to_fetch = [p for p in range(args.start, args.end + 1) if p not in pages_data]

    if not pages_to_fetch:
        print("All pages already fetched!")
        return

    print(f"Pages to fetch: {len(pages_to_fetch)}")
    print("-" * 50)

    async with async_playwright() as p:
        try:
            # Connect to your real Chrome browser
            print("Connecting to Chrome on port 9222...")
            browser = await p.chromium.connect_over_cdp("http://localhost:9222")
            print("Connected!")
        except Exception as e:
            print(f"\nError: Could not connect to Chrome: {e}")
            print("\nPlease follow these steps:")
            print("1. Close ALL Chrome windows")
            print("2. Run this command in a new terminal:")
            print('   /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222')
            print("3. In that Chrome, go to https://shamela.ws and browse normally")
            print("4. Then run this script again")
            return

        # Get the first page from the browser
        contexts = browser.contexts
        if not contexts:
            print("No browser contexts found. Open shamela.ws in Chrome first.")
            return

        pages = contexts[0].pages
        if not pages:
            page = await contexts[0].new_page()
        else:
            page = pages[0]

        print(f"Using page: {page.url}")
        print("-" * 50)

        completed = 0
        failed = []

        for i, page_num in enumerate(pages_to_fetch):
            result = await fetch_page(page, page_num)

            if result:
                pages_data[page_num] = result
                completed += 1
                title = result['title'][:40] if result['title'] else 'no title'
                print(f"[{page_num}] OK - {title}")
            else:
                failed.append(page_num)

            if (i + 1) % 10 == 0:
                print(f"Progress: {completed}/{i+1} ({len(failed)} failed)")
                save_data(pages_data)

            await asyncio.sleep(random.uniform(2, 4))

    save_data(pages_data)
    print("-" * 50)
    print(f"Done: {completed}/{len(pages_to_fetch)} fetched, {len(failed)} failed")
    print(f"Total saved: {len(pages_data)}")

if __name__ == '__main__':
    asyncio.run(main())
