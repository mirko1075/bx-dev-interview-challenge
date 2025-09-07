interface IFile {
  id: string;
  filename: string;
  mimetype: string;
  size: number;
  createdAt: string;
}

interface GetPresignedUrlPayload {
  filename: string;
  fileType: string;
}

interface PresignedUploadUrlResponse {
  success: boolean;
  uploadUrl: string;
  s3Key: string;
  filename: string;
  fileType: string;
  userId: string;
  message: string;
}

interface CompletePresignedUploadPayload {
  s3Key: string;
  filename: string;
  fileType: string;
  fileSize: number;
}

interface PresignedDownloadUrlResponse {
  success: boolean;
  downloadUrl: string;
  filename: string;
  mimetype: string;
  message: string;
}

interface PresignedUrlResponse {
  uploadUrl: string;
  file: IFile;
}


 interface LoginCredentials {
  email: string;
  password?: string;
}

 interface AuthResponse {
  accessToken: string;
}

 interface User {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export type { 
  IFile, 
  GetPresignedUrlPayload, 
  PresignedUrlResponse, 
  PresignedUploadUrlResponse,
  CompletePresignedUploadPayload,
  PresignedDownloadUrlResponse,
  LoginCredentials, 
  AuthResponse, 
  User 
};
