#!/bin/bash
# Fetch shamela.ws book using Playwright

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Create venv if it doesn't exist or if playwright is not installed
if [ ! -d "venv" ] || [ ! -f "venv/bin/playwright" ]; then
    echo "Creating virtual environment..."
    rm -rf venv
    python3 -m venv venv
    source venv/bin/activate
    echo "Installing dependencies..."
    pip install --upgrade pip
    pip install playwright
    echo "Installing Chromium browser..."
    playwright install chromium
else
    source venv/bin/activate
fi

python3 fetch_shamela.py "$@"
