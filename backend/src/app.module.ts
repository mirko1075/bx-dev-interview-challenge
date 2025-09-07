import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import getCommonConfig from './configs/common';
import { AppController } from './controllers/app.controller';
import { AppService } from './services/app/app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { File } from './entities/file.entity';
import { database } from './configs/database';
import { AuthModule } from './auth/auth.module';
import { auth } from './configs/auth';
import { PassportModule } from '@nestjs/passport/dist/passport.module';
import { FilesModule } from './files/files.module';
import { DebugModule } from './debug/debug.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [getCommonConfig, auth, database],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.user'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.name'),
        entities: [User, File],
        synchronize: true,
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    FilesModule,
    DebugModule,
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
