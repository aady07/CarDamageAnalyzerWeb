# Webview Integration Guide for App Developers

This guide explains how the webview inspection flow works and how to implement it in your mobile app.

## Overview

The webview captures **10 photos** per inspection session. Each photo must be stored, uploaded to S3, and then submitted via API call.

## Key Requirements

### 1. Image Storage
- **Number of Photos**: Exactly **10 photos** per inspection
- **Photo Types**: Each photo corresponds to a specific car part (front, rear, front fenders, doors, rear fenders)
- **Storage**: Photos must be stored locally first, then uploaded to S3

### 2. Inspection Structure
- **Sessions**: Each inspection has two sessions:
  - `MORNING` - Morning inspection session
  - `EVENING` - Evening inspection session
- **Registration Number**: Unique identifier for each vehicle
- **Client Name**: Client identifier (e.g., "SNAPCABS", "REFUX")

## Step-by-Step Implementation

### Step 1: Capture and Store 10 Photos

When the user completes the camera capture flow, you will receive 10 photos. Store them locally with metadata:

```javascript
// Example structure for storing photos
const inspectionPhotos = [
  { 
    segmentId: 'front',
    imageData: base64_or_file_path,
    timestamp: Date.now()
  },
  { 
    segmentId: 'right_front_fender',
    imageData: base64_or_file_path,
    timestamp: Date.now()
  },
  { 
    segmentId: 'right_front_door',
    imageData: base64_or_file_path,
    timestamp: Date.now()
  },
  { 
    segmentId: 'right_rear_door',
    imageData: base64_or_file_path,
    timestamp: Date.now()
  },
  { 
    segmentId: 'right_rear_fender',
    imageData: base64_or_file_path,
    timestamp: Date.now()
  },
  { 
    segmentId: 'rear',
    imageData: base64_or_file_path,
    timestamp: Date.now()
  },
  { 
    segmentId: 'left_rear_fender',
    imageData: base64_or_file_path,
    timestamp: Date.now()
  },
  { 
    segmentId: 'left_rear_door',
    imageData: base64_or_file_path,
    timestamp: Date.now()
  },
  { 
    segmentId: 'left_front_door',
    imageData: base64_or_file_path,
    timestamp: Date.now()
  },
  { 
    segmentId: 'left_front_fender',
    imageData: base64_or_file_path,
    timestamp: Date.now()
  }
];
```

**Segment IDs** (must match exactly):
- `front`
- `right_front_fender`
- `right_front_door`
- `right_rear_door`
- `right_rear_fender`
- `rear`
- `left_rear_fender`
- `left_rear_door`
- `left_front_door`
- `left_front_fender`

### Step 2: Upload Photos to S3

For each photo, you need to:

1. **Get a presigned upload URL** from the backend:
   ```
   POST /api/get-upload-url
   Content-Type: application/x-www-form-urlencoded
   
   Body:
   fileName=car_front-1234567890.jpg
   contentType=image/jpeg
   ```

   **Response:**
   ```json
   {
     "presignedUrl": "https://s3.amazonaws.com/...",
     "fileKey": "uploads/car_front-1234567890.jpg",
     "s3Url": "https://bucket.s3.amazonaws.com/uploads/car_front-1234567890.jpg",
     "expiration": 3600
   }
   ```

2. **Upload the image to S3** using the presigned URL:
   ```
   PUT {presignedUrl}
   Content-Type: image/jpeg
   
   Body: [image file/blob]
   ```

3. **Store the S3 URL** for later API submission:
   ```javascript
   const imageUrl = response.s3Url; // Save this for Step 3
   ```

**Important**: Upload each photo immediately after capture if online. If offline, queue the uploads and process when connection is restored.

### Step 3: Submit Inspection via API

Once all 10 photos are uploaded to S3 and you have their URLs, submit the inspection:

```
POST /api/car-inspection/submit
Content-Type: application/json
Authorization: Bearer {token}

Body:
{
  "registrationNumber": "ABC1234",
  "images": [
    { "type": "front", "imageUrl": "https://bucket.s3.amazonaws.com/uploads/car_front-1234567890.jpg" },
    { "type": "right_front_fender", "imageUrl": "https://bucket.s3.amazonaws.com/uploads/car_right_front_fender-1234567891.jpg" },
    { "type": "right_front_door", "imageUrl": "https://bucket.s3.amazonaws.com/uploads/car_right_front_door-1234567892.jpg" },
    { "type": "right_rear_door", "imageUrl": "https://bucket.s3.amazonaws.com/uploads/car_right_rear_door-1234567893.jpg" },
    { "type": "right_rear_fender", "imageUrl": "https://bucket.s3.amazonaws.com/uploads/car_right_rear_fender-1234567894.jpg" },
    { "type": "rear", "imageUrl": "https://bucket.s3.amazonaws.com/uploads/car_rear-1234567895.jpg" },
    { "type": "left_rear_fender", "imageUrl": "https://bucket.s3.amazonaws.com/uploads/car_left_rear_fender-1234567896.jpg" },
    { "type": "left_rear_door", "imageUrl": "https://bucket.s3.amazonaws.com/uploads/car_left_rear_door-1234567897.jpg" },
    { "type": "left_front_door", "imageUrl": "https://bucket.s3.amazonaws.com/uploads/car_left_front_door-1234567898.jpg" },
    { "type": "left_front_fender", "imageUrl": "https://bucket.s3.amazonaws.com/uploads/car_left_front_fender-1234567899.jpg" }
  ],
  "videoUrl": "",
  "clientName": "SNAPCABS",
  "sessionType": "MORNING"
}
```

