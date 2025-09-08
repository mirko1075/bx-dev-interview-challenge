import { User } from '@/entities/user.entity';
import { CacheService } from '@/services/files/cache.service';
import { ChunkedUploadService } from '@/services/files/chunked-upload.service';
import { FileValidationService } from '@/services/files/file-validation.service';
import { FilesService } from '@/services/files/files.service';
import { ImageCompressionService } from '@/services/files/image-compression.service';
import { TestingModule, Test } from '@nestjs/testing';
import Stream from 'stream';
import { FilesController } from './files.controller';
import { Response } from 'express';
describe('FilesController', () => {
  let controller: FilesController;
  let filesService: jest.Mocked<FilesService>;
  let fileValidationService: jest.Mocked<FileValidationService>;
  let imageCompressionService: jest.Mocked<ImageCompressionService>;
  let chunkedUploadService: jest.Mocked<ChunkedUploadService>;
  let cacheService: jest.Mocked<CacheService>;

  const mockUser = { id: 'user1' } as User;
  const mockFile1 = {
    id: 'file1',
    filename: '',
    s3Key: '',
    mimetype: '',
    size: 0,
    user: new User(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const mockFile2 = {
    id: 'file2',
    filename: '',
    s3Key: '',
    mimetype: '',
    size: 0,
    user: new User(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [
        {
          provide: FilesService,
          useValue: {
            uploadFileDirect: jest.fn(),
            getFilesByUser: jest.fn(),
            downloadFile: jest.fn(),
          },
        },
        {
          provide: FileValidationService,
          useValue: { validateFile: jest.fn(), getValidationConfig: jest.fn() },
        },
        {
          provide: ImageCompressionService,
          useValue: { shouldCompress: jest.fn(), compressImage: jest.fn() },
        },
        {
          provide: ChunkedUploadService,
          useValue: {
            initializeUpload: jest.fn(),
            uploadChunk: jest.fn(),
            assembleFile: jest.fn(),
            getUploadProgress: jest.fn(),
            cancelUpload: jest.fn(),
            getStats: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            delete: jest.fn(),
            getStats: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(FilesController);
    filesService = module.get(FilesService);
    fileValidationService = module.get(FileValidationService);
    imageCompressionService = module.get(ImageCompressionService);
    chunkedUploadService = module.get(ChunkedUploadService);
    cacheService = module.get(CacheService);
  });

  describe('uploadFile', () => {
    it('should validate, compress if needed, upload, and clear cache', async () => {
      const file = {
        buffer: Buffer.from('test'),
        originalname: 'test.png',
        mimetype: 'image/png',
        size: 1000,
      };
      fileValidationService.validateFile.mockReturnValue(undefined);
      imageCompressionService.shouldCompress.mockReturnValue(true);
      imageCompressionService.compressImage.mockResolvedValue({
        buffer: Buffer.from('compressed'),
        mimetype: 'image/png',
        sizeReduction: 50,
      });
      filesService.uploadFileDirect.mockResolvedValue({
        success: true,
        file: mockFile1,
        message: 'Uploaded',
      });

      const result = await controller.uploadFile(file, { user: mockUser });
      const validateFileSpy = jest.spyOn(fileValidationService, 'validateFile');
      expect(validateFileSpy).toHaveBeenCalledWith(file);
      const shouldCompressSpy = jest.spyOn(
        imageCompressionService,
        'shouldCompress',
      );
      expect(shouldCompressSpy).toHaveBeenCalledWith(file.mimetype, file.size);
      const compressImageSpy = jest.spyOn(
        imageCompressionService,
        'compressImage',
      );
      expect(compressImageSpy).toHaveBeenCalled();
      const uploadFileDirectSpy = jest.spyOn(filesService, 'uploadFileDirect');
      expect(uploadFileDirectSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          buffer: Buffer.from('compressed'),
          mimetype: 'image/png',
        }),
        mockUser,
      );
      const cacheDeleteSpy = jest.spyOn(cacheService, 'delete');
      expect(cacheDeleteSpy).toHaveBeenCalledWith('files:user:user1');
      expect(result).toEqual({
        success: true,
        file: mockFile1,
        message: 'Uploaded',
      });
    });

    it('should skip compression if not needed', async () => {
      const file = {
        buffer: Buffer.from('test'),
        originalname: 'test.txt',
        mimetype: 'text/plain',
        size: 100,
      };
      fileValidationService.validateFile.mockReturnValue(undefined);
      imageCompressionService.shouldCompress.mockReturnValue(false);
      filesService.uploadFileDirect.mockResolvedValue({
        success: true,
        file: mockFile2,
        message: 'Uploaded',
      });

      const result = await controller.uploadFile(file, { user: mockUser });
      const validateFileSpy = jest.spyOn(fileValidationService, 'validateFile');
      expect(validateFileSpy).toHaveBeenCalledWith(file);
      const shouldCompressSpy = jest.spyOn(
        imageCompressionService,
        'shouldCompress',
      );
      expect(shouldCompressSpy).toHaveBeenCalledWith(file.mimetype, file.size);
      const compressImageSpy = jest.spyOn(
        imageCompressionService,
        'compressImage',
      );
      expect(compressImageSpy).not.toHaveBeenCalled();
      const uploadFileDirectSpy = jest.spyOn(filesService, 'uploadFileDirect');
      expect(uploadFileDirectSpy).toHaveBeenCalledWith(file, mockUser);
      expect(result).toEqual({
        success: true,
        file: mockFile2,
        message: 'Uploaded',
      });
    });
  });

  describe('getFiles', () => {
    it('should return cached files if present', async () => {
      cacheService.get.mockReturnValue([{ id: 'cachedFile' }]);
      const result = await controller.getFiles({ user: mockUser });
      expect(result).toEqual([{ id: 'cachedFile' }]);
      const cacheGetSpy = jest.spyOn(cacheService, 'get');
      expect(cacheGetSpy).toHaveBeenCalledWith('files:user:user1');
      const dbFetchSpy = jest.spyOn(filesService, 'getFilesByUser');
      expect(dbFetchSpy).not.toHaveBeenCalled();
    });

    it('should fetch from db and cache if not cached', async () => {
      cacheService.get.mockReturnValue(undefined);
      filesService.getFilesByUser.mockResolvedValue({
        success: true,
        files: [mockFile1, mockFile2],
      });
      const result = await controller.getFiles({ user: mockUser });
      expect(result).toEqual({ success: true, files: [mockFile1, mockFile2] });
      const cacheGetSpy = jest.spyOn(cacheService, 'get');
      expect(cacheGetSpy).toHaveBeenCalledWith('files:user:user1');
      const dbFetchSpy = jest.spyOn(filesService, 'getFilesByUser');
      expect(dbFetchSpy).toHaveBeenCalledWith(mockUser);
      const cacheSetSpy = jest.spyOn(cacheService, 'set');
      expect(cacheSetSpy).toHaveBeenCalledWith(
        'files:user:user1',
        {
          files: [mockFile1, mockFile2],
          success: true,
        },
        2 * 60 * 1000,
      );
    });
  });

  describe('initChunkedUpload', () => {
    it('should initialize chunked upload', () => {
      chunkedUploadService.initializeUpload.mockReturnValue({
        uploadId: 'u1',
        totalChunks: 0,
      });
      const body = { filename: 'f.txt', fileSize: 1000, chunkSize: 100 };
      const result = controller.initChunkedUpload(body, { user: mockUser });
      const spy = jest.spyOn(chunkedUploadService, 'initializeUpload');
      expect(spy).toHaveBeenCalledWith('f.txt', 1000, 100, mockUser);
      expect(result).toEqual({ uploadId: 'u1', totalChunks: 0 });
    });
  });

  describe('uploadChunk', () => {
    it('should upload a chunk', () => {
      chunkedUploadService.uploadChunk.mockReturnValue({
        isComplete: true,
        progress: 100,
      });
      const result = controller.uploadChunk(
        'upload1',
        '2',
        { buffer: Buffer.from('chunk') },
        { user: mockUser },
      );
      const spy = jest.spyOn(chunkedUploadService, 'uploadChunk');
      expect(spy).toHaveBeenCalledWith(
        'upload1',
        2,
        Buffer.from('chunk'),
        mockUser,
      );
      expect(result).toEqual({
        isComplete: true,
        progress: 100,
      });
    });
  });

  describe('completeChunkedUpload', () => {
    it('should assemble, validate, upload, and clear cache', async () => {
      chunkedUploadService.assembleFile.mockReturnValue(
        Buffer.from('assembled'),
      );
      fileValidationService.validateFile.mockReturnValue(undefined);
      filesService.uploadFileDirect.mockResolvedValue({
        success: true,
        file: mockFile1,
        message: 'Uploaded',
      });

      const result = await controller.completeChunkedUpload(
        'upload2',
        { filename: 'final.txt', mimetype: 'text/plain' },
        { user: mockUser },
      );
      const spy = jest.spyOn(chunkedUploadService, 'assembleFile');
      expect(spy).toHaveBeenCalledWith('upload2', mockUser);
      const validateFileSpy = jest.spyOn(fileValidationService, 'validateFile');
      expect(validateFileSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          buffer: Buffer.from('assembled'),
          originalname: 'final.txt',
          mimetype: 'text/plain',
        }),
      );
      const uploadFileDirectSpy = jest.spyOn(filesService, 'uploadFileDirect');
      expect(uploadFileDirectSpy).toHaveBeenCalled();
      const cacheDeleteSpy = jest.spyOn(cacheService, 'delete');
      expect(cacheDeleteSpy).toHaveBeenCalledWith('files:user:user1');
      console.log('result :>> ', result);
      expect(result).toEqual({
        success: true,
        file: mockFile1,
        message: 'Uploaded',
      });
    });
  });

  describe('getUploadProgress', () => {
    it('should get upload progress', () => {
      chunkedUploadService.getUploadProgress.mockReturnValue({
        progress: 50,
        chunksUploaded: 0,
        totalChunks: 0,
      });
      const result = controller.getUploadProgress('upload3', {
        user: mockUser,
      });
      const spy = jest.spyOn(chunkedUploadService, 'getUploadProgress');
      expect(spy).toHaveBeenCalledWith('upload3', mockUser);
      expect(result).toEqual({
        progress: 50,
        chunksUploaded: 0,
        totalChunks: 0,
      });
    });
  });

  describe('cancelChunkedUpload', () => {
    it('should cancel upload', () => {
      const result = controller.cancelChunkedUpload('upload4', {
        user: mockUser,
      });
      const spy = jest.spyOn(chunkedUploadService, 'cancelUpload');
      expect(spy).toHaveBeenCalledWith('upload4', mockUser);
      expect(result).toEqual({ success: true, message: 'Upload cancelled' });
    });
  });

  describe('getPerformanceStats', () => {
    it('should return performance stats', () => {
      cacheService.getStats.mockReturnValue({ size: 5, memoryUsage: '128MB' });
      chunkedUploadService.getStats.mockReturnValue({
        activeSessions: 2,
        totalMemoryUsage: '1024',
      });
      const result = controller.getPerformanceStats();
      expect(result.cache).toEqual({ size: 5, memoryUsage: '128MB' });
      expect(result.chunkedUploads).toEqual({
        activeSessions: 2,
        totalMemoryUsage: '1024',
      });
      expect(typeof result.timestamp).toBe('string');
    });
  });

  describe('downloadFile', () => {
    it('should set headers and pipe stream', async () => {
      const mockStream = { pipe: jest.fn() };
      filesService.downloadFile.mockResolvedValue({
        mimetype: 'text/plain',
        filename: 'file.txt',
        stream: mockStream as unknown as Stream.Readable,
      });
      const res: Response = {
        set: jest.fn().mockReturnThis(),
      } as unknown as Response;
      await controller.downloadFile('fileId', { user: mockUser }, res);
      expect(mockStream.pipe).toHaveBeenCalledWith(res);
    });
  });
});
