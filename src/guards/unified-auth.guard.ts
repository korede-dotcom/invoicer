import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '@/modules/auth/auth.service';
import prisma from '@/prisma/prisma.service';
import { RequestWithUser } from '@/types/request';
import { CurrentUser } from '@/types/user';

/**
 * Unified authentication guard that supports both:
 * 1. Admin/User tokens (from LoginRequiredGuard)
 * 2. Project tokens (from ProjectAuthGuard)
 * 
 * This allows projects to use the same endpoints as admins
 * but with their own authentication and data isolation.
 */
@Injectable()
export class UnifiedAuthGuard implements CanActivate {
  private jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {
    if (process.env.OIDC_JWKS_URI) {
      try {
        this.jwks = createRemoteJWKSet(
          new URL(process.env.OIDC_JWKS_URI || ''),
        );
      } catch (error) {
        Logger.error('Failed to create JWKS set:', error);
      }
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route allows anonymous access
    if (this.isAllowedAnonymous(this.reflector, context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const response = context.switchToHttp().getResponse();
    let authHeader = request.headers['authorization'];

    if (!authHeader && request.cookies && request.cookies['access_token']) {
      authHeader = request.cookies['access_token'];
    }

    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedException(
        'Missing or invalid authorization header',
      );
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    let payload: any;
    let isValidToken = false;

    // First, try to verify as our own JWT token
    try {
      payload = this.jwt.verify(token, {
        secret: AuthService.getJWTSecret(),
      });
      isValidToken = true;

      // Check if this is a project token
      if (payload.type === 'project') {
        // Validate project exists and is active
        const project = await prisma.project.findUnique({
          where: { id: payload.projectId },
          select: {
            id: true,
            name: true,
            email: true,
            isActive: true,
          },
        });

        if (!project || !project.isActive) {
          throw new UnauthorizedException('Project not found or inactive');
        }

        // Attach project info to request
        (request as any).project = {
          projectId: project.id,
          name: project.name,
          email: project.email,
        };

        return true;
      }

      // Otherwise, treat as user token
      if (!payload.sub || !payload.email) {
        response.setHeader('WWW-Authenticate', 'expired_token');
        throw new UnauthorizedException('Invalid JWT payload');
      }
    } catch (err) {
      // Only try OIDC if our JWT verification failed AND OIDC is configured
      if (!isValidToken && this.jwks) {
        try {
          const result = await jwtVerify(token, this.jwks, {
            issuer: process.env.OIDC_ISSUER,
            audience: process.env.OIDC_CLIENT_ID,
          });

          const claims = result.payload;
          if (!claims.sub || !claims.email) {
            response.setHeader('WWW-Authenticate', 'expired_token');
            throw new UnauthorizedException('Invalid OIDC token claims');
          }

          payload = {
            sub: claims.sub,
            email: claims.email as string,
            name: claims.name as string,
          };
          isValidToken = true;
        } catch (oidcErr) {
          response.setHeader('WWW-Authenticate', 'expired_token');
          throw new UnauthorizedException('Invalid or expired token');
        }
      } else if (!isValidToken) {
        // JWT verification failed and no OIDC configured
        response.setHeader('WWW-Authenticate', 'expired_token');
        throw new UnauthorizedException('Invalid or expired token');
      } else {
        // Token was valid but payload validation failed
        throw err;
      }
    }

    // For user tokens, validate user exists
    const user = await prisma.user.findFirst({
      where: { email: payload.email },
      select: {
        id: true,
        firstname: true,
        lastname: true,
        email: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    request.user = {
      ...user,
      accessToken: token,
    } as CurrentUser;

    return true;
  }

  private isAllowedAnonymous(
    reflector: Reflector,
    context: ExecutionContext,
  ): boolean {
    return !!reflector.getAllAndOverride<boolean>('allowAnonymous', [
      context.getHandler(),
      context.getClass(),
    ]);
  }
}

