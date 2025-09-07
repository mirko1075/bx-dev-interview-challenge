import { Injectable, BadRequestException, Logger } from '@nestjs/common';

export interface FileValidationConfig {
  maxSizeBytes: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  maxFilenameLength: number;
}

@Injectable()
export class FileValidationService {
  private readonly logger = new Logger(FileValidationService.name);

  // Default configuration
  private readonly config: FileValidationConfig = {
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    allowedExtensions: [
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.webp',
      '.pdf',
      '.txt',
      '.doc',
      '.docx',
      '.xls',
      '.xlsx',
    ],
    maxFilenameLength: 255,
  };

  validateFile(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  }): void {
    this.logger.log(
      `Validating file: ${file.originalname}, size: ${file.size}, mimetype: ${file.mimetype}`,
    );

    // Check if file exists
    if (!file || !file.buffer) {
      throw new BadRequestException('No file provided');
    }

    // Validate file size
    if (file.size > this.config.maxSizeBytes) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.formatBytes(this.config.maxSizeBytes)}`,
      );
    }

    // Validate filename length
    if (file.originalname.length > this.config.maxFilenameLength) {
      throw new BadRequestException(
        `Filename exceeds maximum length of ${this.config.maxFilenameLength} characters`,
      );
    }

    // Validate MIME type
    if (!this.config.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type '${file.mimetype}' is not allowed. Allowed types: ${this.config.allowedMimeTypes.join(', ')}`,
      );
    }

    // Validate file extension
    const fileExtension = this.getFileExtension(file.originalname);
    if (!this.config.allowedExtensions.includes(fileExtension.toLowerCase())) {
      throw new BadRequestException(
        `File extension '${fileExtension}' is not allowed. Allowed extensions: ${this.config.allowedExtensions.join(', ')}`,
      );
    }

    // Check for suspicious filenames
    this.validateFilename(file.originalname);

    // Validate file content (basic magic number check)
    this.validateFileContent(file.buffer, file.mimetype);

    this.logger.log(`File validation passed for: ${file.originalname}`);
  }

  private validateFilename(filename: string): void {
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /\.\./,
      /[<>:"|?*]/,
      /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i,
      /^\./,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(filename)) {
        throw new BadRequestException('Invalid filename detected');
      }
    }

    // Check for null bytes
    if (filename.includes('\0')) {
      throw new BadRequestException('Filename contains null bytes');
    }
  }

  private validateFileContent(buffer: Buffer, mimetype: string): void {
    if (buffer.length === 0) {
      throw new BadRequestException('Empty file not allowed');
    }

    // Basic magic number validation
    const magicNumbers = new Map([
      ['image/jpeg', [0xff, 0xd8, 0xff]],
      ['image/png', [0x89, 0x50, 0x4e, 0x47]],
      ['image/gif', [0x47, 0x49, 0x46]],
      ['application/pdf', [0x25, 0x50, 0x44, 0x46]],
    ]);

    const expectedMagic = magicNumbers.get(mimetype);
    if (expectedMagic) {
      const actualMagic = Array.from(buffer.slice(0, expectedMagic.length));
      const isValid = expectedMagic.every(
        (byte, index) => actualMagic[index] === byte,
      );

      if (!isValid) {
        this.logger.warn(
          `Magic number mismatch for ${mimetype}. Expected: [${expectedMagic.join(', ')}], Got: [${actualMagic.join(', ')}]`,
        );
        throw new BadRequestException(
          'File content does not match declared file type',
        );
      }
    }
  }

  private getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex === -1 ? '' : filename.substring(lastDotIndex);
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Method to get configuration for frontend
  getValidationConfig(): FileValidationConfig {
    return { ...this.config };
  }

  // Validate file request for presigned URLs (before actual upload)
  validateFileRequest(filename: string, mimeType: string): void {
    this.logger.log(`Validating file request: ${filename} (${mimeType})`);

    // Validate filename
    this.validateFilename(filename);

    // Validate MIME type
    if (!this.config.allowedMimeTypes.includes(mimeType)) {
      throw new BadRequestException(
        `File type not allowed. Allowed types: ${this.config.allowedMimeTypes.join(', ')}`,
      );
    }

    // Validate file extension
    const extension = this.getFileExtension(filename).toLowerCase();
    if (!this.config.allowedExtensions.includes(extension)) {
      throw new BadRequestException(
        `File extension not allowed. Allowed extensions: ${this.config.allowedExtensions.join(', ')}`,
      );
    }

    // Check if extension matches MIME type
    const expectedMimeTypes = this.getExpectedMimeTypes(extension);
    if (expectedMimeTypes.length > 0 && !expectedMimeTypes.includes(mimeType)) {
      throw new BadRequestException(
        `File extension '${extension}' does not match MIME type '${mimeType}'. Expected: ${expectedMimeTypes.join(' or ')}`,
      );
    }

    this.logger.log(`File request validation passed: ${filename}`);
  }

  private getExpectedMimeTypes(extension: string): string[] {
    const mimeTypeMap: { [key: string]: string[] } = {
      '.jpg': ['image/jpeg'],
      '.jpeg': ['image/jpeg'],
      '.png': ['image/png'],
      '.gif': ['image/gif'],
      '.webp': ['image/webp'],
      '.pdf': ['application/pdf'],
      '.txt': ['text/plain'],
      '.doc': ['application/msword'],
      '.docx': [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      '.xls': ['application/vnd.ms-excel'],
      '.xlsx': [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ],
    };

    return mimeTypeMap[extension] || [];
  }
}
