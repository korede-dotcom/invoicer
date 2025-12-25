import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '@/modules/auth/auth.service';

@Injectable()
export class ProjectAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');

    try {
      const payload = this.jwtService.verify(token, {
        secret: AuthService.getJWTSecret(),
      });

      // Ensure this is a project token
      if (payload.type !== 'project') {
        throw new UnauthorizedException('Invalid token type');
      }

      request.project = payload;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid JWT payload');
    }
  }
}

