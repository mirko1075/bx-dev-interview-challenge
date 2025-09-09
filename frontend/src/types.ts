interface IFile {
  id: string;
  filename: string;
  mimetype: string;
  size: number;
  s3Key: string;
  createdAt: string;
}

interface GetPresignedUrlPayload {
  fileName: string;
  fileType: string;
  expiresIn?: number;
}

interface PresignedUrlResponse {
  uploadUrl: string;
  key: string;
}


 export interface LoginCredentials {
  email: string;
  password?: string;
}

 export interface AuthResponse {
  accessToken: string;
}

 export interface User {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export type { IFile, GetPresignedUrlPayload, PresignedUrlResponse };
