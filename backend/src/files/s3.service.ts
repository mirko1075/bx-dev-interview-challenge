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
    this.bucket =
      configService.get<string>('S3_BUCKET_NAME') || 'my-app-bucket';
  }

  // NUOVO METODO: Configura il CORS sul bucket all'avvio
  async configureCors() {
    const corsParams: S3.Types.PutBucketCorsRequest = {
      Bucket: this.bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ['*'],
            AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE'],
            // Permetti le richieste sia dal dev server (3001) che da un eventuale container frontend (8080)
            AllowedOrigins: ['http://localhost:3001', 'http://localhost:8080'],
            ExposeHeaders: ['ETag'], // Permette al browser di leggere l'header ETag dopo l'upload
            MaxAgeSeconds: 3000,
          },
        ],
      },
    };

    try {
      // Tenta di creare il bucket. Se esiste già, non fa nulla.
      await this.s3.createBucket({ Bucket: this.bucket }).promise();
      this.logger.log(`Bucket ${this.bucket} created or already exists.`);

      // Imposta la policy CORS
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
        // Se il bucket esiste già, proviamo comunque a impostare il CORS
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

  async getPresignedUploadUrl(filename: string): Promise<PresignedUrlResponse> {
    const s3Key = `${uuid()}-${filename}`;
    const params = {
      Bucket: this.bucket,
      Key: s3Key,
      Expires: 60 * 5,
    };
    let uploadUrl = await this.s3.getSignedUrlPromise('putObject', params);
    uploadUrl = uploadUrl.replace('storage.local', 'localhost');
    return { uploadUrl, key: s3Key };
  }

  // Metodo alternativo che non usa Content-Type nella firma (per S3 Ninja)
  async getPresignedUploadUrlAlternative(
    filename: string,
  ): Promise<PresignedUrlResponse> {
    const s3Key = `${uuid()}-${filename}`;

    // Configurazione S3 specifica per S3 Ninja senza Content-Type
    const s3ForNinja = new S3({
      endpoint: this.configService.get<string>('S3_ENDPOINT'),
      accessKeyId: this.configService.get<string>('S3_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get<string>('S3_SECRET_ACCESS_KEY'),
      s3ForcePathStyle: true,
      signatureVersion: 'v4',
      region: 'us-east-1', // Regione esplicita per S3 Ninja
    });

    const params = {
      Bucket: this.bucket,
      Key: s3Key,
      Expires: 60 * 5,
      // NON includiamo ContentType nella firma per S3 Ninja
    };

    try {
      let uploadUrl = await s3ForNinja.getSignedUrlPromise('putObject', params);
      uploadUrl = uploadUrl.replace('storage.local', 'localhost');

      this.logger.debug(
        `Generated alternative presigned URL for ${filename}:`,
        {
          key: s3Key,
          urlLength: uploadUrl.length,
        },
      );

      return { uploadUrl, key: s3Key };
    } catch (error) {
      this.logger.error('Error generating alternative presigned URL:', error);
      throw error;
    }
  }

  // Metodo per testare la connessione S3
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
