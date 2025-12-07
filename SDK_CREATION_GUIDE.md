# Android SDK Creation Guide

## Overview

This guide explains how to package the React/TypeScript Car Damage Analyzer app as an Android SDK that can be embedded in an Android app via WebView.

## SDK Structure

```
car-damage-analyzer-sdk/
├── assets/
│   ├── webview/
│   │   ├── index.html
│   │   ├── assets/
│   │   │   ├── index-[hash].js
│   │   │   ├── index-[hash].css
│   │   │   └── [other assets]
│   │   └── [stencil images, icons, etc.]
│   └── README.md
├── android/
│   ├── CarDamageAnalyzerSDK.java (or .kt)
│   ├── AndroidImageStore.java (or .kt)
│   └── InspectionQueueManager.java (or .kt)
├── docs/
│   ├── INTEGRATION_GUIDE.md
│   └── API_REFERENCE.md
└── example/
    └── MainActivity.java (or .kt) - Example integration
```

## Step-by-Step Process

### Step 1: Build the React App

```bash
npm run build
```

This creates a `dist/` folder with:
- `index.html` - Entry point
- `assets/` - All JS, CSS, and other assets
- Static files (images, icons, etc.)

### Step 2: Prepare Android Assets

1. Copy `dist/` contents to Android `assets/webview/` folder
2. Ensure all paths are relative (Vite handles this automatically)
3. Test that all assets load correctly

### Step 3: Create Android Bridge Classes

Create Java/Kotlin classes that:
1. **AndroidImageStore** - Handles image saving
2. **AndroidBridge** - Handles inspection saving
3. **WebView Setup** - Configures WebView with JavaScript interfaces

### Step 4: Package as SDK

Options:
- **Option A: AAR Library** - Create Android Library (AAR)
- **Option B: Direct Assets** - Provide assets folder + bridge classes
- **Option C: Gradle Dependency** - Publish to Maven repository

## Integration Flow

```
Android App
  ↓
Load WebView with assets/index.html
  ↓
WebView loads React app
  ↓
React app detects Android bridge
  ↓
User captures photos → Saved via AndroidImageStore
  ↓
User completes inspection → Saved via AndroidBridge
  ↓
Android app handles upload queue
```

## What Needs to Be Created

### 1. Build Script
- Script to build React app
- Script to copy files to Android assets structure
- Version management

### 2. Android Bridge Classes
- `AndroidImageStore` - JavaScript interface for saving images
- `AndroidBridge` - JavaScript interface for saving inspections
- WebView configuration helper

### 3. Documentation
- Integration guide
- API reference
- Example code
- Troubleshooting

### 4. Example App
- Minimal Android app showing integration
- Shows how to set up WebView
- Shows how to implement bridges

## File Structure After Build

```
dist/
├── index.html
├── assets/
│   ├── index-abc123.js (main bundle)
│   ├── index-def456.css (styles)
│   ├── Front-xyz789.png (stencil images)
│   └── [other assets]
└── favicon.ico
```

## Android Assets Structure

```
app/src/main/assets/
└── webview/
    ├── index.html
    └── assets/
        ├── index-abc123.js
        ├── index-def456.css
        └── [all other assets]
```

## Key Requirements

1. **Base Path**: All assets must use relative paths
2. **Bridge Setup**: Must be set up before WebView loads
3. **File Access**: Android must grant file permissions
4. **Network**: Handle offline/online scenarios
5. **Storage**: Manage local storage for images and inspections

## Next Steps

1. Create build script for SDK packaging
2. Create Android bridge classes
3. Create integration documentation
4. Create example Android app
5. Test end-to-end flow

