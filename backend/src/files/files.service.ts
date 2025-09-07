import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { File } from '../entities/file.entity';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { S3Service } from './s3.service';

@Injectable()
export class FilesService {
  constructor(
    @InjectRepository(File)
    private readonly fileRepository: Repository<File>,
    private readonly s3Service: S3Service,
  ) {}

  async uploadFileDirect(
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
    user: User,
  ) {
    try {
      // Upload direttamente a S3 tramite backend
      const key = await this.s3Service.uploadFileDirect(
        file.buffer,
        file.originalname,
        file.mimetype,
      );

      // Salva i metadati nel database
      const newFile = this.fileRepository.create({
        filename: file.originalname,
        s3Key: key,
        mimetype: file.mimetype,
        user,
        size: file.size,
      });
      await this.fileRepository.save(newFile);

      return {
        success: true,
        file: newFile,
        message: `File ${file.originalname} uploaded successfully`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to upload file: ${errorMessage}`);
    }
  }

  async getFilesByUser(user: User) {
    try {
      const files = await this.fileRepository.find({
        where: { user: { id: user.id } },
        order: { createdAt: 'DESC' },
      });
      return { success: true, files };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get files: ${errorMessage}`);
    }
  }

  async downloadFile(fileId: string, user: User) {
    try {
      // Verifica che il file appartenga all'utente
      const file = await this.fileRepository.findOne({
        where: { id: fileId, user: { id: user.id } },
      });

      if (!file) {
        throw new Error('File not found or access denied');
      }

      const fileStream = this.s3Service.getFileStream(file.s3Key);

      return {
        stream: fileStream,
        filename: file.filename,
        mimetype: file.mimetype,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to download file: ${errorMessage}`);
    }
  }

  async getPresignedUploadUrl(filename: string, fileType: string, user: User) {
    try {
      const result = await this.s3Service.getPresignedUploadUrl(
        filename,
        fileType,
      );

      return {
        success: true,
        uploadUrl: result.uploadUrl,
        s3Key: result.key,
        filename,
        fileType,
        userId: user.id, // Include user ID for reference
        message: `Presigned upload URL generated for ${filename}`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to generate presigned upload URL: ${errorMessage}`,
      );
    }
  }

  async completePresignedUpload(
    s3Key: string,
    filename: string,
    fileType: string,
    fileSize: number,
    user: User,
  ) {
    try {
      // Save file metadata to database after successful presigned upload
      const newFile = this.fileRepository.create({
        filename,
        s3Key,
        mimetype: fileType,
        user,
        size: fileSize,
      });
      await this.fileRepository.save(newFile);

      return {
        success: true,
        file: newFile,
        message: `File ${filename} uploaded successfully via presigned URL`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to complete presigned upload: ${errorMessage}`);
    }
  }

  async getPresignedDownloadUrl(fileId: string, user: User) {
    try {
      // Verify file belongs to user
      const file = await this.fileRepository.findOne({
        where: { id: fileId, user: { id: user.id } },
      });

      if (!file) {
        throw new Error('File not found or access denied');
      }

      const downloadUrl = await this.s3Service.getPresignedDownloadUrl(
        file.s3Key,
      );

      return {
        success: true,
        downloadUrl,
        filename: file.filename,
        mimetype: file.mimetype,
        message: `Presigned download URL generated for ${file.filename}`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to generate presigned download URL: ${errorMessage}`,
      );
    }
  }
}
