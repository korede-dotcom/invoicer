import { Body, Controller, Post, Get, Query, UseGuards, Request } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import prisma from '@/prisma/prisma.service';
import { ClientVerifyOtpDto, ClientLoginDto, ClientChangePasswordDto, VerifyOtpLinkDto, SetPasswordFromLinkDto } from './dto/client-auth.dto';
import { ClientAuthGuard } from '@/guards/client-auth.guard';
import { AllowAnonymous } from '@/decorators/allow-anonymous.decorator';
import { AuthService } from '@/modules/auth/auth.service';

@Controller('client-auth')
export class ClientAuthController {
  constructor(private jwtService: JwtService) {}

  @AllowAnonymous()
  @Post('verify-otp')
  async verifyOtp(@Body() dto: ClientVerifyOtpDto) {
    const client = await prisma.client.findUnique({
      where: { contactEmail: dto.email },
    });

    if (!client) {
      return { success: false, message: 'Client not found' };
    }

    if (!client.otp || !client.otpExpiry) {
      return { success: false, message: 'No OTP found for this client' };
    }

    if (new Date() > client.otpExpiry) {
      return { success: false, message: 'OTP has expired' };
    }

    if (client.otp !== dto.otp) {
      return { success: false, message: 'Invalid OTP' };
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Update client with password and mark OTP as used
    await prisma.client.update({
      where: { id: client.id },
      data: {
        password: hashedPassword,
        otp: null,
        otpExpiry: null,
        isPasswordChanged: true,
      },
    });

    // Generate JWT token
    const payload = { clientId: client.id, email: client.contactEmail, type: 'client' };
    const token = this.jwtService.sign(payload, {
      secret: AuthService.getJWTSecret(),
      expiresIn: '7d',
    });

    return {
      success: true,
      message: 'Password set successfully',
      token,
      client: {
        id: client.id,
        name: client.name,
        email: client.contactEmail,
      },
    };
  }

  @AllowAnonymous()
  @Post('login')
  async login(@Body() dto: ClientLoginDto) {
    const client = await prisma.client.findUnique({
      where: { contactEmail: dto.email },
    });

    if (!client) {
      return { success: false, message: 'Invalid credentials' };
    }

    if (!client.password) {
      return {
        success: false,
        message: 'Please verify your OTP first to set a password',
        requiresOTP: true
      };
    }

    const isPasswordValid = await bcrypt.compare(dto.password, client.password);

    if (!isPasswordValid) {
      return { success: false, message: 'Invalid credentials' };
    }

    // Generate JWT token
    const payload = { clientId: client.id, email: client.contactEmail, type: 'client' };
    const token = this.jwtService.sign(payload, {
      secret: AuthService.getJWTSecret(),
      expiresIn: '7d',
    });

    return {
      success: true,
      message: 'Login successful',
      token,
      requiresPasswordChange: !client.isPasswordChanged, // Flag for first-time login
      client: {
        id: client.id,
        name: client.name,
        email: client.contactEmail,
        isPasswordChanged: client.isPasswordChanged,
      },
    };
  }

  @AllowAnonymous()
  @Post('change-password')
  @UseGuards(ClientAuthGuard)
  async changePassword(@Request() req: any, @Body() dto: ClientChangePasswordDto) {
    const client = await prisma.client.findUnique({
      where: { id: req.client.clientId },
    });

    if (!client || !client.password) {
      return { success: false, message: 'Client not found' };
    }

    const isCurrentPasswordValid = await bcrypt.compare(dto.currentPassword, client.password);

    if (!isCurrentPasswordValid) {
      return { success: false, message: 'Current password is incorrect' };
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    await prisma.client.update({
      where: { id: client.id },
      data: {
        password: hashedPassword,
        isPasswordChanged: true, // Mark password as changed
      },
    });

    return {
      success: true,
      message: 'Password changed successfully',
    };
  }

  @AllowAnonymous()
  @Get('verify-otp-link')
  async verifyOtpLink(@Query() query: VerifyOtpLinkDto) {
    const client = await prisma.client.findUnique({
      where: { contactEmail: query.email },
    });

    if (!client) {
      return {
        success: false,
        message: 'Client not found',
        redirectUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-otp?error=client_not_found`
      };
    }

    if (!client.otp || !client.otpExpiry) {
      return {
        success: false,
        message: 'No OTP found for this client',
        redirectUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-otp?error=no_otp`
      };
    }

    if (new Date() > client.otpExpiry) {
      return {
        success: false,
        message: 'OTP has expired',
        redirectUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-otp?error=otp_expired`
      };
    }

    if (client.otp !== query.otp) {
      return {
        success: false,
        message: 'Invalid OTP',
        redirectUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-otp?error=invalid_otp`
      };
    }

    // OTP is valid - return success with client info
    return {
      success: true,
      message: 'OTP verified successfully. Please set your password.',
      client: {
        id: client.id,
        name: client.name,
        email: client.contactEmail,
      },
      // Include email and otp for frontend to use
      email: client.contactEmail,
      otp: query.otp,
    };
  }

  @AllowAnonymous()
  @Post('set-password-from-link')
  async setPasswordFromLink(@Body() dto: SetPasswordFromLinkDto) {
    const client = await prisma.client.findUnique({
      where: { contactEmail: dto.email },
    });

    if (!client) {
      return { success: false, message: 'Client not found' };
    }

    if (!client.otp || !client.otpExpiry) {
      return { success: false, message: 'No OTP found for this client' };
    }

    if (new Date() > client.otpExpiry) {
      return { success: false, message: 'OTP has expired' };
    }

    if (client.otp !== dto.otp) {
      return { success: false, message: 'Invalid OTP' };
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Update client with password and mark OTP as used
    await prisma.client.update({
      where: { id: client.id },
      data: {
        password: hashedPassword,
        otp: null,
        otpExpiry: null,
        isPasswordChanged: true,
      },
    });

    // Generate JWT token
    const payload = { clientId: client.id, email: client.contactEmail, type: 'client' };
    const token = this.jwtService.sign(payload, {
      secret: AuthService.getJWTSecret(),
      expiresIn: '7d',
    });

    return {
      success: true,
      message: 'Password set successfully',
      token,
      client: {
        id: client.id,
        name: client.name,
        email: client.contactEmail,
      },
    };
  }
}


