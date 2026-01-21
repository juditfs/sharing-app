# Test Data

This directory contains test images and data for Phase 4 testing.

## Required Test Images

### 1. test-image-with-exif.jpg
- **Purpose:** Test EXIF stripping
- **Requirements:**
  - Contains GPS data
  - Contains camera metadata
  - Contains timestamp
- **How to create:**
  - Take photo with iPhone camera
  - Or download from camera with metadata
  - Verify with: `exiftool test-image-with-exif.jpg`

### 2. test-image-large.jpg
- **Purpose:** Test image resizing
- **Requirements:**
  - Dimensions >4000px on longest side
  - High resolution
- **How to create:**
  - Use high-res camera photo
  - Or create with: `convert -size 5000x3000 xc:blue test-image-large.jpg`
  - Or download high-res stock photo

### 3. test-image-small.jpg
- **Purpose:** Test normal flow
- **Requirements:**
  - Dimensions <2048px
  - Normal file size
- **How to create:**
  - Any regular photo

## Test Results

Store test results in this directory:
- `original-exif.txt` - EXIF data from original image
- `decrypted-exif.txt` - EXIF data from decrypted image
- `test-notes.md` - Notes from testing

## Creating Test Images

### Using ImageMagick (if installed)
```bash
# Create large test image
convert -size 5000x3000 gradient:blue-red test-image-large.jpg

# Create normal test image
convert -size 1920x1080 gradient:green-yellow test-image-small.jpg
```

### Using macOS sips
```bash
# Resize existing image to large
sips -z 5000 3000 input.jpg --out test-image-large.jpg

# Resize to small
sips -z 1080 1920 input.jpg --out test-image-small.jpg
```

### Getting Images with EXIF
1. Take photo with iPhone Camera app (includes GPS, camera info)
2. Download from digital camera
3. Use sample images from: https://github.com/ianare/exif-samples

## Verifying EXIF Data

```bash
# Check if image has EXIF
exiftool test-image-with-exif.jpg

# Look for specific metadata
exiftool test-image-with-exif.jpg | grep -E "(GPS|Camera|Make|Model)"

# Save EXIF to file
exiftool test-image-with-exif.jpg > original-exif.txt
```

## Image Dimensions

```bash
# Check dimensions on macOS
sips -g pixelWidth -g pixelHeight image.jpg

# Using ImageMagick
identify -format "%wx%h" image.jpg
```
