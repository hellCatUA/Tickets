import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AccessModule } from './access/access.module';
import { RolesGuard } from './access/roles.guard';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { NextcloudModule } from './nextcloud/nextcloud.module';
import { UsersModule } from './users/users.module';

// Present in the production image (built SPA copied next to dist/), absent in dev
// where Vite serves the frontend itself.
const publicDir = join(__dirname, '..', 'public');

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.getOrThrow<string>('DATABASE_URL'),
        autoLoadEntities: true,
        // M0 bootstrap convenience; replaced by checked-in migrations before first release.
        synchronize: true,
      }),
    }),
    ...(existsSync(publicDir)
      ? [
          ServeStaticModule.forRoot({
            rootPath: publicDir,
            exclude: ['/api/(.*)', '/auth/(.*)', '/ocs/(.*)', '/healthz'],
          }),
        ]
      : []),
    AccessModule,
    AuthModule,
    UsersModule,
    NextcloudModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: RolesGuard }],
})
export class AppModule {}
