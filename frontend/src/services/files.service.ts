import { api, uploadWithProgress } from './api.service';
import { GetPresignedUrlPayload, IFile, PresignedUrlResponse } from '@/types';

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
  return api.post<PresignedUrlResponse>('/files/presigned-upload', payload);
};

// Get presigned download URL from backend
export const getPresignedDownloadUrl = async (
  key: string,
  expiresIn?: number,
): Promise<{ downloadUrl: string; key: string }> => {
  return api.post<{ downloadUrl: string; key: string }>('/files/presigned-download', {
    key,
    expiresIn,
  });
};

// Upload file directly to S3 using presigned URL
export const uploadFileWithPresignedUrl = async (
  presignedUrl: string,
  file: File,
  onProgress?: (progress: number) => void,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percentComplete = Math.round((event.loaded * 100) / event.total);
        onProgress(percentComplete);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`S3 upload failed with status: ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during S3 upload'));
    };

    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
};

export { uploadWithProgress };

export const getFiles = async (): Promise<IFile[]> => {
  const response = await api.get<{ success: boolean; files: IFile[] }>('/files');
  return response.files;
}

export const getDownloadUrl = async (fileId: string): Promise<{ downloadUrl: string; filename: string }> => {
  return { 
    downloadUrl: `/api/files/${fileId}/download`, 
    filename: `file-${fileId}`
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
