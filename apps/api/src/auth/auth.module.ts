import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { OidcService } from './oidc.service';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [OidcService],
})
export class AuthModule {}
