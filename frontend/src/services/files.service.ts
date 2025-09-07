import api from './api.service';
import axios from 'axios'; 

interface GetPresignedUrlPayload {
  filename: string;
  fileType: string;
}

interface PresignedUrlResponse {
  uploadUrl: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  file: any; //TODO define type
}

export const getPresignedUploadUrl = async (
  payload: GetPresignedUrlPayload,
): Promise<PresignedUrlResponse> => {
  const response = await api.post<PresignedUrlResponse>(
    '/files/presigned-url',
    payload,
  );
  return response.data;
};

export const uploadFileToS3 = async (uploadUrl: string, file: File) => {
  await axios.put(uploadUrl, file, {
    headers: {
      'Content-Type': file.type,
    },
  });
};

