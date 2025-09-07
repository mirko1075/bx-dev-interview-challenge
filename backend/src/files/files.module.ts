import { Module, OnModuleInit } from '@nestjs/common'; // <-- Importa OnModuleInit
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { File } from '../entities/file.entity';
import { S3Service } from './s3.service';

@Module({
  imports: [TypeOrmModule.forFeature([File])],
  controllers: [FilesController],
  providers: [FilesService, S3Service],
  exports: [FilesService, S3Service], // Esportiamo i servizi per uso in altri moduli
})
export class FilesModule implements OnModuleInit {
  constructor(private readonly s3Service: S3Service) {}

  onModuleInit() {
    // Temporaneamente disabilitato per evitare errori di firma
    // await this.s3Service.configureCors();
    console.log('FilesModule initialized - CORS configuration skipped');
  }
}
