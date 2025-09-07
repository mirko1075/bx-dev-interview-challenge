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
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { FilesService } from './files.service';
import { AuthGuard } from '@nestjs/passport';
import { User } from '@/entities/user.entity';
import { FileValidationService } from './file-validation.service';
import { FileUploadExceptionFilter } from './file-upload-exception.filter';

@Controller('files')
@UseFilters(FileUploadExceptionFilter)
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly fileValidationService: FileValidationService,
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

    this.logger.log(
      `Direct upload for file: ${file.originalname} (${file.size} bytes) for user: ${user.id}`,
    );
    return await this.filesService.uploadFileDirect(file, user);
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
    return await this.filesService.getFilesByUser(user);
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
