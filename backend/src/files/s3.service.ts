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
    const endpoint = configService.get<string>('S3_ENDPOINT');
    const accessKeyId = configService.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = configService.get<string>('S3_SECRET_ACCESS_KEY');

    this.logger.log(
      `S3 Configuration: endpoint=${endpoint}, keyId=${accessKeyId ? 'SET' : 'NOT_SET'}`,
    );

    this.s3 = new S3({
      endpoint: endpoint,
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
      s3ForcePathStyle: true,
      signatureVersion: 'v4',
      region: 'us-east-1',
    });
    this.bucket =
      configService.get<string>('S3_BUCKET_NAME') || 'my-app-bucket';
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
      await this.s3.createBucket({ Bucket: this.bucket }).promise();
      this.logger.log(`Bucket ${this.bucket} created or already exists.`);

      await this.s3.putBucketCors(corsParams).promise();
      this.logger.log(
        `Successfully configured CORS for bucket: ${this.bucket}`,
      );
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'NoSuchBucket'
      ) {
        this.logger.warn(
          `Bucket ${this.bucket} does not exist yet. It will be created on first upload. CORS will be set then.`,
        );
      } else if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code !== 'BucketAlreadyOwnedByYou'
      ) {
        this.logger.error(
          'Error setting CORS configuration',
          (error as { stack?: string }).stack,
        );
      } else {
        try {
          await this.s3.putBucketCors(corsParams).promise();
          this.logger.log(
            `Successfully configured CORS for existing bucket: ${this.bucket}`,
          );
        } catch (corsError) {
          this.logger.error(
            'Error setting CORS configuration on existing bucket',
            typeof corsError === 'object' &&
              corsError !== null &&
              'stack' in corsError
              ? (corsError as { stack?: string }).stack
              : undefined,
          );
        }
      }
    }
  }

  async getPresignedUploadUrl(
    filename: string,
    contentType?: string,
  ): Promise<PresignedUrlResponse> {
    const s3Key = `${uuid()}-${filename}`;

    const finalContentType = contentType || 'application/octet-stream';

    this.logger.log(
      `Generating presigned URL for ${filename}, contentType: ${finalContentType}`,
    );

    const params = {
      Bucket: this.bucket,
      Key: s3Key,
      Expires: 60 * 5,
      ContentType: finalContentType,
    };

    let uploadUrl = await this.s3.getSignedUrlPromise('putObject', params);
    uploadUrl = uploadUrl.replace('storage.local', 'localhost');

    this.logger.log(
      `Generated URL (first 100 chars): ${uploadUrl.substring(0, 100)}...`,
    );

    return { uploadUrl, key: s3Key };
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

    await this.s3
      .putObject({
        Bucket: this.bucket,
        Key: s3Key,
        Body: buffer,
        ContentType: contentType,
      })
      .promise();

    this.logger.log(`File uploaded successfully: ${s3Key}`);
    return s3Key;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.s3.listBuckets().promise();
      return true;
    } catch (error) {
      this.logger.error('S3 connection test failed:', error);
      return false;
    }
  }
}
