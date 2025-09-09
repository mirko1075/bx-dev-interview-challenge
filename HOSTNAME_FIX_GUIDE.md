# Presigned URL Hostname Resolution Fix

## 🐛 Problem Identified

The presigned URLs were generating with internal Docker hostnames (`storage.local`) that are not resolvable from the frontend browser, causing `net::ERR_NAME_NOT_RESOLVED` errors.

## ✅ Solution Implemented

### 1. Added Hostname Replacement Method

```typescript
// Helper method to replace hostname for frontend access
private replaceHostnameForFrontend(url: string): string {
  // Replace internal Docker hostname with localhost for frontend access
  let modifiedUrl = url.replace('storage.local', 'localhost');
  
  // Also handle case where the URL might have the IP or other hostnames
  modifiedUrl = modifiedUrl.replace('s3ninja', 'localhost');
  
  this.logger.debug(`URL hostname replacement: ${url} -> ${modifiedUrl}`);
  return modifiedUrl;
}
```

### 2. Updated All Presigned URL Methods

- **generatePresignedUploadUrl()** - Now replaces hostnames
- **generatePresignedDownloadUrl()** - Now replaces hostnames  
- **getPresignedUploadUrl()** (legacy) - Updated to use new helper

## 🔧 How It Works

### Before (❌ Broken):
```
Generated URL: http://storage.local:9000/bonusx-bucket/uploads/user-123/file.jpg?...
Browser Error: net::ERR_NAME_NOT_RESOLVED
```

### After (✅ Fixed):
```
Generated URL: http://localhost:9000/bonusx-bucket/uploads/user-123/file.jpg?...
Browser Success: File uploads/downloads directly to S3
```

## 🐛 Debugging Steps

If you're still experiencing issues, check the following:

### 1. Check S3 Service is Running
```bash
# Check if S3ninja is running
curl http://localhost:9000

# Should return S3ninja web interface
```

### 2. Check Generated URLs in Backend Logs
The backend now logs URL transformations:
```
DEBUG: URL hostname replacement: http://storage.local:9000/... -> http://localhost:9000/...
```

### 3. Check Network Connectivity
```bash
# Test S3 endpoint from your machine
curl -v http://localhost:9000

# Should connect successfully
```

### 4. Check Docker Network
```bash
# Ensure S3ninja container is running
docker ps | grep s3-ninja

# Check port mapping
docker port <s3ninja-container-id>
```

### 5. Frontend Network Tab
Open browser dev tools → Network tab → Try upload
- Look for the actual URL being called
- Check if it uses `localhost:9000` not `storage.local:9000`

## 🔧 Alternative Solutions

If localhost still doesn't work, you can:

### Option 1: Add Host Entry
Add to `/etc/hosts` (Linux/Mac) or `C:\Windows\System32\drivers\etc\hosts` (Windows):
```
127.0.0.1 storage.local
```

### Option 2: Environment Variable Override
Set a custom frontend-accessible endpoint:
```env
S3_FRONTEND_ENDPOINT=http://localhost:9000
```

Then modify the helper method:
```typescript
private replaceHostnameForFrontend(url: string): string {
  const frontendEndpoint = this.configService.get<string>('S3_FRONTEND_ENDPOINT');
  if (frontendEndpoint) {
    // Replace the entire host:port part
    return url.replace(/http:\/\/[^\/]+/, frontendEndpoint);
  }
  return url.replace('storage.local', 'localhost');
}
```

## 🧪 Testing the Fix

### 1. Start the Services
```bash
cd backend
docker-compose up -d
npm run start:dev
```

### 2. Test Presigned Upload
```bash
# Get a JWT token first (login)
TOKEN="your-jwt-token"

# Request presigned upload URL
curl -X POST http://localhost:3000/files/presigned-upload \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fileName": "test.jpg", "fileType": "image/jpeg"}'

# Check the returned uploadUrl uses localhost:9000
```

### 3. Test Frontend Upload
1. Open your frontend application
2. Try uploading a file with the presigned upload component
3. Check browser dev tools for network requests
4. Verify the S3 PUT request goes to `localhost:9000`

## 📝 Additional Notes

- This fix is specifically for local development with Docker
- In production, you'd configure proper DNS/load balancers
- The fix maintains backward compatibility with existing upload methods
- All presigned URLs now work consistently across the application

## ✅ Expected Behavior

After the fix:
1. Backend generates presigned URLs with `localhost:9000`
2. Frontend can successfully make requests to S3
3. Files upload directly to S3 without server involvement
4. Downloads work via presigned URLs
