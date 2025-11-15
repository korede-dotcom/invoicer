import { AuthController } from '@/modules/auth/auth.controller';
import { AuthService } from '@/modules/auth/auth.service';
import { UnifiedLoginController } from '@/modules/auth/unified-login.controller';
import { Module } from '@nestjs/common';

@Module({
  imports: [],
  controllers: [AuthController, UnifiedLoginController],
  providers: [AuthService],
})
export class AuthModule {}
