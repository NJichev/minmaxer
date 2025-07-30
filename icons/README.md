# Icon Generation Instructions

The MinMaxer extension requires PNG icons in specific sizes. Use the `icon.svg` file to generate these:

## Required Icon Sizes

- `icon16.png` - 16x16 pixels (toolbar icon)
- `icon32.png` - 32x32 pixels (high-res toolbar)
- `icon48.png` - 48x48 pixels (extension management)
- `icon128.png` - 128x128 pixels (Chrome Web Store)

## Generation Methods

### Using Online Tools

1. Visit an SVG to PNG converter like:
   - https://convertio.co/svg-png/
   - https://cloudconvert.com/svg-to-png
   - https://online-converting.com/image/convert2png/

2. Upload `icon.svg`
3. Set the output dimensions for each required size
4. Download and rename files accordingly

### Using Command Line (if you have ImageMagick)

```bash
# Generate all required sizes
convert icon.svg -resize 16x16 icon16.png
convert icon.svg -resize 32x32 icon32.png
convert icon.svg -resize 48x48 icon48.png
convert icon.svg -resize 128x128 icon128.png
```

### Using Inkscape

```bash
# Generate all required sizes
inkscape --export-png=icon16.png --export-width=16 --export-height=16 icon.svg
inkscape --export-png=icon32.png --export-width=32 --export-height=32 icon.svg
inkscape --export-png=icon48.png --export-width=48 --export-height=48 icon.svg
inkscape --export-png=icon128.png --export-width=128 --export-height=128 icon.svg
```

## Quick Setup

For testing purposes, you can:

1. Generate just the 16x16 icon and copy it to all sizes:
   ```bash
   cp icon16.png icon32.png
   cp icon16.png icon48.png
   cp icon16.png icon128.png
   ```

2. Or create simple colored PNG files manually in any image editor

The extension will work with placeholder icons while you create proper ones. 