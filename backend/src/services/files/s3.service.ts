import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuid } from 'uuid';

interface PresignedUrlResponse {
  uploadUrl: string;
  key: string;
}

@Injectable()
export class S3Service {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly logger = new Logger(S3Service.name);

  constructor(private readonly configService: ConfigService) {
    const endpoint = configService.get<string>('S3_ENDPOINT');
    const accessKeyId = configService.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = configService.get<string>('S3_SECRET_ACCESS_KEY');

    this.logger.log(
      `S3 Configuration: endpoint=${endpoint}, keyId=${accessKeyId ? 'SET' : 'NOT_SET'}`,
    );

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('S3 credentials are required');
    }

    this.bucketName =
      configService.get<string>('S3_BUCKET_NAME') || 'my-app-bucket';

    this.s3Client = new S3Client({
      region: configService.get<string>('AWS_REGION', 'us-east-1'),
      endpoint: endpoint,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
      forcePathStyle: true,
    });
  }

  // Helper method to replace hostname for frontend access
  private replaceHostnameForFrontend(url: string): string {
    // Replace internal Docker hostname with localhost for frontend access
    let modifiedUrl = url.replace('storage.local', 'localhost');

    // Also handle case where the URL might have the IP or other hostnames
    modifiedUrl = modifiedUrl.replace('s3ninja', 'localhost');

    this.logger.debug(`URL hostname replacement: ${url} -> ${modifiedUrl}`);
    return modifiedUrl;
  }

  async generatePresignedUploadUrl(
    fileName: string,
    fileType: string,
    userId: string,
    expiresIn: number = 3600, // 1 hour default
  ): Promise<{ uploadUrl: string; key: string }> {
    // Use simpler key format for S3ninja compatibility
    const key = `${uuid()}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: fileType,
    });

    try {
      let uploadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      // Replace hostname for local development if needed
      uploadUrl = this.replaceHostnameForFrontend(uploadUrl);

      return {
        uploadUrl,
        key,
      };
    } catch (error) {
      this.logger.error('Error generating presigned upload URL:', error);
      throw new Error('Failed to generate upload URL');
    }
  }

  async generatePresignedDownloadUrl(
    key: string,
    expiresIn: number = 3600, // 1 hour default
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    try {
      let downloadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      // Replace hostname for local development if needed
      downloadUrl = this.replaceHostnameForFrontend(downloadUrl);

      return downloadUrl;
    } catch (error) {
      this.logger.error('Error generating presigned download URL:', error);
      throw new Error('Failed to generate download URL');
    }
  }

  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    try {
      await this.s3Client.send(command);
    } catch (error) {
      this.logger.error('Error deleting file:', error);
      throw new Error('Failed to delete file');
    }
  }

  // Helper method to extract key from full S3 URL if needed
  extractKeyFromUrl(url: string): string {
    const urlObj = new URL(url);
    return urlObj.pathname.substring(1); // Remove leading slash
  }

  // Legacy methods for backwards compatibility
  async getPresignedUploadUrl(
    filename: string,
    contentType?: string,
  ): Promise<PresignedUrlResponse> {
    const s3Key = `${uuid()}-${filename}`;

    const finalContentType = contentType || 'application/octet-stream';

    this.logger.log(
      `Generating presigned URL for ${filename}, contentType: ${finalContentType}`,
    );

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      ContentType: finalContentType,
    });

    try {
      let uploadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: 300, // 5 minutes
      });

      uploadUrl = this.replaceHostnameForFrontend(uploadUrl);

      this.logger.log(
        `Generated URL (first 100 chars): ${uploadUrl.substring(0, 100)}...`,
      );

      return { uploadUrl, key: s3Key };
    } catch (error) {
      this.logger.error('Error generating presigned upload URL:', error);
      throw new Error('Failed to generate upload URL');
    }
  }

  async uploadFileDirect(
    buffer: Buffer,
    filename: string,
    contentType: string,
  ): Promise<string> {
    const s3Key = `${uuid()}-${filename}`;

    this.logger.log(
      `Uploading file directly: ${filename}, contentType: ${contentType}`,
    );

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      Body: buffer,
      ContentType: contentType,
    });

    try {
      await this.s3Client.send(command);
      this.logger.log(`File uploaded successfully: ${s3Key}`);
      return s3Key;
    } catch (error) {
      this.logger.error('Error uploading file:', error);
      throw new Error('Failed to upload file');
    }
  }

  async getFileStream(s3Key: string) {
    this.logger.log(`Getting file stream for key: ${s3Key}`);

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
    });

    try {
      const response = await this.s3Client.send(command);

      if (!response.Body) {
        throw new Error('No file content received');
      }

      return response.Body;
    } catch (error) {
      this.logger.error('Error getting file stream:', error);
      throw new Error('Failed to get file stream');
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      // Simple test to check if we can access the S3 service
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: 'test-connection',
      });

      try {
        await this.s3Client.send(command);
      } catch (error) {
        // If it's a "NoSuchKey" error, the connection is working
        if (
          error &&
          typeof error === 'object' &&
          'name' in error &&
          error.name === 'NoSuchKey'
        ) {
          return true;
        }
        throw error;
      }
      return true;
    } catch (error) {
      this.logger.error('S3 connection test failed:', error);
      return false;
    }
  }
}
