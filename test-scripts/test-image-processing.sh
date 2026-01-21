#!/bin/bash

echo "Testing image processing..."

# Create test directory
mkdir -p test-data
cd test-data

# Test 1: EXIF Stripping
echo "1. Testing EXIF stripping..."

if ! command -v exiftool &> /dev/null; then
  echo "   ⚠️  Skipping EXIF test (exiftool not installed)"
  echo "   Install with: brew install exiftool"
else
  # Check if we have a test image with EXIF
  if [ -f "test-image-with-exif.jpg" ]; then
    echo "   Checking original EXIF data..."
    exiftool test-image-with-exif.jpg | grep -E "(GPS|Camera|Make|Model|DateTimeOriginal)" > original-exif.txt
    
    if [ -s original-exif.txt ]; then
      echo "   ✓ Original image has EXIF metadata:"
      cat original-exif.txt
    else
      echo "   ⚠️  No EXIF metadata found in test image"
    fi
    
    echo ""
    echo "   📋 Manual step required:"
    echo "      1. Upload test-image-with-exif.jpg via mobile app"
    echo "      2. Download decrypted image from web viewer"
    echo "      3. Save as test-image-decrypted.jpg in test-data/"
    echo "      4. Run: exiftool test-image-decrypted.jpg > decrypted-exif.txt"
    echo "      5. Compare original-exif.txt and decrypted-exif.txt"
    
    # Check if decrypted image exists
    if [ -f "test-image-decrypted.jpg" ]; then
      echo ""
      echo "   Checking decrypted image EXIF data..."
      exiftool test-image-decrypted.jpg | grep -E "(GPS|Camera|Make|Model|DateTimeOriginal)" > decrypted-exif.txt
      
      if [ -s decrypted-exif.txt ]; then
        echo "   ❌ WARNING: Decrypted image still has EXIF metadata!"
        cat decrypted-exif.txt
      else
        echo "   ✓ EXIF metadata successfully stripped from decrypted image"
      fi
    fi
  else
    echo "   ⚠️  No test image found"
    echo "   Create test-data/test-image-with-exif.jpg with EXIF metadata"
    echo "   (Take a photo with iPhone or download from camera)"
  fi
fi

# Test 2: Image Resizing
echo ""
echo "2. Testing image resizing..."
echo "   📋 Manual step required:"
echo "      1. Prepare image >4000px (or use test-image-large.jpg)"
echo "      2. Note original dimensions"
echo "      3. Upload via mobile app"
echo "      4. Download decrypted image"
echo "      5. Check dimensions (should be ≤2048px on longest side)"
echo "      6. Verify aspect ratio maintained"

if command -v sips &> /dev/null; then
  if [ -f "test-image-large.jpg" ]; then
    echo ""
    echo "   Original image dimensions:"
    sips -g pixelWidth -g pixelHeight test-image-large.jpg
  fi
  
  if [ -f "test-image-decrypted-large.jpg" ]; then
    echo ""
    echo "   Decrypted image dimensions:"
    sips -g pixelWidth -g pixelHeight test-image-decrypted-large.jpg
    
    WIDTH=$(sips -g pixelWidth test-image-decrypted-large.jpg | grep pixelWidth | awk '{print $2}')
    HEIGHT=$(sips -g pixelHeight test-image-decrypted-large.jpg | grep pixelHeight | awk '{print $2}')
    
    MAX_DIM=$((WIDTH > HEIGHT ? WIDTH : HEIGHT))
    
    if [ "$MAX_DIM" -le 2048 ]; then
      echo "   ✓ Image resized correctly (max dimension: ${MAX_DIM}px ≤ 2048px)"
    else
      echo "   ❌ WARNING: Image not resized (max dimension: ${MAX_DIM}px > 2048px)"
    fi
  fi
else
  echo "   Note: sips command available for dimension checking on macOS"
fi

# Test 3: Thumbnail Generation
echo ""
echo "3. Testing thumbnail generation..."
echo "   📋 Manual step required:"
echo "      1. Upload image via mobile app"
echo "      2. Check Supabase Storage dashboard"
echo "      3. Verify thumbnail file exists"
echo "      4. Compare file sizes (thumbnail should be smaller)"
echo "      5. Test load time in web viewer"

cd ..

echo ""
echo "✅ Image processing tests complete"
echo ""
echo "📋 Summary of manual steps:"
echo "   1. Create test images with EXIF and large dimensions"
echo "   2. Upload via mobile app"
echo "   3. Download decrypted images"
echo "   4. Run this script again to verify results"
