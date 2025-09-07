import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3 } from 'aws-sdk';
import { v4 as uuid } from 'uuid';

interface PresignedUrlResponse {
  uploadUrl: string;
  key: string;
}

@Injectable()
export class S3Service {
  private readonly s3: S3;
  private readonly bucket: string;
  private readonly logger = new Logger(S3Service.name);

  constructor(private readonly configService: ConfigService) {
    this.s3 = new S3({
      endpoint: configService.get<string>('S3_ENDPOINT'),
      accessKeyId: configService.get<string>('S3_ACCESS_KEY_ID'),
      secretAccessKey: configService.get<string>('S3_SECRET_ACCESS_KEY'),
      s3ForcePathStyle: true,
      signatureVersion: 'v4',
    });
    this.bucket = configService.get<string>('S3_BUCKET_NAME') || 'my-bucket';
  }

  async configureCors() {
    const corsParams: S3.Types.PutBucketCorsRequest = {
      Bucket: this.bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ['*'],
            AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE'],
            AllowedOrigins: ['http://localhost:3001', 'http://localhost:8080'],
            ExposeHeaders: ['ETag'],
            MaxAgeSeconds: 3000,
          },
        ],
      },
    };

    try {
      await this.s3.putBucketCors(corsParams).promise();
      this.logger.log(
        `Successfully configured CORS for bucket: ${this.bucket}`,
      );
    } catch (error: any) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'NoSuchBucket'
      ) {
        this.logger.warn(
          `Bucket ${this.bucket} does not exist yet. It will be created on first upload. CORS will be set then.`,
        );
      } else {
        this.logger.error('Error setting CORS configuration', error);
      }
    }
  }

  async getPresignedUploadUrl(
    filename: string,
    fileType: string,
  ): Promise<PresignedUrlResponse> {
    const s3Key = `${uuid()}-${filename}`;
    const params = {
      Bucket: this.bucket,
      Key: s3Key,
      ContentType: fileType,
      Expires: 60 * 5,
    };
    let uploadUrl = await this.s3.getSignedUrlPromise('putObject', params);
    uploadUrl = uploadUrl.replace('storage.local', 'localhost');
    return { uploadUrl, key: s3Key };
  }

  async getPresignedDownloadUrl(key: string): Promise<string> {
    const params = {
      Bucket: this.bucket,
      Key: key,
      Expires: 60 * 5,
    };
    let downloadUrl = await this.s3.getSignedUrlPromise('getObject', params);
    downloadUrl = downloadUrl.replace('storage.local', 'localhost');
    return downloadUrl;
  }
}
