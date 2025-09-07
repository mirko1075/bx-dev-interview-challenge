import { api, uploadWithProgress } from './api.service';
import { 
  GetPresignedUrlPayload, 
  IFile, 
  PresignedUrlResponse,
  PresignedUploadUrlResponse,
  CompletePresignedUploadPayload,
  PresignedDownloadUrlResponse
} from '@/types';

type ProgressCallback = (progress: number) => void;

export interface FileValidationConfig {
  maxSizeBytes: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  maxFilenameLength: number;
}

export const getValidationConfig = async (): Promise<FileValidationConfig> => {
  return api.get<FileValidationConfig>('/files/validation-config');
};

export const getPresignedUploadUrl = async (
  payload: GetPresignedUrlPayload,
): Promise<PresignedUrlResponse> => {
  return api.post<PresignedUrlResponse>('/files/presigned-url', payload);
};

export { uploadWithProgress };

export const getFiles = async (): Promise<IFile[]> => {
  const response = await api.get<{ success: boolean; files: IFile[] }>('/files');
  return response.files;
}

export const getDownloadUrl = async (fileId: string): Promise<{ downloadUrl: string; filename: string }> => {
  // Instead of getting a presigned URL, return the direct download endpoint
  return { 
    downloadUrl: `/api/files/${fileId}/download`, 
    filename: `file-${fileId}` // We'll get the real filename from the response headers
  };
}

export const uploadFileToS3 = uploadWithProgress;

export const uploadFileToBackend = (formData: FormData, onProgress: ProgressCallback): Promise<unknown> => {
  return new Promise((resolve, reject) => {
    console.log('🔍 BACKEND UPLOAD - Starting upload');
    
    const xhr = new XMLHttpRequest();
    const token = localStorage.getItem('token');

    xhr.open('POST', '/api/files/upload');
    
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded * 100) / event.total);
        onProgress(percentComplete);
        console.log(`📊 Upload progress: ${percentComplete}%`);
      }
    };

    xhr.onload = () => {
      console.log('✅ XHR onload triggered');
      console.log('📋 Response status:', xhr.status);
      console.log('📋 Response body:', xhr.responseText);
      
      if (xhr.status >= 200 && xhr.status < 300) {
        console.log('✅ Upload successful!');
        resolve(JSON.parse(xhr.responseText));
      } else {
        console.log('❌ Upload failed with status:', xhr.status);
        reject(new Error(`Upload failed with status: ${xhr.status} ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => {
      console.log('❌ XHR error occurred');
      reject(new Error('An error occurred during the upload.'));
    };

    console.log('📤 Sending form data...');
    xhr.send(formData);
  });
};

// New presigned URL functions
export const getPresignedUploadUrlNew = async (
  payload: GetPresignedUrlPayload,
): Promise<PresignedUploadUrlResponse> => {
  return api.post<PresignedUploadUrlResponse>('/files/presigned-upload-url', payload);
};

export const uploadFileToPresignedUrl = async (
  file: File,
  uploadUrl: string,
  onProgress?: ProgressCallback,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded * 100) / event.total);
          onProgress(percentComplete);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status: ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Upload failed'));
    };

    xhr.send(file);
  });
};

export const completePresignedUpload = async (
  payload: CompletePresignedUploadPayload,
): Promise<{ success: boolean; file: IFile; message: string }> => {
  return api.post<{ success: boolean; file: IFile; message: string }>(
    '/files/presigned-upload-complete',
    payload,
  );
};

export const getPresignedDownloadUrl = async (
  fileId: string,
): Promise<PresignedDownloadUrlResponse> => {
  return api.get<PresignedDownloadUrlResponse>(`/files/${fileId}/presigned-download-url`);
};

// Combined presigned upload flow
export const uploadFileViaPresignedUrl = async (
  file: File,
  onProgress?: ProgressCallback,
): Promise<{ success: boolean; file: IFile; message: string }> => {
  // Step 1: Get presigned upload URL
  const presignedResponse = await getPresignedUploadUrlNew({
    filename: file.name,
    fileType: file.type,
  });

  // Step 2: Upload file to S3 using presigned URL
  await uploadFileToPresignedUrl(file, presignedResponse.uploadUrl, onProgress);

  // Step 3: Complete the upload by saving metadata
  const completeResponse = await completePresignedUpload({
    s3Key: presignedResponse.s3Key,
    filename: file.name,
    fileType: file.type,
    fileSize: file.size,
  });

  return completeResponse;
};
