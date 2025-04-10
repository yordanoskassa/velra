const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Define the source icon path
const sourceIcon = path.join(__dirname, 'assets', 'icon.png');

// Define the iOS icon sizes needed
const iosIconSizes = [
  { size: 20, scales: [1, 2, 3] },  // 20pt at 1x, 2x, 3x
  { size: 29, scales: [1, 2, 3] },  // 29pt at 1x, 2x, 3x
  { size: 40, scales: [1, 2, 3] },  // 40pt at 1x, 2x, 3x
  { size: 60, scales: [2, 3] },     // 60pt at 2x, 3x (120, 180)
  { size: 76, scales: [1, 2] },     // 76pt at 1x, 2x (76, 152)
  { size: 83.5, scales: [2] },      // 83.5pt at 2x (167)
  { size: 1024, scales: [1] }       // App Store icon
];

// Create the directory for iOS icons if it doesn't exist
const iosIconsDir = path.join(__dirname, 'assets', 'ios');
if (!fs.existsSync(iosIconsDir)) {
  fs.mkdirSync(iosIconsDir, { recursive: true });
}

// Generate iOS icons
console.log('Generating iOS icons...');
iosIconSizes.forEach(({ size, scales }) => {
  scales.forEach(scale => {
    const pixelSize = Math.round(size * scale);
    const iconName = `icon-${size}@${scale}x.png`;
    const outputPath = path.join(iosIconsDir, iconName);
    
    try {
      execSync(`npx sharp-cli resize ${sourceIcon} ${pixelSize} ${pixelSize} --output ${outputPath}`);
      console.log(`Created: ${iconName} (${pixelSize}x${pixelSize})`);
    } catch (error) {
      console.error(`Error creating ${iconName}:`, error.message);
    }
  });
});

console.log('\nIcon generation complete!');
console.log('\nNow update your app.json to include these icons in the iOS section:');
console.log(`
"ios": {
  ...
  "icon": "./assets/icon.png",
  "supportsTablet": true,
  "infoPlist": {
    "CFBundleIconName": "AppIcon"
  }
}
`); 