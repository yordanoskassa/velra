# TestFlight Submission Guide for Headline Decoder

This guide explains how to submit your Expo/React Native app to TestFlight for beta testing.

## Prerequisites

1. **Apple Developer Account**: You need an active Apple Developer account ($99/year)

2. **App Store Connect Setup**: Your app must be set up in App Store Connect with:
   - App name and bundle ID
   - App Store information (description, keywords, etc.)
   - App icon

3. **Expo/EAS CLI**: Install the EAS CLI:
   ```bash
   npm install -g eas-cli
   ```

4. **EAS Configuration**: Make sure you have an `eas.json` file in your project root with proper configuration

## Step 1: Configure EAS Build

Create or update your `eas.json` file:

```json
{
  "cli": {
    "version": ">= 3.13.3"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "production": {}
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "1234567890", // Your App Store Connect App ID
        "appleTeamId": "ABCDEF123" // Your Apple Team ID
      }
    }
  }
}
```

Replace the placeholder values with your actual Apple credentials.

## Step 2: Build Your App

You can build your app using EAS:

```bash
# Log in to your Expo account
eas login

# Build for TestFlight
eas build --platform ios --profile preview
```

This will:
1. Create a production-ready iOS build
2. Upload it to Expo's build servers
3. Sign it with your Apple Developer credentials
4. Provide you with a link to monitor the build progress

## Step 3: Submit to TestFlight

Once your build is complete, submit it to TestFlight:

```bash
# Submit the latest build
eas submit --platform ios
```

Or use the fastlane lane we created:

```bash
fastlane beta
```

## Step 4: Configure TestFlight in App Store Connect

After submission:

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Navigate to your app → TestFlight
3. Add test information (what to test, how to test)
4. Add testers:
   - Internal testers (limited to users in your Apple Developer team)
   - External testers (up to 10,000 users via email invitation)

## Step 5: Invite Testers

For internal testers:
1. Go to App Store Connect → Users and Access
2. Add users to your team
3. Assign them the "App Manager" or "Developer" role
4. Add them as internal testers in TestFlight

For external testers:
1. Go to App Store Connect → TestFlight → External Testing
2. Create a group (e.g., "Beta Testers")
3. Add email addresses
4. Send invitations

## Step 6: Test Your App

Testers will:
1. Receive an email invitation
2. Install the TestFlight app on their iOS device
3. Accept the invitation
4. Install your app through TestFlight
5. Provide feedback directly through TestFlight

## Common Issues and Solutions

- **Missing Provisioning Profile**: Make sure your Apple Developer account has the correct provisioning profiles
- **App Icon Missing**: Ensure you have a proper app icon in your Expo project
- **Build Rejected**: Check the rejection reason in App Store Connect and fix the issues
- **Testers Can't Access**: Verify their email addresses and that they've accepted the invitation

## Next Steps After TestFlight

Once testing is complete and you're ready for App Store submission:

```bash
# Build for production
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios
```

Or use the screenshots you've already prepared and submit through App Store Connect directly. 