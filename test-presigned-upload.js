// Simple test script to test presigned URL upload
const presignedUrl = 'http://localhost:9000/bonusx-bucket/uploads/undefined/175907bb-602a-4cf3-b058-6c09cb311941-flat-design-fist-free-palestine-260nw-2375732621.webp?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20250909%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20250909T212938Z&X-Amz-Expires=3600&X-Amz-Signature=f3797f8029f42212ac065f1bac969d5071381c77bd4b226638bebba5a9c9f655&X-Amz-SignedHeaders=host&x-amz-checksum-crc32=AAAAAA%3D%3D&x-amz-meta-originalname=flat-design-fist-free-palestine-260nw-2375732621.webp&x-amz-sdk-checksum-algorithm=CRC32&x-id=PutObject';

// Create a simple test file
const testContent = 'Hello, this is a test file!';
const blob = new Blob([testContent], { type: 'text/plain' });

console.log('Testing presigned URL upload...');
console.log('URL:', presignedUrl);

fetch(presignedUrl, {
  method: 'PUT',
  body: blob,
  headers: {
    'Content-Type': 'text/plain',
  }
})
.then(response => {
  console.log('Response status:', response.status);
  console.log('Response headers:', [...response.headers.entries()]);
  return response.text();
})
.then(text => {
  console.log('Response body:', text);
})
.catch(error => {
  console.error('Error:', error);
});
