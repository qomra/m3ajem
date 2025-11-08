#!/usr/bin/env python3
"""
Generate a simple splash screen using the app icon.
Creates a clean splash with the icon centered on a white background.
"""

from PIL import Image
import os

# Paths
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
icon_path = os.path.join(project_root, 'assets', 'icon.png')
splash_path = os.path.join(project_root, 'assets', 'splash.png')

# Splash screen dimensions (for iPhone 14 Pro Max)
SPLASH_WIDTH = 1284
SPLASH_HEIGHT = 2778

# Background color (white)
BG_COLOR = (255, 255, 255)

# Icon size on splash (60% of width for good visibility)
ICON_SIZE = int(SPLASH_WIDTH * 0.6)

print("📱 Generating splash screen...")

# Load the icon
try:
    icon = Image.open(icon_path)
    print(f"✅ Loaded icon: {icon.size[0]}x{icon.size[1]} pixels")
except Exception as e:
    print(f"❌ Error loading icon: {e}")
    exit(1)

# Create splash canvas
splash = Image.new('RGB', (SPLASH_WIDTH, SPLASH_HEIGHT), BG_COLOR)
print(f"✅ Created canvas: {SPLASH_WIDTH}x{SPLASH_HEIGHT} pixels")

# Resize icon (maintaining aspect ratio)
icon_resized = icon.resize((ICON_SIZE, ICON_SIZE), Image.Resampling.LANCZOS)
print(f"✅ Resized icon to: {ICON_SIZE}x{ICON_SIZE} pixels")

# Calculate position to center the icon
x = (SPLASH_WIDTH - ICON_SIZE) // 2
y = (SPLASH_HEIGHT - ICON_SIZE) // 2

# Paste icon onto splash (with alpha channel for transparency)
if icon_resized.mode == 'RGBA':
    splash.paste(icon_resized, (x, y), icon_resized)
else:
    splash.paste(icon_resized, (x, y))

print(f"✅ Positioned icon at center ({x}, {y})")

# Save splash screen
splash.save(splash_path, 'PNG', optimize=True)
print(f"✅ Saved splash screen to: {splash_path}")

# Show file size
file_size = os.path.getsize(splash_path) / 1024  # KB
print(f"📦 File size: {file_size:.1f} KB")

print("\n✨ Splash screen generated successfully!")
print("\n📋 Next steps:")
print("   1. Run: npm run build:ios")
print("   2. The new splash will be included in the iOS build")
print("   3. Test on your device to see the new splash")
