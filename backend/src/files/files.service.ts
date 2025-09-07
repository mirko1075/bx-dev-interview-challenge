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
      size: 0, // Lo aggiorneremo in un secondo momento se necessario
    });
    await this.fileRepository.save(newFile);

    return { uploadUrl, file: newFile };
  }
}