**Response:**
```json
{
  "success": true,
  "inspectionId": 12345,
  "registrationNumber": "ABC1234",
  "status": "processing",
  "message": "Inspection submitted successfully"
}
```

## Offline/Online Logic

### Online Flow (Normal)
1. User captures photo
2. Immediately get presigned URL from backend
3. Upload photo to S3
4. Store S3 URL locally
5. Repeat for all 10 photos
6. Submit inspection API call with all S3 URLs

### Offline Flow
1. User captures photo
2. Store photo locally with metadata (segmentId, timestamp)
3. Queue upload task for when connection is restored
4. Repeat for all 10 photos
5. When online:
   - Process upload queue (get presigned URLs, upload to S3)
   - Once all uploaded, submit inspection API call

**Implementation Tips:**
- Use a background queue system for offline uploads
- Track upload status for each photo (pending, uploading, uploaded, failed)
- Retry failed uploads with exponential backoff
- Only submit API call when ALL 10 photos are successfully uploaded

## Duplicate Detection and Sessions

### How Sessions Work

Each inspection can have two sessions per day:
- **MORNING session**: First inspection of the day
- **EVENING session**: Second inspection of the day (optional)

**Important Rules:**
- Same registration number can have both MORNING and EVENING sessions on the same day
- Each session must have exactly 10 photos
- Sessions are tracked separately by the backend

### Duplicate Prevention

The backend handles duplicate detection based on:
- **Registration Number**: Must be unique per vehicle
- **Session Type**: MORNING and EVENING are separate sessions
- **Date**: Sessions are tracked per day

**What happens if you submit a duplicate:**
- If same registration + same session type + same day → Backend will handle (may update existing or reject)
- Different session type (MORNING vs EVENING) → Allowed (creates new session)

**Your App Should:**
- Check if MORNING session already exists before allowing another MORNING submission
- Allow EVENING session even if MORNING exists (and vice versa)
- Show appropriate UI to indicate which sessions are completed/pending

### Example Session Logic

```javascript
// Before submitting, check existing sessions
const existingSessions = await getInspections(registrationNumber);

if (existingSessions.morning.submitted && sessionType === 'MORNING') {
  // Warn user: MORNING session already exists
  // Option: Allow overwrite or reject
}

if (existingSessions.evening.submitted && sessionType === 'EVENING') {
  // Warn user: EVENING session already exists
  // Option: Allow overwrite or reject
}

// Proceed with submission if allowed
```

## Complete Flow Example

```javascript
async function submitInspection(photos, registrationNumber, clientName, sessionType) {
  const uploadedImages = [];
  
  // Step 1: Upload each photo to S3
  for (const photo of photos) {
    try {
      // Get presigned URL
      const presignedResponse = await fetch('/api/get-upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${token}`
        },
        body: new URLSearchParams({
          fileName: `car_${photo.segmentId}-${Date.now()}.jpg`,
          contentType: 'image/jpeg'
        })
      });
      
      const { presignedUrl, s3Url } = await presignedResponse.json();
      
      // Upload to S3
      await fetch(presignedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'image/jpeg'
        },
        body: photo.imageData
      });
      
      // Store S3 URL
      uploadedImages.push({
        type: photo.segmentId,
        imageUrl: s3Url
      });
      
    } catch (error) {
      console.error(`Failed to upload ${photo.segmentId}:`, error);
      throw error;
    }
  }
  
  // Step 2: Submit inspection
  const response = await fetch('/api/car-inspection/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      registrationNumber: registrationNumber,
      images: uploadedImages,
      videoUrl: '',
      clientName: clientName,
      sessionType: sessionType
    })
  });
  
  const result = await response.json();
  return result;
}
```

## Error Handling

### Common Errors

1. **Network Error During Upload**
   - Store photo locally
   - Queue for retry when connection restored
   - Don't submit API call until all photos uploaded

2. **API Submission Failure**
   - Photos are already in S3 (don't need to re-upload)
   - Retry API call with same S3 URLs
   - Don't create duplicate S3 uploads

3. **Partial Upload Failure**
   - Track which photos succeeded
   - Only retry failed photos
   - Submit API call only when all 10 photos uploaded

## Testing Checklist

- [ ] Capture all 10 photos successfully
- [ ] Upload all 10 photos to S3
- [ ] Submit inspection API call with correct structure
- [ ] Handle offline scenario (queue uploads)
- [ ] Handle online restoration (process queue)
- [ ] Prevent duplicate MORNING sessions
- [ ] Allow both MORNING and EVENING sessions
- [ ] Handle API errors gracefully
- [ ] Validate all 10 segment IDs are correct

## Notes

- Minimum 4 images are required by backend, but webview captures exactly 10
- Video is disabled (always send empty string for `videoUrl`)
- All images must be JPEG format
- Image URLs must be accessible S3 URLs (not local paths)
- Authentication token must be included in all API calls


