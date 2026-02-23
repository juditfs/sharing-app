#!/bin/bash
echo "Using node: $(which node)"

cd mobile

# Find a booted simulator
SIM_ID=$(xcrun simctl list devices booted -j | grep '"state" : "Booted"' -B 2 | grep '"udid" : ' | head -1 | awk -F'"' '{print $4}')

if [ -z "$SIM_ID" ]; then
  echo "No booted simulator found. Please boot a simulator using Simulator.app or 'xcrun simctl boot <device>' first."
  exit 1
fi

echo "Using Booted Simulator UUID: $SIM_ID"

# Build the app using xcodebuild targeting the specific simulator
echo "Building..."
xcodebuild \
  -workspace ios/Sharene.xcworkspace \
  -scheme Sharene \
  -configuration Debug \
  -destination "platform=iOS Simulator,id=$SIM_ID" \
  -derivedDataPath build \
  build 2>&1 | tail -20

echo "Installing and launching on simulator..."
APP_PATH=$(find build -name "*.app" -maxdepth 6 | head -1)
echo "App: $APP_PATH"
xcrun simctl install "$SIM_ID" "$APP_PATH"
xcrun simctl launch "$SIM_ID" com.sharene.app

# Start Metro bundler
echo "Starting Metro..."
npx expo start --port 8081
