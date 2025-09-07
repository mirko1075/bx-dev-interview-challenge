import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { FilesService } from './files.service';
import { AuthGuard } from '@nestjs/passport';
import { GetPresignedUrlDto } from './dto/get-presigned-url.dto';
import { User } from '@/entities/user.entity';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('presigned-url')
  async getPresignedUrl(
    @Body() getPresignedUrlDto: GetPresignedUrlDto,
    @Req() req: { user: User },
  ) {
    const { filename, fileType } = getPresignedUrlDto;
    const user = req.user;
    return this.filesService.generatePresignedUrl(filename, fileType, user);
  }
}
