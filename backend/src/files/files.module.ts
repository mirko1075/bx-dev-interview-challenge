import { Module, OnModuleInit } from '@nestjs/common';
import { FilesService } from '../services/files/files.service';
import { FilesController } from '@/controllers/files/files.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { File } from '../entities/file.entity';
import { S3Service } from '../services/files/s3.service';
import { FileValidationService } from '../services/files/file-validation.service';
import { FileUploadExceptionFilter } from './file-upload-exception.filter';
import { ImageCompressionService } from '../services/files/image-compression.service';
import { ChunkedUploadService } from '@/services/files/chunked-upload.service';
import { CacheService } from '@/services/files/cache.service';

@Module({
  imports: [TypeOrmModule.forFeature([File])],
  controllers: [FilesController],
  providers: [
    FilesService,
    S3Service,
    FileValidationService,
    FileUploadExceptionFilter,
    ImageCompressionService,
    ChunkedUploadService,
    CacheService,
  ],
  exports: [
    FilesService,
    S3Service,
    FileValidationService,
    ImageCompressionService,
    CacheService,
  ],
})
export class FilesModule implements OnModuleInit {
  constructor(private readonly s3Service: S3Service) {}

  onModuleInit() {
    // Temporaneamente disabilitato per evitare errori di firma
    // await this.s3Service.configureCors();
    console.log('FilesModule initialized - CORS configuration skipped');
  }
}
