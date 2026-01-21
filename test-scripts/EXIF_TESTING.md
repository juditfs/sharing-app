# EXIF Metadata Testing Guide

This guide details how to verify that the Sharene application correctly strips sensitive EXIF metadata (GPS coordinates, camera details, timestamps) from uploaded photos.

## 1. Prerequisites

### Install exiftool
`exiftool` is the industry standard for reading and writing image metadata.

**On macOS:**
```bash
brew install exiftool
```

**Verify installation:**
```bash
exiftool -ver
```

## 2. Preparing Test Data

You need an image that definitely contains sensitive metadata. Standard images downloaded from the web often have this stripped already.

### Option A: Use Your iPhone (Recommended)
1. **Enable Location Services** for Camera app (Settings > Privacy > Location Services > Camera).
2. **Take a photo** with your iPhone.
3. **AirDrop** the photo to your Mac (this preserves metadata).
   *Note: Emailing or messaging the photo may strip metadata depending on settings.*

### Option B: Download Sample Image
Download a sample image known to have EXIF data:

```bash
# Download sample canon image with GPS
curl -L -o test-data/test-image-with-exif.jpg https://github.com/ianare/exif-samples/raw/master/jpg/gps/DSCN0010.jpg
```

### Option C: Create Synthetic Metadata
If you have an existing clean image, you can inject metadata:

```bash
# Set GPS coordinates to Eiffel Tower
exiftool -GPSLatitude=48.8584 -GPSLatitudeRef=N \
         -GPSLongitude=2.2945 -GPSLongitudeRef=E \
         -Make="Apple" -Model="iPhone 15 Pro" \
         test-data/test-image-with-exif.jpg
```

## 3. Verify Original Image
Before testing, confirm your text image actually has data to strip.

```bash
cd test-data
exiftool test-image-with-exif.jpg | grep -E "(GPS|Camera|Make|Model|DateTime)"
```

**Expected Output:**
```
Make                            : NIKON
Model                           : E4300
DateTimeOriginal                : 2008:10:22 17:53:51
GPS Latitude                    : 43 deg 28' 2.81" N
GPS Longitude                   : 11 deg 53' 6.46" E
```

## 4. Perform the Test

1. **Launch the Sharene Mobile App**
   ```bash
   cd mobile
   npm run ios
   ```

2. **Upload the Photo**
   *   Tap "Select Photo"
   *   Choose `test-image-with-exif.jpg`
   *   Copy the generated link

3. **Open Link in Web Viewer**
   *   Open the link in your desktop browser.
   *   Wait for the image to decrypt and load.

4. **Download Result**
   *   Right-click the image and "Save Image As...".
   *   Save it to `test-data/test-image-decrypted.jpg`.

## 5. Verify Cleanup

Run `exiftool` on the downloaded image:

```bash
cd test-data
exiftool test-image-decrypted.jpg | grep -E "(GPS|Camera|Make|Model|DateTime)"
```

### Success Criteria ✅
*   **No GPS tags** should be present.
*   **No Camera Make/Model** should be present.
*   **No Original DateTime** should be present.
*   The only metadata remaining should be basic image properties (Resolution, File Type, MIME Type).

### Failure Scenario ❌
If you see output like `GPS Position : 43 deg 28' ...`, then the privacy stripping failed.

## 6. Automation

We have provided a script to automate the verification part once you have the files:

```bash
# Runs the comparison logic automatically
./test-scripts/test-image-processing.sh
```
