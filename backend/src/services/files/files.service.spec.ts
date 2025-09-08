import { FilesService } from './files.service';
import { Repository } from 'typeorm';
import { File } from '../../entities/file.entity';
import { User } from '../../entities/user.entity';
import { S3Service } from './s3.service';
import { Readable } from 'stream';

jest.mock('./s3.service');

describe('FilesService', () => {
  let filesService: FilesService;
  let fileRepository: jest.Mocked<Repository<File>>;
  let s3Service: jest.Mocked<S3Service>;

  const mockUser: User = { id: 1 } as unknown as User;
  const mockFileEntity: File = {
    id: 'file-id',
    filename: 'test.txt',
    s3Key: 's3-key',
    mimetype: 'text/plain',
    user: mockUser,
    size: 123,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as File;

  beforeEach(() => {
    fileRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    } as any as jest.Mocked<Repository<File>>;

    s3Service = {
      uploadFileDirect: jest.fn(),
      getFileStream: jest.fn(),
    } as unknown as jest.Mocked<S3Service>;

    filesService = new FilesService(fileRepository, s3Service);
  });

  describe('uploadFileDirect', () => {
    it('should upload file to S3 and save metadata', async () => {
      const file = {
        buffer: Buffer.from('test'),
        originalname: 'test.txt',
        mimetype: 'text/plain',
        size: 123,
      };
      s3Service.uploadFileDirect.mockResolvedValue('s3-key');
      fileRepository.create.mockReturnValue(mockFileEntity);
      fileRepository.save.mockResolvedValue(mockFileEntity);

      const result = await filesService.uploadFileDirect(file, mockUser);
      const uploadFileDirectSpy = jest.spyOn(s3Service, 'uploadFileDirect');
      expect(uploadFileDirectSpy).toHaveBeenCalledWith(
        file.buffer,
        file.originalname,
        file.mimetype,
      );
      const createFileSpy = jest.spyOn(fileRepository, 'create');
      expect(createFileSpy).toHaveBeenCalledWith({
        filename: file.originalname,
        s3Key: 's3-key',
        mimetype: file.mimetype,
        user: mockUser,
        size: file.size,
      });
      const saveFileSpy = jest.spyOn(fileRepository, 'save');
      expect(saveFileSpy).toHaveBeenCalledWith(mockFileEntity);
      expect(result).toEqual({
        success: true,
        file: mockFileEntity,
        message: `File ${file.originalname} uploaded successfully`,
      });
    });

    it('should throw error if upload fails', async () => {
      const file = {
        buffer: Buffer.from('test'),
        originalname: 'test.txt',
        mimetype: 'text/plain',
        size: 123,
      };
      s3Service.uploadFileDirect.mockRejectedValue(new Error('S3 error'));

      await expect(
        filesService.uploadFileDirect(file, mockUser),
      ).rejects.toThrow('Failed to upload file: S3 error');
    });
  });

  describe('getFilesByUser', () => {
    it('should return files for user', async () => {
      fileRepository.find.mockResolvedValue([mockFileEntity]);

      const result = await filesService.getFilesByUser(mockUser);
      const findSpy = jest.spyOn(fileRepository, 'find');
      expect(findSpy).toHaveBeenCalledWith({
        where: { user: { id: mockUser.id } },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual({ success: true, files: [mockFileEntity] });
    });

    it('should throw error if find fails', async () => {
      fileRepository.find.mockRejectedValue(new Error('DB error'));

      await expect(filesService.getFilesByUser(mockUser)).rejects.toThrow(
        'Failed to get files: DB error',
      );
    });
  });

  describe('downloadFile', () => {
    it('should return file stream if file belongs to user', async () => {
      const fileStream = {} as Readable;
      fileRepository.findOne.mockResolvedValue(mockFileEntity);
      s3Service.getFileStream.mockReturnValue(fileStream);

      const result = await filesService.downloadFile('file-id', mockUser);
      const findOneSpy = jest.spyOn(fileRepository, 'findOne');
      expect(findOneSpy).toHaveBeenCalledWith({
        where: { id: 'file-id', user: { id: mockUser.id } },
      });
      const getFileStreamSpy = jest.spyOn(s3Service, 'getFileStream');
      expect(getFileStreamSpy).toHaveBeenCalledWith('s3-key');
      expect(result).toEqual({
        stream: fileStream,
        filename: mockFileEntity.filename,
        mimetype: mockFileEntity.mimetype,
      });
    });

    it('should throw error if file not found or access denied', async () => {
      fileRepository.findOne.mockResolvedValue(null);

      await expect(
        filesService.downloadFile('file-id', mockUser),
      ).rejects.toThrow(
        'Failed to download file: File not found or access denied',
      );
    });

    it('should throw error if repository fails', async () => {
      fileRepository.findOne.mockRejectedValue(new Error('DB error'));

      await expect(
        filesService.downloadFile('file-id', mockUser),
      ).rejects.toThrow('Failed to download file: DB error');
    });
  });
});
