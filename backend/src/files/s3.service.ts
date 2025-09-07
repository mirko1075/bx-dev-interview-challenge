import { Injectable } from '@nestjs/common';
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

  constructor(private readonly configService: ConfigService) {
    this.s3 = new S3({
      endpoint: configService.get<string>('S3_ENDPOINT'),
      accessKeyId: configService.get<string>('S3_ACCESS_KEY_ID'),
      secretAccessKey: configService.get<string>('S3_SECRET_ACCESS_KEY'),
      s3ForcePathStyle: true,
      signatureVersion: 'v4',
    });
  }

  async getPresignedUploadUrl(
    filename: string,
    fileType: string,
  ): Promise<PresignedUrlResponse> {
    const s3Key = `${uuid()}-${filename}`;
    const bucket = this.configService.get<string>('S3_BUCKET_NAME');

    const params = {
      Bucket: bucket,
      Key: s3Key,
      ContentType: fileType,
      Expires: 60 * 5,
    };

    const uploadUrl = await this.s3.getSignedUrlPromise('putObject', params);
    return { uploadUrl, key: s3Key };
  }
}
