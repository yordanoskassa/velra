# Taking App Store Screenshots for Expo/React Native Projects

Since Expo/React Native projects don't use a traditional Xcode project structure, we need to take screenshots manually. This document explains the process.

## Prerequisites

1. Install Fastlane:
```bash
brew install fastlane
```

2. Install Xcode and iOS Simulators for the required devices

## Step 1: Run Your App in Simulators

1. Start your Expo app:
```bash
cd frontend
npx expo start
```

2. Press `i` to open in an iOS simulator

3. Use Xcode to open additional simulators for different device sizes:
   - Open Xcode
   - Go to Xcode → Open Developer Tool → Simulator
   - In Simulator, go to File → Open Simulator → [Select Device]
   - Required devices:
     - iPhone 8 Plus (5.5")
     - iPhone 11 Pro Max or iPhone 13 Pro Max (6.5")
     - iPad Pro (12.9")

4. Run your app in each simulator (using the Expo QR code or by pressing `i` multiple times)

## Step 2: Take Screenshots

For each simulator:

1. Navigate to each key screen in your app
2. Take a screenshot using `Cmd + S` or Hardware → Screenshot
3. Screenshots will be saved to your Desktop

## Step 3: Organize Screenshots

1. Create a directory structure for fastlane:
```bash
mkdir -p fastlane/screenshots/en-US
```

2. Move and rename your screenshots to follow fastlane's naming convention:
```
fastlane/screenshots/en-US/[Device Name]-[Screenshot Name].png
```

Example:
```
fastlane/screenshots/en-US/iPhone 8 Plus-01_Welcome_Screen.png
fastlane/screenshots/en-US/iPhone 13 Pro Max-01_Welcome_Screen.png
fastlane/screenshots/en-US/iPad Pro (12.9-inch)-01_Welcome_Screen.png
```

## Step 4: Add Frames (Optional)

Use fastlane's frameit tool to add device frames to your screenshots:

```bash
cd frontend
fastlane frame_screenshots
```

## Step 5: Upload to App Store

Once you have all your screenshots ready:

```bash
cd frontend
fastlane upload_screenshots
```

## Required Screenshot Sizes

Apple requires screenshots for these devices:
- iPhone 6.5" Display (iPhone 11 Pro Max or newer)
- iPhone 5.5" Display (iPhone 8 Plus)
- iPad 12.9" Display (iPad Pro 12.9")

## Screenshot Naming Convention

Use a consistent naming scheme for your screenshots:
- `01_Welcome_Screen.png`
- `02_Login_Screen.png`
- `03_News_Feed.png`
- etc.

This helps keep your screenshots organized and in the correct order in App Store Connect. 