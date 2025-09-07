import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Logger,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { AuthGuard } from '@nestjs/passport';
import { GetPresignedUrlDto } from './dto/get-presigned-url.dto';
import { User } from '@/entities/user.entity';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}
  private readonly logger = new Logger(FilesController.name);
  @UseGuards(AuthGuard('jwt'))
  @Post('presigned-url')
  async getPresignedUrl(
    @Body() getPresignedUrlDto: GetPresignedUrlDto,
    @Req() req: { user: User },
  ) {
    const { filename, fileType } = getPresignedUrlDto;
    const user = req.user;
    console.log('user :>> ', user);
    this.logger.log(
      `Generating presigned URL for file: ${filename} with type: ${fileType} for user: ${user.id}`,
    );
    return this.filesService.generatePresignedUrl(filename, fileType, user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: any, @Req() req: { user: User }) {
    const user = req.user;
    this.logger.log(
      `Direct upload for file: ${file.originalname} (${file.size} bytes) for user: ${user.id}`,
    );
    return await this.filesService.uploadFileDirect(file, user);
  }
}
