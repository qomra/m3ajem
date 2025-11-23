#!/usr/bin/env python3
"""
Extract text from PDF file and save to a text file.
"""

import sys
from pathlib import Path

try:
    import pypdf
except ImportError:
    print("pypdf not found. Installing...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pypdf"])
    import pypdf

def extract_pdf_text(pdf_path: str, output_path: str = None):
    """Extract text from PDF and save to file."""
    pdf_file = Path(pdf_path)
    
    if not pdf_file.exists():
        print(f"Error: PDF file not found at {pdf_path}")
        sys.exit(1)
    
    # Default output path if not provided
    if output_path is None:
        output_path = pdf_file.with_suffix('.txt')
    
    print(f"Reading PDF: {pdf_path}")
    
    # Extract text from PDF
    text_content = []
    with open(pdf_file, 'rb') as file:
        pdf_reader = pypdf.PdfReader(file)
        total_pages = len(pdf_reader.pages)
        print(f"Total pages: {total_pages}")
        
        for page_num, page in enumerate(pdf_reader.pages, 1):
            print(f"Processing page {page_num}/{total_pages}...", end='\r')
            text = page.extract_text()
            if text:
                text_content.append(f"--- Page {page_num} ---\n{text}\n")
    
    print(f"\nWriting text to: {output_path}")
    
    # Write to output file
    with open(output_path, 'w', encoding='utf-8') as output_file:
        output_file.write('\n'.join(text_content))
    
    print(f"Done! Extracted text from {total_pages} pages.")
    print(f"Output saved to: {output_path}")

if __name__ == "__main__":
    pdf_path = "/Users/jalalirs/code/m3ajem/assets/data/pdf/9472.pdf"
    output_path = "/Users/jalalirs/code/m3ajem/assets/data/pdf/9472.txt"
    
    extract_pdf_text(pdf_path, output_path)

