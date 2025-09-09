# S3 Presigned URLs Implementation

This implementation provides secure file upload and download capabilities using S3 presigned URLs.

## Features

- **Presigned Upload URLs**: Generate temporary URLs for direct client-to-S3 uploads
- **Presigned Download URLs**: Generate temporary URLs for secure file downloads
- **File Management**: Delete files and manage metadata
- **User-based Security**: All operations are scoped to authenticated users

## API Endpoints

### Generate Presigned Upload URL
```
POST /files/presigned-upload
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "fileName": "example.jpg",
  "fileType": "image/jpeg",
  "expiresIn": 3600  // Optional, defaults to 1 hour
}
```

**Response:**
```json
{
  "uploadUrl": "https://s3.amazonaws.com/bucket/uploads/user-123/uuid-example.jpg?...",
  "key": "uploads/user-123/uuid-example.jpg"
}
```

### Generate Presigned Download URL
```
POST /files/presigned-download
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "key": "uploads/user-123/uuid-example.jpg",
  "expiresIn": 3600  // Optional, defaults to 1 hour
}
```

**Response:**
```json
{
  "downloadUrl": "https://s3.amazonaws.com/bucket/uploads/user-123/uuid-example.jpg?...",
  "key": "uploads/user-123/uuid-example.jpg"
}
```

### Get Download URL for File
```
GET /files/:id/download
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "downloadUrl": "https://s3.amazonaws.com/bucket/uploads/user-123/uuid-example.jpg?...",
  "filename": "example.jpg",
  "mimetype": "image/jpeg",
  "size": 1024
}
```

### Delete File
```
POST /files/delete/:key
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

## Usage Example

### Frontend Upload Flow

1. **Get Upload URL**:
```javascript
const response = await fetch('/api/files/presigned-upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    fileName: file.name,
    fileType: file.type
  })
});

const { uploadUrl, key } = await response.json();
```

2. **Upload File Directly to S3**:
```javascript
await fetch(uploadUrl, {
  method: 'PUT',
  headers: {
    'Content-Type': file.type
  },
  body: file
});
```

3. **Save File Metadata** (if needed):
```javascript
// The key can be used to track the file in your application
console.log('File uploaded with key:', key);
```

### Frontend Download Flow

1. **Get Download URL**:
```javascript
const response = await fetch(`/api/files/${fileId}/download`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { downloadUrl, filename } = await response.json();
```

2. **Download File**:
```javascript
// Option 1: Direct download
window.open(downloadUrl, '_blank');

// Option 2: Fetch and process
const fileResponse = await fetch(downloadUrl);
const blob = await fileResponse.blob();
// Process blob as needed
```

## Configuration

Required environment variables:

```env
S3_ENDPOINT=http://localhost:9000  # For local S3ninja or MinIO
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET_NAME=your-bucket-name
AWS_REGION=us-east-1
```

## Security Features

- **User Isolation**: Files are organized by user ID (`uploads/{userId}/...`)
- **Temporary URLs**: All presigned URLs have configurable expiration times
- **Authentication Required**: All endpoints require valid JWT tokens
- **File Ownership**: Users can only access their own files
- **Unique Keys**: UUID prefixes prevent filename collisions

## Benefits

1. **Reduced Server Load**: Files upload directly to S3, bypassing your server
2. **Better Performance**: No server bandwidth used for file transfers
3. **Scalability**: S3 handles the file storage and delivery
4. **Security**: Temporary URLs with expiration times
5. **Cost Effective**: Pay only for S3 storage and bandwidth

## Error Handling

The API includes comprehensive error handling:

- Invalid file types or sizes
- Missing authentication
- File not found errors
- S3 service errors
- Expired presigned URLs

All errors return appropriate HTTP status codes and descriptive messages.
