import { ChunkedUploadService } from './chunked-upload.service';
import { CacheService } from './cache.service';
import { BadRequestException, Logger } from '@nestjs/common';
import { User } from '@/entities/user.entity';
import { ConfigService } from 'aws-sdk';

jest.mock('./cache.service');
jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});

const mockUser = { id: 'user1' } as User;
const otherUser = { id: 'user2' } as User;

const mockConfigService: ConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'CHUNKED_UPLOAD_SESSION_TIMEOUT') return 30 * 60 * 1000;
    return null;
  }),
};
describe('ChunkedUploadService', () => {
  let service: ChunkedUploadService;
  let cacheService: CacheService;

  beforeEach(() => {
    cacheService = new CacheService(
      mockConfigService as unknown as ConfigService,
    );
    service = new ChunkedUploadService(cacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('initializeUpload', () => {
    it('should initialize a new upload session and return uploadId and totalChunks', () => {
      const result = service.initializeUpload('file.txt', 1024, 256, mockUser);
      expect(result).toHaveProperty('uploadId');
      expect(result.totalChunks).toBe(4);
      // @ts-expect-error Because uploadSessions is private
      expect(service.uploadSessions.has(result.uploadId)).toBe(true);
    });
  });

  describe('uploadChunk', () => {
    it('should upload a chunk and update progress', () => {
      const { uploadId, totalChunks } = service.initializeUpload(
        'file.txt',
        1024,
        256,
        mockUser,
      );
      const chunk = Buffer.from('a'.repeat(256));
      const res = service.uploadChunk(uploadId, 0, chunk, mockUser);
      expect(res.isComplete).toBe(false);
      expect(res.progress).toBeCloseTo(25);
      // Upload all chunks
      for (let i = 1; i < totalChunks; i++) {
        service.uploadChunk(uploadId, i, chunk, mockUser);
      }
      const finalRes = service.uploadChunk(uploadId, 0, chunk, mockUser); // re-upload chunk 0
      expect(finalRes.isComplete).toBe(true);
    });

    it('should throw if session not found', () => {
      expect(() =>
        service.uploadChunk('invalid', 0, Buffer.from('a'), mockUser),
      ).toThrow(BadRequestException);
    });

    it('should throw if user is not owner', () => {
      const { uploadId } = service.initializeUpload(
        'file.txt',
        100,
        50,
        mockUser,
      );
      expect(() =>
        service.uploadChunk(uploadId, 0, Buffer.from('a'), otherUser),
      ).toThrow(BadRequestException);
    });

    it('should throw if chunk number is invalid', () => {
      const { uploadId } = service.initializeUpload(
        'file.txt',
        100,
        50,
        mockUser,
      );
      expect(() =>
        service.uploadChunk(uploadId, -1, Buffer.from('a'), mockUser),
      ).toThrow(BadRequestException);
      expect(() =>
        service.uploadChunk(uploadId, 2, Buffer.from('a'), mockUser),
      ).toThrow(BadRequestException);
    });
  });

  describe('assembleFile', () => {
    it('should assemble file from all chunks', () => {
      const fileSize = 10;
      const chunkSize = 4;
      const { uploadId, totalChunks } = service.initializeUpload(
        'file.txt',
        fileSize,
        chunkSize,
        mockUser,
      );
      const chunks = [
        Buffer.from('abcd'),
        Buffer.from('efgh'),
        Buffer.from('ij'),
      ];
      for (let i = 0; i < totalChunks; i++) {
        service.uploadChunk(uploadId, i, chunks[i], mockUser);
      }
      const assembled = service.assembleFile(uploadId, mockUser);
      expect(assembled.equals(Buffer.concat(chunks))).toBe(true);
      // Session should be deleted after assembly
      // @ts-expect-error Because uploadSessions is private
      expect(service.uploadSessions.has(uploadId)).toBe(false);
    });

    it('should throw if session not found', () => {
      expect(() => service.assembleFile('invalid', mockUser)).toThrow(
        BadRequestException,
      );
    });

    it('should throw if user is not owner', () => {
      const { uploadId } = service.initializeUpload('file.txt', 8, 4, mockUser);
      expect(() => service.assembleFile(uploadId, otherUser)).toThrow(
        BadRequestException,
      );
    });

    it('should throw if not all chunks uploaded', () => {
      const { uploadId } = service.initializeUpload('file.txt', 8, 4, mockUser);
      service.uploadChunk(uploadId, 0, Buffer.from('abcd'), mockUser);
      expect(() => service.assembleFile(uploadId, mockUser)).toThrow(
        BadRequestException,
      );
    });

    it('should throw if chunk is missing during assembly', () => {
      const { uploadId } = service.initializeUpload('file.txt', 8, 4, mockUser);
      service.uploadChunk(uploadId, 1, Buffer.from('efgh'), mockUser);
      service.uploadChunk(uploadId, 0, Buffer.from('abcd'), mockUser);
      // Remove a chunk manually
      // @ts-expect-error Because uploadSessions is private
      service.uploadSessions.get(uploadId).chunks.delete(1);
      expect(() => service.assembleFile(uploadId, mockUser)).toThrow(
        BadRequestException,
      );
    });

    it('should throw if file size mismatch', () => {
      const { uploadId } = service.initializeUpload('file.txt', 8, 4, mockUser);
      service.uploadChunk(uploadId, 0, Buffer.from('abcd'), mockUser);
      service.uploadChunk(uploadId, 1, Buffer.from('efg'), mockUser); // wrong size
      expect(() => service.assembleFile(uploadId, mockUser)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('getUploadProgress', () => {
    it('should return correct progress', () => {
      const { uploadId } = service.initializeUpload('file.txt', 8, 4, mockUser);
      service.uploadChunk(uploadId, 0, Buffer.from('abcd'), mockUser);
      const progress = service.getUploadProgress(uploadId, mockUser);
      expect(progress.progress).toBeCloseTo(50);
      expect(progress.chunksUploaded).toBe(1);
      expect(progress.totalChunks).toBe(2);
    });

    it('should throw if session not found', () => {
      expect(() => service.getUploadProgress('invalid', mockUser)).toThrow(
        BadRequestException,
      );
    });

    it('should throw if user is not owner', () => {
      const { uploadId } = service.initializeUpload('file.txt', 8, 4, mockUser);
      expect(() => service.getUploadProgress(uploadId, otherUser)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('cancelUpload', () => {
    it('should cancel upload and remove session', () => {
      const { uploadId } = service.initializeUpload('file.txt', 8, 4, mockUser);
      service.cancelUpload(uploadId, mockUser);
      // @ts-expect-error Because uploadSessions is private
      expect(service.uploadSessions.has(uploadId)).toBe(false);
    });

    it('should throw if session not found', () => {
      expect(() => service.cancelUpload('invalid', mockUser)).toThrow(
        BadRequestException,
      );
    });

    it('should throw if user is not owner', () => {
      const { uploadId } = service.initializeUpload('file.txt', 8, 4, mockUser);
      expect(() => service.cancelUpload(uploadId, otherUser)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('getStats', () => {
    it('should return activeSessions and totalMemoryUsage', () => {
      const { uploadId } = service.initializeUpload('file.txt', 8, 4, mockUser);
      service.uploadChunk(uploadId, 0, Buffer.from('abcd'), mockUser);
      service.uploadChunk(uploadId, 1, Buffer.from('efgh'), mockUser);
      const stats = service.getStats();
      expect(stats.activeSessions).toBe(1);
      expect(stats.totalMemoryUsage).toMatch(/MB$/);
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should remove expired sessions', () => {
      jest.useFakeTimers();
      const { uploadId } = service.initializeUpload('file.txt', 8, 4, mockUser);
      // @ts-expect-error Because uploadSessions is private
      const session = service.uploadSessions.get(uploadId) || {
        userId: '',
        createdAt: 0,
        chunks: new Map(),
        totalChunks: 0,
      };
      // Set createdAt to past
      session.createdAt = Date.now() - 31 * 60 * 1000;
      // @ts-expect-error Because cleanupExpiredSessions is private
      service.cleanupExpiredSessions();
      // @ts-expect-error Because uploadSessions is private
      expect(service.uploadSessions.has(uploadId)).toBe(false);
    });
  });
});
