import { FilesService } from '@/services/files/files.service';
import { S3Service } from '@/services/files/s3.service';
import { DebugController } from './debug.controller';

jest.mock('../services/files/s3.service');
jest.mock('../services/files/files.service');

const mockS3Service = {
  testConnection: jest.fn(),
  getPresignedUploadUrl: jest.fn(),
};

const mockFilesService = {};

describe('DebugController', () => {
  let controller: DebugController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new DebugController(
      mockS3Service as unknown as S3Service,
      mockFilesService as unknown as FilesService,
    );
  });

  describe('testS3Connection', () => {
    it('should return success when S3 connection works', async () => {
      mockS3Service.testConnection.mockResolvedValue(true);
      const result = await controller.testS3Connection();
      expect(result.success).toBe(true);
      expect(result.message).toBe('S3 connection successful');
      expect(typeof result.timestamp).toBe('string');
    });

    it('should return failure when S3 connection fails', async () => {
      mockS3Service.testConnection.mockResolvedValue(false);
      const result = await controller.testS3Connection();
      expect(result.success).toBe(false);
      expect(result.message).toBe('S3 connection failed');
    });

    it('should handle errors thrown by S3 connection', async () => {
      mockS3Service.testConnection.mockRejectedValue(new Error('fail'));
      const result = await controller.testS3Connection();
      expect(result.success).toBe(false);
      expect(result.message).toContain('S3 connection error: fail');
    });
  });

  describe('testPresignedUrl', () => {
    const body = { filename: 'file.txt', fileType: 'text/plain' };

    it('should return success and url info when presigned url is generated', async () => {
      mockS3Service.getPresignedUploadUrl.mockResolvedValue({
        uploadUrl: 'http://localhost:9000/file.txt?Signature=abc&Expires=1234',
        key: 'file.txt',
      });
      const result = await controller.testPresignedUrl(body);
      expect(result.success).toBe(true);
      expect(result.primary?.url).toContain(
        'http://localhost:9000/file.txt?Signature=abc&Expires=1234'.substring(
          0,
          100,
        ),
      );
      expect(result.primary?.key).toBe('file.txt');
      expect(result.primary?.containsSignature).toBe(true);
      expect(result.primary?.containsExpires).toBe(true);
      expect(Array.isArray(result.advice)).toBe(true);
    });

    it('should return failure and advice when presigned url generation fails', async () => {
      mockS3Service.getPresignedUploadUrl.mockRejectedValue(
        new Error('presign fail'),
      );
      const result = await controller.testPresignedUrl(body);
      expect(result.success).toBe(false);
      expect(result.primary?.error).toBe('presign fail');
      expect(Array.isArray(result.advice)).toBe(true);
    });

    it('should handle thrown errors in the outer try/catch', async () => {
      // Simulate an error in the method itself
      mockS3Service.getPresignedUploadUrl.mockImplementation(() => {
        throw new Error('outer fail');
      });
      const result = await controller.testPresignedUrl(body);
      expect(result.success).toBe(false);
      expect(result.primary?.error).toBe('outer fail');
      expect(Array.isArray(result.advice)).toBe(true);
    });
  });

  describe('checkEnvironment', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...OLD_ENV };
    });

    afterAll(() => {
      process.env = OLD_ENV;
    });

    it('should return success when all env vars are set', () => {
      process.env.S3_ENDPOINT = 'endpoint';
      process.env.S3_ACCESS_KEY_ID = 'key';
      process.env.S3_SECRET_ACCESS_KEY = 'secret';
      process.env.S3_BUCKET_NAME = 'bucket';
      const result = controller.checkEnvironment();
      expect(result.success).toBe(true);
      expect(result.missing).toHaveLength(0);
      expect(result.recommendations).toHaveLength(0);
    });

    it('should return failure and missing vars when some env vars are missing', () => {
      delete process.env.S3_ENDPOINT;
      delete process.env.S3_ACCESS_KEY_ID;
      process.env.S3_SECRET_ACCESS_KEY = 'secret';
      process.env.S3_BUCKET_NAME = 'bucket';
      const result = controller.checkEnvironment();
      expect(result.success).toBe(false);
      expect(result.missing).toContain('S3_ENDPOINT');
      expect(result.missing).toContain('S3_ACCESS_KEY_ID');
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should mask secret env values', () => {
      process.env.S3_SECRET_ACCESS_KEY = 'supersecret';
      process.env.S3_ENDPOINT = 'endpoint';
      process.env.S3_ACCESS_KEY_ID = 'key';
      process.env.S3_BUCKET_NAME = 'bucket';
      const result = controller.checkEnvironment();
      const secret = result.environment.find(
        (e: { name: string; value?: string }) =>
          e.name === 'S3_SECRET_ACCESS_KEY',
      );
      expect(secret?.value).toBe('***');
    });
  });

  describe('validateUploadFlow', () => {
    const body = { filename: 'file.txt', fileType: 'text/plain', size: 123 };

    beforeEach(() => {
      process.env.S3_ENDPOINT = 'endpoint';
      process.env.S3_ACCESS_KEY_ID = 'key';
      process.env.S3_SECRET_ACCESS_KEY = 'secret';
      process.env.S3_BUCKET_NAME = 'bucket';
    });

    it('should return overallSuccess true when all steps succeed', async () => {
      mockS3Service.testConnection.mockResolvedValue(true);
      mockS3Service.getPresignedUploadUrl.mockResolvedValue({
        uploadUrl: 'http://localhost:9000/file.txt?Signature=abc&Expires=1234',
        key: 'file.txt',
      });
      const result = await controller.validateUploadFlow(body);
      const resultToTest = result.recommendations?.[0];
      expect(result.overallSuccess).toBe(true);
      expect(Array.isArray(result.validationResults)).toBe(true);
      expect(resultToTest).toContain('All tests passed');
    });

    it('should return overallSuccess false if env check fails', async () => {
      delete process.env.S3_ENDPOINT;
      mockS3Service.testConnection.mockResolvedValue(true);
      mockS3Service.getPresignedUploadUrl.mockResolvedValue({
        uploadUrl: 'http://localhost:9000/file.txt?Signature=abc&Expires=1234',
        key: 'file.txt',
      });
      const result = await controller.validateUploadFlow(body);
      expect(result.overallSuccess).toBe(false);
      expect(
        result.recommendations?.some((r: string) =>
          r.includes('Set missing environment variables in .env file'),
        ),
      ).toBe(true);
    });

    it('should return overallSuccess false if S3 connection fails', async () => {
      mockS3Service.testConnection.mockResolvedValue(false);
      mockS3Service.getPresignedUploadUrl.mockResolvedValue({
        uploadUrl: 'http://localhost:9000/file.txt?Signature=abc&Expires=1234',
        key: 'file.txt',
      });
      const result = await controller.validateUploadFlow(body);
      expect(result.overallSuccess).toBe(false);
      expect(
        result.recommendations?.some((r: string) => r.includes('S3 Ninja')),
      ).toBe(true);
    });

    it('should return overallSuccess false if presigned url fails', async () => {
      mockS3Service.testConnection.mockResolvedValue(true);
      mockS3Service.getPresignedUploadUrl.mockRejectedValue(
        new Error('presign fail'),
      );
      const result = await controller.validateUploadFlow(body);
      expect(result.overallSuccess).toBe(false);
      expect(
        result.recommendations?.some((r: string) => r.includes('AWS SDK')),
      ).toBe(true);
    });

    it('should handle errors thrown in the method', async () => {
      mockS3Service.testConnection.mockImplementation(() => {
        throw new Error('fail');
      });
      const result = await controller.validateUploadFlow(body);
      expect(result.overallSuccess).toBe(false);
      expect(Array.isArray(result.validationResults)).toBe(true);
    });
  });

  describe('generateAdvice (private)', () => {
    it('should give correct advice for missing signature and expires', () => {
      const advice = controller['generateAdvice']('http://localhost/file.txt');
      expect(advice).toContain(
        'URL missing signature - check AWS SDK configuration',
      );
      expect(advice).toContain(
        'URL missing expiration - check getSignedUrl parameters',
      );
    });

    it('should warn about storage.local', () => {
      const advice = controller['generateAdvice'](
        'http://storage.local/file.txt?Signature=abc&Expires=1234',
      );
      expect(advice).toContain(
        'WARNING: URL contains storage.local - should be replaced with localhost',
      );
    });

    it('should say structure looks correct if all is good', () => {
      const advice = controller['generateAdvice'](
        'http://localhost/file.txt?Signature=abc&Expires=1234',
      );
      expect(advice).toContain('URL structure looks correct');
    });
  });

  describe('analyzePresignedUrl (private)', () => {
    it('should parse valid presigned url', () => {
      const result = controller['analyzePresignedUrl'](
        'http://localhost/file.txt?Signature=abc&Expires=1234',
      );
      expect(result.isValid).toBe(true);
      expect(result.hasSignature).toBe(true);
      expect(result.hasExpires).toBe(true);
      expect(result.protocol).toBe('http:');
      expect(result.hostname).toBe('localhost');
    });

    it('should handle invalid url', () => {
      const result = controller['analyzePresignedUrl']('not-a-url');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid URL format');
    });
  });

  describe('generateRecommendations (private)', () => {
    it('should recommend all good if no failures', () => {
      const recs = controller['generateRecommendations']([
        { test: 'A', success: true, details: {} },
      ]);
      expect(recs[0]).toContain('All tests passed');
    });

    it('should recommend fixes for failed tests', () => {
      const recs = controller['generateRecommendations']([
        { test: 'Environment Variables', success: false, details: {} },
        { test: 'S3 Connection', success: false, details: {} },
        { test: 'Presigned URL Generation', success: false, details: {} },
        { test: 'URL Structure Analysis', success: false, details: {} },
      ]);
      expect(recs.some((r: string) => r.includes('S3 Ninja'))).toBe(true);
      expect(recs.some((r: string) => r.includes('AWS SDK'))).toBe(true);
      expect(recs.some((r: string) => r.includes('structural issues'))).toBe(
        true,
      );
    });
  });
});
