# App Store Screenshot Generation Instructions

This document explains how to generate screenshots for App Store submission using Fastlane.

## Prerequisites

1. Install Fastlane:
```bash
brew install fastlane
```

2. Install Xcode command line tools:
```bash
xcode-select --install
```

## Setup

1. Make sure you have the following files in your project:
   - `Snapfile` - Configuration for screenshot devices and languages
   - `SnapshotHelper.swift` - Helper functions for taking screenshots
   - `HeadlineDecoderUITests.swift` - UI test that navigates through your app
   - `fastlane/Fastfile` - Fastlane configuration

2. Add these files to your Xcode project:
   - Create a new UI Test target in Xcode if you don't have one
   - Add `SnapshotHelper.swift` and `HeadlineDecoderUITests.swift` to your UI Test target

## Generating Screenshots

Run the following command from your project root:

```bash
cd frontend
fastlane screenshots
```

This will:
1. Build your app
2. Launch the app in simulators for each device specified in the Snapfile
3. Run the UI tests which navigate through your app
4. Take screenshots at each point where `snapshot()` is called
5. Save the screenshots to the `fastlane/screenshots` directory

## Customizing Screenshots

1. **Modify the UI Tests**: Edit `HeadlineDecoderUITests.swift` to navigate to different screens in your app.

2. **Change Devices**: Edit the `Snapfile` to specify which devices you want screenshots for.

3. **Add Text Ovelrays**: Use Fastlane's `frameit` tool to add device frames and text ovelrays:
   ```bash
   fastlane frameit
   ```

## Uploading to App Store

After generating screenshots, you can upload them to App Store Connect:

```bash
fastlane deliver
```

Or include them in your app submission:

```bash
fastlane release
```

## Troubleshooting

- **UI Test Failures**: If tests fail, try running them directly in Xcode to debug
- **Missing Elements**: Use Xcode's Accessibility Inspector to find the correct element identifiers
- **Timing Issues**: Add `sleep()` calls if screens need more time to load

## Required Screenshot Sizes

Apple requires screenshots for these devices:
- iPhone 6.5" Display (1284 x 2778 pixels)
- iPhone 5.5" Display (1242 x 2208 pixels)
- iPad 12.9" Display (2048 x 2732 pixels)

The Snapfile is configured to include these required sizes. 