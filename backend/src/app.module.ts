import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import getCommonConfig from './configs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { File } from './entities/file.entity';
import { database } from './configs/database';
import { AuthModule } from './auth/auth.module';
import { auth } from './configs/auth';
import { PassportModule } from '@nestjs/passport/dist/passport.module';
import { FilesModule } from './files/files.module';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),
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
  ],

  controllers: [],
  providers: [],
})
export class AppModule {}
