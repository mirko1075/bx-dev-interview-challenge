import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { S3Service } from './s3.service';

describe('S3Service - Presigned URLs', () => {
  let service: S3Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        S3Service,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case 'S3_ENDPOINT':
                  return 'http://localhost:9000';
                case 'S3_ACCESS_KEY_ID':
                  return 'test-access-key';
                case 'S3_SECRET_ACCESS_KEY':
                  return 'test-secret-key';
                case 'S3_BUCKET_NAME':
                  return 'test-bucket';
                case 'AWS_REGION':
                  return 'us-east-1';
                default:
                  return undefined;
              }
            }),
          },
        },
      ],
    }).compile();

    service = module.get<S3Service>(S3Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generatePresignedUploadUrl', () => {
    it('should generate a presigned upload URL', async () => {
      const fileName = 'test-file.jpg';
      const fileType = 'image/jpeg';
      const userId = 'user-123';

      const result = await service.generatePresignedUploadUrl(
        fileName,
        fileType,
        userId,
      );

      expect(result).toBeDefined();
      expect(result.uploadUrl).toBeDefined();
      expect(result.key).toBeDefined();
      expect(result.key).toContain(`uploads/${userId}/`);
      expect(result.key).toContain(fileName);
      expect(typeof result.uploadUrl).toBe('string');
    });

    it('should generate different keys for same filename', async () => {
      const fileName = 'test-file.jpg';
      const fileType = 'image/jpeg';
      const userId = 'user-123';

      const result1 = await service.generatePresignedUploadUrl(
        fileName,
        fileType,
        userId,
      );
      const result2 = await service.generatePresignedUploadUrl(
        fileName,
        fileType,
        userId,
      );

      expect(result1.key).not.toBe(result2.key);
    });
  });

  describe('generatePresignedDownloadUrl', () => {
    it('should generate a presigned download URL', async () => {
      const key = 'uploads/user-123/test-file.jpg';

      const result = await service.generatePresignedDownloadUrl(key);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain(key);
    });

    it('should respect custom expiry time', async () => {
      const key = 'uploads/user-123/test-file.jpg';
      const customExpiry = 1800; // 30 minutes

      const result = await service.generatePresignedDownloadUrl(
        key,
        customExpiry,
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('extractKeyFromUrl', () => {
    it('should extract key from S3 URL', () => {
      const url = 'https://bucket.s3.amazonaws.com/uploads/user-123/file.jpg';
      const key = service.extractKeyFromUrl(url);

      expect(key).toBe('uploads/user-123/file.jpg');
    });

    it('should handle URLs with query parameters', () => {
      const url =
        'https://bucket.s3.amazonaws.com/uploads/user-123/file.jpg?param=value';
      const key = service.extractKeyFromUrl(url);

      expect(key).toBe('uploads/user-123/file.jpg');
    });
  });
});
