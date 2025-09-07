import { Module, OnModuleInit } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { File } from '../entities/file.entity';
import { S3Service } from './s3.service';
import { FileValidationService } from './file-validation.service';
import { FileUploadExceptionFilter } from './file-upload-exception.filter';
import { ImageCompressionService } from './image-compression.service';
import { ChunkedUploadService } from './chunked-upload.service';
import { CacheService } from './cache.service';

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
