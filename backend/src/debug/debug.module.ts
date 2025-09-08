import { Module } from '@nestjs/common';
import { DebugController } from '../controllers/debug.controller';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [FilesModule],
  controllers: [DebugController],
})
export class DebugModule {}
