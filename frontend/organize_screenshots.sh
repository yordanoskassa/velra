#!/bin/bash

# Create the directory structure
mkdir -p fastlane/screenshots/en-US

# Define the screenshot names
SCREENS=(
  "01_Welcome_Screen"
  "02_Login_Screen"
  "03_Registration_Screen"
  "04_News_Feed"
  "05_Article_Details"
  "06_Profile_Screen"
)

# Define the device names
DEVICES=(
  "iPhone 8 Plus"
  "iPhone 13 Pro Max"
  "iPad Pro (12.9-inch) (5th generation)"
)

# Print instructions
echo "=== Screenshot Organization Helper ==="
echo ""
echo "This script will help you organize your screenshots for App Store submission."
echo ""
echo "For each device and screen, you'll need to:"
echo "1. Take a screenshot of the screen on the device"
echo "2. Move the screenshot to the Desktop"
echo "3. Run this script and follow the prompts"
echo ""
echo "Required screenshots:"

# Print the required screenshots
for device in "${DEVICES[@]}"; do
  for screen in "${SCREENS[@]}"; do
    echo "- $device: $screen"
  done
done

echo ""
echo "Press Enter to continue..."
read

# For each device and screen
for device in "${DEVICES[@]}"; do
  for screen in "${SCREENS[@]}"; do
    echo ""
    echo "Looking for screenshot: $device - $screen"
    echo "Please drag and drop the screenshot file into this terminal window and press Enter:"
    
    read screenshot_path
    
    # Remove quotes if present
    screenshot_path=$(echo $screenshot_path | tr -d '"')
    
    # Get the filename
    filename=$(basename "$screenshot_path")
    
    # Copy the file to the fastlane directory with the correct name
    target_path="fastlane/screenshots/en-US/$device-$screen.png"
    
    echo "Copying $screenshot_path to $target_path"
    cp "$screenshot_path" "$target_path"
    
    if [ $? -eq 0 ]; then
      echo "✅ Successfully copied screenshot"
    else
      echo "❌ Failed to copy screenshot"
    fi
  done
done

echo ""
echo "All screenshots organized!"
echo "You can now run 'fastlane frame_screenshots' to add frames to your screenshots."
echo "Then run 'fastlane upload_screenshots' to upload them to App Store Connect." 