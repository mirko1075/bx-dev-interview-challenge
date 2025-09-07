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

export type { IFile, GetPresignedUrlPayload, PresignedUrlResponse, LoginCredentials, AuthResponse, User };
