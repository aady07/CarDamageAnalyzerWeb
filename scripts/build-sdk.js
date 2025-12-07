#!/usr/bin/env node

/**
 * SDK Build Script
 * 
 * This script:
 * 1. Builds the React app using Vite
 * 2. Copies built files to Android assets structure
 * 3. Creates version info file
 * 4. Packages everything for Android integration
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const SDK_OUTPUT_DIR = path.join(rootDir, 'sdk-output');
const ANDROID_ASSETS_DIR = path.join(SDK_OUTPUT_DIR, 'android', 'assets', 'webview');
const BUILD_DIR = path.join(rootDir, 'dist');

console.log('🚀 Starting SDK build process...\n');

// Step 1: Clean previous builds
console.log('📦 Step 1: Cleaning previous builds...');
if (fs.existsSync(SDK_OUTPUT_DIR)) {
  fs.rmSync(SDK_OUTPUT_DIR, { recursive: true, force: true });
}
if (fs.existsSync(BUILD_DIR)) {
  fs.rmSync(BUILD_DIR, { recursive: true, force: true });
}
console.log('✅ Cleaned\n');

// Step 2: Build React app
console.log('🔨 Step 2: Building React app...');
try {
  execSync('npm run build', { 
    cwd: rootDir, 
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' }
  });
  console.log('✅ Build complete\n');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

// Step 3: Verify build output
console.log('🔍 Step 3: Verifying build output...');
if (!fs.existsSync(BUILD_DIR)) {
  console.error('❌ Build directory not found!');
  process.exit(1);
}

const indexHtml = path.join(BUILD_DIR, 'index.html');
if (!fs.existsSync(indexHtml)) {
  console.error('❌ index.html not found in build output!');
  process.exit(1);
}
console.log('✅ Build output verified\n');

// Step 4: Create Android assets structure
console.log('📁 Step 4: Creating Android assets structure...');
fs.mkdirSync(ANDROID_ASSETS_DIR, { recursive: true });

// Copy all files from dist to android/assets/webview
function copyRecursive(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyRecursive(BUILD_DIR, ANDROID_ASSETS_DIR);
console.log('✅ Android assets structure created\n');

// Step 5: Create version info
console.log('📝 Step 5: Creating version info...');
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
const versionInfo = {
  version: packageJson.version,
  buildDate: new Date().toISOString(),
  buildType: 'android-sdk',
  assetsPath: 'assets/webview'
};

fs.writeFileSync(
  path.join(SDK_OUTPUT_DIR, 'version.json'),
  JSON.stringify(versionInfo, null, 2)
);
console.log('✅ Version info created\n');

// Step 6: Copy Android bridge example files
console.log('📋 Step 6: Copying Android bridge examples...');
const androidExamplesDir = path.join(SDK_OUTPUT_DIR, 'android', 'examples');
fs.mkdirSync(androidExamplesDir, { recursive: true });

// These will be created separately, but create placeholder
console.log('✅ Android examples directory created\n');

// Step 7: Create README
console.log('📖 Step 7: Creating SDK README...');
const sdkReadme = `# Car Damage Analyzer Android SDK

## Version
${versionInfo.version}

## Build Date
${versionInfo.buildDate}

## Installation

1. Copy the \`assets/webview\` folder to your Android app's \`src/main/assets/\` directory
2. Implement the Android bridge classes (see examples/)
3. Set up WebView as shown in integration guide

## Structure

\`\`\`
assets/webview/
├── index.html
└── assets/
    └── [all built assets]
\`\`\`

## Next Steps

1. See \`docs/INTEGRATION_GUIDE.md\` for integration instructions
2. Check \`android/examples/\` for bridge implementation examples
3. Review \`ANDROID_STORAGE_EXPLANATION.md\` for storage details
`;

fs.writeFileSync(path.join(SDK_OUTPUT_DIR, 'README.md'), sdkReadme);
console.log('✅ SDK README created\n');

// Step 8: Create ZIP file
console.log('📦 Step 8: Creating ZIP file...');
try {
  const zipCommand = `cd ${SDK_OUTPUT_DIR} && zip -r car-damage-analyzer-sdk-v${packageJson.version}.zip android/ version.json README.md ANDROID_INTEGRATION_GUIDE.md 2>/dev/null || cd ${SDK_OUTPUT_DIR} && zip -r car-damage-analyzer-sdk-v${packageJson.version}.zip android/ version.json README.md ANDROID_INTEGRATION_GUIDE.md`;
  execSync(zipCommand, { cwd: rootDir, stdio: 'inherit' });
  console.log('✅ ZIP file created\n');
} catch (error) {
  console.warn('⚠️  Could not create ZIP file (zip command not found). You can create it manually:');
  console.warn(`   cd ${SDK_OUTPUT_DIR}`);
  console.warn(`   zip -r car-damage-analyzer-sdk-v${packageJson.version}.zip android/ version.json README.md ANDROID_INTEGRATION_GUIDE.md\n`);
}

// Step 9: Summary
console.log('✨ SDK build complete!\n');
console.log('📦 Output directory:', SDK_OUTPUT_DIR);
console.log('📁 Android assets:', ANDROID_ASSETS_DIR);
console.log('\n📋 SDK Package:');
console.log(`   ZIP file: ${SDK_OUTPUT_DIR}/car-damage-analyzer-sdk-v${packageJson.version}.zip`);
console.log('\n📋 For Android Developers:');
console.log('1. Extract the ZIP file');
console.log('2. Copy android/assets/webview/ to app/src/main/assets/webview/');
console.log('3. Implement Android bridge classes (see ANDROID_INTEGRATION_GUIDE.md)');
console.log('4. Set up WebView integration');
console.log('\n✅ Done!');

