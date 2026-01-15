#!/bin/bash
# Fetch book from api.turath.io

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Create venv if needed
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install requests
else
    source venv/bin/activate
    # Make sure requests is installed
    pip install requests -q
fi

python3 fetch_turath.py "$@"
