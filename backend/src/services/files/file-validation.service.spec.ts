import {
  FileValidationService,
  FileValidationConfig,
} from './file-validation.service';
import { BadRequestException } from '@nestjs/common';

describe('FileValidationService', () => {
  let service: FileValidationService;

  beforeEach(() => {
    service = new FileValidationService();
    jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
    jest.spyOn(service['logger'], 'warn').mockImplementation(() => {});
  });

  const validJpegFile = {
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x00]),
    originalname: 'test.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
  };

  it('should validate a correct JPEG file', () => {
    expect(() => service.validateFile(validJpegFile)).not.toThrow();
  });

  it('should throw if no file is provided', () => {
    expect(() => service.validateFile({} as any)).toThrow(BadRequestException);
    expect(() => service.validateFile({ buffer: undefined } as any)).toThrow(
      BadRequestException,
    );
  });

  it('should throw if file size exceeds maxSizeBytes', () => {
    const file = { ...validJpegFile, size: 11 * 1024 * 1024 };
    expect(() => service.validateFile(file)).toThrow(
      /File size exceeds maximum allowed size/,
    );
  });

  it('should throw if filename is too long', () => {
    const file = { ...validJpegFile, originalname: 'a'.repeat(256) + '.jpg' };
    expect(() => service.validateFile(file)).toThrow(
      /Filename exceeds maximum length/,
    );
  });

  it('should throw if mimetype is not allowed', () => {
    const file = { ...validJpegFile, mimetype: 'application/zip' };
    expect(() => service.validateFile(file)).toThrow(
      /File type 'application\/zip' is not allowed/,
    );
  });

  it('should throw if extension is not allowed', () => {
    const file = { ...validJpegFile, originalname: 'test.exe' };
    expect(() => service.validateFile(file)).toThrow(
      /File extension '.exe' is not allowed/,
    );
  });

  it('should throw for suspicious filename patterns', () => {
    const patterns = ['../evil.jpg', 'te<>st.jpg', 'CON.txt'];
    for (const name of patterns) {
      const file = { ...validJpegFile, originalname: name };
      expect(() => service.validateFile(file)).toThrow(
        'Invalid filename detected',
      );
    }
  });

  it('should throw for filename with null bytes', () => {
    const file = { ...validJpegFile, originalname: 'test\0.jpg' };
    expect(() => service.validateFile(file)).toThrow(
      /Filename contains null bytes/,
    );
  });

  it('should throw for empty file buffer', () => {
    const file = { ...validJpegFile, buffer: Buffer.alloc(0) };
    expect(() => service.validateFile(file)).toThrow(/Empty file not allowed/);
  });

  it('should throw for magic number mismatch', () => {
    const file = {
      ...validJpegFile,
      buffer: Buffer.from([0x00, 0x00, 0x00, 0x00]),
    };
    expect(() => service.validateFile(file)).toThrow(
      /File content does not match declared file type/,
    );
  });

  it('should allow files with mimetypes/extensions that do not require magic number check', () => {
    const file = {
      buffer: Buffer.from('hello world'),
      originalname: 'test.txt',
      mimetype: 'text/plain',
      size: 11,
    };
    expect(() => service.validateFile(file)).not.toThrow();
  });

  it('should return the validation config', () => {
    const config: FileValidationConfig = service.getValidationConfig();
    expect(config.maxSizeBytes).toBeGreaterThan(0);
    expect(Array.isArray(config.allowedMimeTypes)).toBe(true);
    expect(Array.isArray(config.allowedExtensions)).toBe(true);
    expect(typeof config.maxFilenameLength).toBe('number');
  });
});
