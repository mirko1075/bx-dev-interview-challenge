import { api, uploadWithProgress } from './api.service';
import { GetPresignedUrlPayload, IFile, PresignedUrlResponse } from '@/types';

type ProgressCallback = (progress: number) => void;

export const getPresignedUploadUrl = async (
  payload: GetPresignedUrlPayload,
): Promise<PresignedUrlResponse> => {
  return api.post<PresignedUrlResponse>('/files/presigned-url', payload);
};

export { uploadWithProgress };

export const getFiles = async (): Promise<IFile[]> => {
  return api.get<IFile[]>('/files');
}

export const getDownloadUrl = async (fileId: string): Promise<{ downloadUrl: string }> => {
  return api.get<{ downloadUrl: string }>(`/files/${fileId}/download`);
}

export const uploadFileToS3 = uploadWithProgress;

export const uploadFileToBackend = (formData: FormData, onProgress: ProgressCallback): Promise<any> => {
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
