import { api, uploadWithProgress } from './api.service';
import { GetPresignedUrlPayload, IFile, PresignedUrlResponse } from '@/types';


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
