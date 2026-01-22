# Android Integration Guide

## How to Pass Car Registration Number to SDK

The SDK now reads the car registration number from URL query parameters. The parent Android app must pass the registration number when loading the WebView.

## Required URL Parameter

### Parameter Name
- `regNumber` - The car registration number (required)

### Example URL

When loading the WebView in your Android app, construct the URL like this:

```kotlin
// Example: Load SDK with car registration number
val registrationNumber = "ABC123" // Get from your logged-in user's data
val baseUrl = "file:///android_asset/webview/index.html"
val urlWithParams = "$baseUrl?regNumber=${URLEncoder.encode(registrationNumber, "UTF-8")}"

webView.loadUrl(urlWithParams)
```

### Full Example (Kotlin)

```kotlin
class InspectionActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Get car registration number from your app's data
        val carRegistrationNumber = getUserCarRegistrationNumber() // Your method
        
        // Construct URL with registration number
        val baseUrl = "file:///android_asset/webview/index.html"
        val encodedRegNumber = URLEncoder.encode(carRegistrationNumber, "UTF-8")
        val fullUrl = "$baseUrl?regNumber=$encodedRegNumber"
        
        // Setup WebView
        webView = findViewById(R.id.webView)
        setupWebView(webView)
        
        // Load SDK with registration number
        webView.loadUrl(fullUrl)
    }
    
    private fun getUserCarRegistrationNumber(): String {
        // Get from your logged-in user session, database, or API
        // Example:
        return sharedPreferences.getString("user_car_reg_number", "") ?: ""
    }
}
```

### Full Example (Java)

```java
public class InspectionActivity extends AppCompatActivity {
    private WebView webView;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Get car registration number from your app's data
        String carRegistrationNumber = getUserCarRegistrationNumber();
        
        // Construct URL with registration number
        String baseUrl = "file:///android_asset/webview/index.html";
        String encodedRegNumber = URLEncoder.encode(carRegistrationNumber, "UTF-8");
        String fullUrl = baseUrl + "?regNumber=" + encodedRegNumber;
        
        // Setup WebView
        webView = findViewById(R.id.webView);
        setupWebView(webView);
        
        // Load SDK with registration number
        webView.loadUrl(fullUrl);
    }
    
    private String getUserCarRegistrationNumber() {
        // Get from your logged-in user session, database, or API
        SharedPreferences prefs = getSharedPreferences("app_prefs", MODE_PRIVATE);
        return prefs.getString("user_car_reg_number", "");
    }
}
```

## Important Notes

1. **URL Encoding**: Always URL-encode the registration number to handle special characters and spaces
   ```kotlin
   URLEncoder.encode(registrationNumber, "UTF-8")
   ```

2. **Required Parameter**: The `regNumber` parameter is **required**. Without it, the SDK will not be able to proceed to the camera screen.

3. **No Form Modal**: The SDK no longer shows a form to enter car details. All vehicle information must come from the parent Android app.

4. **What Gets Saved**: Only the registration number is saved to the Android bridge. The SDK will save:
   ```json
   {
     "registrationNumber": "ABC123",
     "sessionType": "MORNING" | "EVENING",
     "clientName": "SNAPCABS",
     "images": [...]
   }
   ```

## Testing

To test locally, you can use:
```
http://localhost:5173/?regNumber=ABC123
```

## Error Handling

If the registration number is missing:
- The "Start recording" button will be disabled
- User cannot proceed to camera screen
- Check console logs for warnings

Make sure your Android app always passes `regNumber` when loading the WebView.
