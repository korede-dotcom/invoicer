import { AllowAnonymous } from '@/decorators/allow-anonymous.decorator';
import { Body, Controller, Post, Res } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import prisma from '@/prisma/prisma.service';
import { Response } from 'express';
import { AuthService } from './auth.service';

interface UnifiedLoginDto {
  email: string;
  password: string;
}

@Controller('unified-auth')
export class UnifiedLoginController {
  isHttps: boolean;

  constructor(
    private jwtService: JwtService,
    private authService: AuthService,
  ) {
    if (process.env?.APP_URL !== undefined) {
      this.isHttps = process.env.APP_URL.startsWith('https');
    } else {
      this.isHttps = true;
    }
  }

  @AllowAnonymous()
  @Post('login')
  async unifiedLogin(@Body() dto: UnifiedLoginDto, @Res() res: Response) {
    const { email, password } = dto;

    // First, try to find a user (admin)
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      // Admin login
      if (!user.password || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
        });
      }

      // Generate admin tokens
      const payload = { sub: user.id, email: user.email };
      const accessToken = this.jwtService.sign(payload, {
        secret: AuthService.getJWTSecret(),
        expiresIn: '15m',
      });
      const refreshToken = this.jwtService.sign(payload, {
        secret: AuthService.getJWTSecret(),
        expiresIn: '7d',
      });

      // Set cookies
      res.cookie('access_token', accessToken, {
        httpOnly: true,
        secure: this.isHttps,
      });
      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: this.isHttps,
      });

      return res.json({
        success: true,
        message: 'Login successful',
        userType: 'admin',
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          id: user.id,
          firstname: user.firstname,
          lastname: user.lastname,
          email: user.email,
        },
      });
    }

    // If not a user, try to find a client
    const client = await prisma.client.findUnique({ where: { contactEmail: email } });

    if (client) {
      // Client login
      if (!client.password) {
        return res.status(401).json({
          success: false,
          message: 'Please verify your OTP first to set a password',
          requiresOTP: true,
          userType: 'client',
        });
      }

      const isPasswordValid = await bcrypt.compare(password, client.password);

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
        });
      }

      // Generate client token
      const payload = { clientId: client.id, email: client.contactEmail, type: 'client' };
      const token = this.jwtService.sign(payload, {
        secret: AuthService.getJWTSecret(),
        expiresIn: '7d',
      });

      return res.json({
        success: true,
        message: 'Login successful',
        userType: 'client',
        token,
        requiresPasswordChange: !client.isPasswordChanged,
        client: {
          id: client.id,
          name: client.name,
          email: client.contactEmail,
          isPasswordChanged: client.isPasswordChanged,
        },
      });
    }

    // If not a client, try to find a project
    const project = await prisma.project.findUnique({ where: { email } });

    if (project) {
      // Project login
      if (!project.password) {
        return res.status(401).json({
          success: false,
          message: 'Please verify your OTP first to set a password',
          requiresOTP: true,
          userType: 'project',
        });
      }

      const isPasswordValid = await bcrypt.compare(password, project.password);

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
        });
      }

      // Generate project token
      const payload = { projectId: project.id, email: project.email, type: 'project' };
      const token = this.jwtService.sign(payload, {
        secret: AuthService.getJWTSecret(),
        expiresIn: '7d',
      });

      return res.json({
        success: true,
        message: 'Login successful',
        userType: 'project',
        token,
        requiresPasswordChange: !project.isPasswordChanged,
        project: {
          id: project.id,
          name: project.name,
          email: project.email,
          isPasswordChanged: project.isPasswordChanged,
        },
      });
    }

    // Neither user, client, nor project found
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials',
    });
  }
}

