import { IsNotEmpty, IsString, IsNumber } from 'class-validator';

export class GetPresignedUploadUrlDto {
  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsString()
  @IsNotEmpty()
  fileType: string;
}

export class CompletePresignedUploadDto {
  @IsString()
  @IsNotEmpty()
  s3Key: string;

  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsString()
  @IsNotEmpty()
  fileType: string;

  @IsNumber()
  fileSize: number;
}

export class PresignedUploadUrlResponse {
  success: boolean;
  uploadUrl: string;
  s3Key: string;
  filename: string;
  fileType: string;
  userId: string;
  message: string;
}

export class PresignedDownloadUrlResponse {
  success: boolean;
  downloadUrl: string;
  filename: string;
  mimetype: string;
  message: string;
}
