# Car Damage Analyzer Android SDK

## Overview

This SDK packages the Car Damage Analyzer React app for integration into Android applications via WebView.

## Quick Start

### 1. Build the SDK

```bash
npm run build:sdk
```

This will:
- Build the React app
- Package it for Android
- Create SDK output in `sdk-output/` directory

### 2. SDK Output Structure

```
sdk-output/
├── android/
│   ├── assets/
│   │   └── webview/          ← Copy this to your Android app
│   │       ├── index.html
│   │       └── assets/
│   │           └── [all built files]
│   └── examples/              ← Android bridge classes
│       ├── AndroidImageStore.kt
│       ├── AndroidBridge.kt
│       └── WebViewSetup.kt
├── docs/
│   └── INTEGRATION_GUIDE.md   ← Integration instructions
├── version.json               ← SDK version info
└── README.md
```

### 3. Integration Steps

1. **Copy Assets**
   ```
   Copy: sdk-output/android/assets/webview/
   To: YourAndroidApp/app/src/main/assets/webview/
   ```

2. **Add Bridge Classes**
   - Copy Kotlin files from `sdk-output/android/examples/` to your project
   - Implement `InspectionQueueManager` (see `ANDROID_STORAGE_EXPLANATION.md`)

3. **Set Up WebView**
   ```kotlin
   WebViewSetup.setupWebView(webView, context, inspectionQueueManager)
   ```

4. **Add Permissions**
   - Camera permission
   - Storage permission (if needed)

## Documentation

- **Integration Guide**: `sdk-output/docs/INTEGRATION_GUIDE.md`
- **Storage Explanation**: `ANDROID_STORAGE_EXPLANATION.md`
- **SDK Creation Guide**: `SDK_CREATION_GUIDE.md`

## Features

- ✅ Offline image capture
- ✅ Local storage of inspections
- ✅ Automatic sync when network available
- ✅ Morning/Evening session handling
- ✅ Android WebView integration
- ✅ JavaScript bridge interfaces

## Requirements

- Android API 21+ (Android 5.0+)
- Camera permission
- WebView with JavaScript enabled

## Build Process

The SDK build process:

1. **Build React App**: Runs `npm run build` to create production bundle
2. **Package Assets**: Copies all files to Android assets structure
3. **Create Documentation**: Generates version info and README
4. **Output SDK**: Creates ready-to-use SDK package

## Version

Check `sdk-output/version.json` for:
- SDK version
- Build date
- Build type

## Support

For integration help, see:
- `sdk-output/docs/INTEGRATION_GUIDE.md` - Step-by-step integration
- `ANDROID_STORAGE_EXPLANATION.md` - Storage and database details
- `SDK_CREATION_GUIDE.md` - SDK creation process

## Next Steps

1. Run `npm run build:sdk`
2. Copy assets to your Android project
3. Implement bridge classes
4. Test integration
5. Deploy!

