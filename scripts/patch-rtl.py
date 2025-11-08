#!/usr/bin/env python3
"""
Patch AppDelegate.swift to add RTL support.
This runs after expo prebuild to ensure RTL code persists.
"""

import re
import sys

def patch_appdelegate(filepath):
    """Add RTL support to AppDelegate.swift if not already present."""

    with open(filepath, 'r') as f:
        content = f.read()

    # Check if already patched
    if 'RCTI18nUtil.sharedInstance().allowRTL' in content:
        print("✅ AppDelegate already has RTL support")
        return False

    # Find the didFinishLaunchingWithOptions method
    pattern = r'(didFinishLaunchingWithOptions launchOptions:.*?\n\s*\) -> Bool \{)'

    rtl_code = r'''\1
    // Enable RTL support
    RCTI18nUtil.sharedInstance().allowRTL(true)
    // Force RTL at UIView level
    UIView.appearance().semanticContentAttribute = .forceRightToLeft
'''

    new_content = re.sub(pattern, rtl_code, content, count=1)

    if new_content == content:
        print("❌ Failed to patch AppDelegate - pattern not found")
        return False

    # Write back
    with open(filepath, 'w') as f:
        f.write(new_content)

    print("✅ RTL support added to AppDelegate.swift")
    return True

if __name__ == '__main__':
    filepath = sys.argv[1] if len(sys.argv) > 1 else 'ios/maajm/AppDelegate.swift'
    patch_appdelegate(filepath)
