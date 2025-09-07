import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  Req,
  Logger,
  UseInterceptors,
  UploadedFile,
  Res,
  UseFilters,
  Query,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { FilesService } from './files.service';
import { AuthGuard } from '@nestjs/passport';
import { User } from '@/entities/user.entity';
import { FileValidationService } from './file-validation.service';
import { FileUploadExceptionFilter } from './file-upload-exception.filter';
import { ImageCompressionService } from './image-compression.service';
import { ChunkedUploadService } from './chunked-upload.service';
import { CacheService } from './cache.service';
import {
  GetPresignedUploadUrlDto,
  CompletePresignedUploadDto,
  PresignedUploadUrlResponse,
  PresignedDownloadUrlResponse,
} from './dto/presigned-upload.dto';

@Controller('files')
@UseFilters(FileUploadExceptionFilter)
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly fileValidationService: FileValidationService,
    private readonly imageCompressionService: ImageCompressionService,
    private readonly chunkedUploadService: ChunkedUploadService,
    private readonly cacheService: CacheService,
  ) {}
  private readonly logger = new Logger(FilesController.name);

  @UseGuards(AuthGuard('jwt'))
  @Post('upload')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 uploads per minute
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  async uploadFile(
    @UploadedFile()
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
    @Req() req: { user: User },
  ) {
    const user = req.user;

    // Validate file using our custom validation service
    this.fileValidationService.validateFile(file);

    // Apply image compression if applicable
    const processedFile = { ...file };
    if (this.imageCompressionService.shouldCompress(file.mimetype, file.size)) {
      this.logger.log(`Compressing image: ${file.originalname}`);
      const compressed = await this.imageCompressionService.compressImage(
        file.buffer,
        file.mimetype,
      );
      processedFile.buffer = compressed.buffer;
      processedFile.mimetype = compressed.mimetype;
      processedFile.size = compressed.buffer.length;

      this.logger.log(
        `Image compressed: ${file.size} → ${processedFile.size} bytes (${compressed.sizeReduction.toFixed(1)}% reduction)`,
      );
    }

    this.logger.log(
      `Direct upload for file: ${processedFile.originalname} (${processedFile.size} bytes) for user: ${user.id}`,
    );

    const result = await this.filesService.uploadFileDirect(
      processedFile,
      user,
    );

    // Clear user's file cache to ensure fresh data
    this.cacheService.delete(`files:user:${user.id}`);

    return result;
  }

  @Get('validation-config')
  getValidationConfig() {
    return this.fileValidationService.getValidationConfig();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get()
  async getFiles(@Req() req: { user: User }) {
    const user = req.user;
    this.logger.log(`Getting files for user: ${user.id}`);

    // Try to get from cache first
    const cacheKey = `files:user:${user.id}`;
    const cachedFiles = this.cacheService.get(cacheKey);

    if (cachedFiles) {
      this.logger.debug(`Cache hit for user files: ${user.id}`);
      return cachedFiles;
    }

    // Fetch from database and cache result
    const result = await this.filesService.getFilesByUser(user);
    this.cacheService.set(cacheKey, result, 2 * 60 * 1000); // Cache for 2 minutes

    return result;
  }

  // Chunked upload endpoints
  @UseGuards(AuthGuard('jwt'))
  @Post('chunked/init')
  @HttpCode(HttpStatus.OK)
  initChunkedUpload(
    @Body() body: { filename: string; fileSize: number; chunkSize: number },
    @Req() req: { user: User },
  ) {
    const { filename, fileSize, chunkSize } = body;
    const user = req.user;

    this.logger.log(
      `Initializing chunked upload: ${filename} (${fileSize} bytes) for user: ${user.id}`,
    );

    return this.chunkedUploadService.initializeUpload(
      filename,
      fileSize,
      chunkSize,
      user,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('chunked/:uploadId/chunk/:chunkNumber')
  @UseInterceptors(FileInterceptor('chunk'))
  uploadChunk(
    @Param('uploadId') uploadId: string,
    @Param('chunkNumber') chunkNumber: string,
    @UploadedFile() chunk: { buffer: Buffer },
    @Req() req: { user: User },
  ) {
    const user = req.user;
    const chunkNum = parseInt(chunkNumber, 10);

    return this.chunkedUploadService.uploadChunk(
      uploadId,
      chunkNum,
      chunk.buffer,
      user,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('chunked/:uploadId/complete')
  async completeChunkedUpload(
    @Param('uploadId') uploadId: string,
    @Body() body: { filename: string; mimetype: string },
    @Req() req: { user: User },
  ) {
    const user = req.user;
    const { filename, mimetype } = body;

    // Assemble the file
    const assembledBuffer = this.chunkedUploadService.assembleFile(
      uploadId,
      user,
    );

    // Create file object
    const file = {
      buffer: assembledBuffer,
      originalname: filename,
      mimetype,
      size: assembledBuffer.length,
    };

    // Validate and process the assembled file
    this.fileValidationService.validateFile(file);

    const result = await this.filesService.uploadFileDirect(file, user);

    // Clear cache
    this.cacheService.delete(`files:user:${user.id}`);

    return result;
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('chunked/:uploadId/progress')
  getUploadProgress(
    @Param('uploadId') uploadId: string,
    @Req() req: { user: User },
  ) {
    const user = req.user;
    return this.chunkedUploadService.getUploadProgress(uploadId, user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('chunked/:uploadId/cancel')
  @HttpCode(HttpStatus.OK)
  cancelChunkedUpload(
    @Param('uploadId') uploadId: string,
    @Req() req: { user: User },
  ) {
    const user = req.user;
    this.chunkedUploadService.cancelUpload(uploadId, user);
    return { success: true, message: 'Upload cancelled' };
  }

  // Presigned URL endpoints
  @UseGuards(AuthGuard('jwt'))
  @Post('presigned-upload-url')
  async getPresignedUploadUrl(
    @Body() getPresignedUrlDto: GetPresignedUploadUrlDto,
    @Req() req: { user: User },
  ): Promise<PresignedUploadUrlResponse> {
    const user = req.user;

    // Validate the file before generating presigned URL
    this.fileValidationService.validateFileRequest(
      getPresignedUrlDto.filename,
      getPresignedUrlDto.fileType,
    );

    this.logger.log(
      `Generating presigned upload URL for: ${getPresignedUrlDto.filename} (${getPresignedUrlDto.fileType}) for user: ${user.id}`,
    );

    const result = await this.filesService.getPresignedUploadUrl(
      getPresignedUrlDto.filename,
      getPresignedUrlDto.fileType,
      user,
    );

    return result;
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('presigned-upload-complete')
  async completePresignedUpload(
    @Body() completeUploadDto: CompletePresignedUploadDto,
    @Req() req: { user: User },
  ) {
    const user = req.user;

    this.logger.log(
      `Completing presigned upload for key: ${completeUploadDto.s3Key} for user: ${user.id}`,
    );

    const result = await this.filesService.completePresignedUpload(
      completeUploadDto.s3Key,
      completeUploadDto.filename,
      completeUploadDto.fileType,
      completeUploadDto.fileSize,
      user,
    );

    // Clear user's file cache to ensure fresh data
    this.cacheService.delete(`files:user:${user.id}`);

    return result;
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id/presigned-download-url')
  async getPresignedDownloadUrl(
    @Param('id') fileId: string,
    @Req() req: { user: User },
  ): Promise<PresignedDownloadUrlResponse> {
    const user = req.user;

    this.logger.log(
      `Generating presigned download URL for file: ${fileId} for user: ${user.id}`,
    );

    const result = await this.filesService.getPresignedDownloadUrl(
      fileId,
      user,
    );
    return result;
  }

  // Performance monitoring endpoints
  @Get('performance/stats')
  getPerformanceStats() {
    const cacheStats = this.cacheService.getStats();
    const uploadStats = this.chunkedUploadService.getStats();

    return {
      cache: cacheStats,
      chunkedUploads: uploadStats,
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id/download')
  async downloadFile(
    @Param('id') fileId: string,
    @Req() req: { user: User },
    @Res() res: Response,
  ) {
    const user = req.user;
    this.logger.log(`Downloading file: ${fileId} for user: ${user.id}`);

    const fileStream = await this.filesService.downloadFile(fileId, user);

    // Set appropriate headers
    res.set({
      'Content-Type': fileStream.mimetype,
      'Content-Disposition': `attachment; filename="${fileStream.filename}"`,
    });

    // Pipe the file stream to response
    fileStream.stream.pipe(res);
  }
}
