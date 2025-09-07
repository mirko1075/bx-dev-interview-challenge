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

  async generatePresignedUrl(filename: string, fileType: string, user: User) {
    try {
      const { uploadUrl, key } = await this.s3Service.getPresignedUploadUrl(
        filename,
        fileType,
      );

      // Pre-salviamo i metadati del file nel database
      const newFile = this.fileRepository.create({
        filename,
        s3Key: key,
        mimetype: fileType,
        user,
        size: 0,
      });
      await this.fileRepository.save(newFile);

      return { uploadUrl, file: newFile };
    } catch (error) {
      console.warn('Primary method failed, trying alternative:', error);
    }
  }

  async uploadFileDirect(file: any, user: User) {
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to upload file: ${errorMessage}`);
    }
  }
}
