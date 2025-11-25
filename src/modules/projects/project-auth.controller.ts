import { Body, Controller, Post, Get, Query, UseGuards, Request } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import prisma from '@/prisma/prisma.service';
import { VerifyProjectOtpDto, ProjectLoginDto, ChangeProjectPasswordDto, VerifyOtpLinkDto, SetPasswordFromLinkDto } from './dto/project-auth.dto';
import { ProjectAuthGuard } from '@/guards/project-auth.guard';
import { AllowAnonymous } from '@/decorators/allow-anonymous.decorator';

@Controller('project-auth')
export class ProjectAuthController {
  constructor(private jwtService: JwtService) {}

  @AllowAnonymous()
  @Post('verify-otp')
  async verifyOtp(@Body() dto: VerifyProjectOtpDto) {
    const project = await prisma.project.findUnique({
      where: { email: dto.email },
    });

    if (!project) {
      return { success: false, message: 'Project not found' };
    }

    if (!project.otp || !project.otpExpiry) {
      return { success: false, message: 'No OTP found for this project' };
    }

    if (new Date() > project.otpExpiry) {
      return { success: false, message: 'OTP has expired' };
    }

    if (project.otp !== dto.otp) {
      return { success: false, message: 'Invalid OTP' };
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Update project with password and mark OTP as used
    await prisma.project.update({
      where: { id: project.id },
      data: {
        password: hashedPassword,
        otp: null,
        otpExpiry: null,
        isPasswordChanged: true,
      },
    });

    // Generate JWT token
    const payload = { projectId: project.id, email: project.email, type: 'project' };
    const token = this.jwtService.sign(payload);

    return {
      success: true,
      message: 'Password set successfully',
      token,
      project: {
        id: project.id,
        name: project.name,
        email: project.email,
      },
    };
  }

  @AllowAnonymous()
  @Post('login')
  async login(@Body() dto: ProjectLoginDto) {
    const project = await prisma.project.findUnique({
      where: { email: dto.email },
    });

    if (!project) {
      return { success: false, message: 'Invalid credentials' };
    }

    if (!project.password) {
      return {
        success: false,
        message: 'Please verify your OTP first to set a password',
        requiresOTP: true
      };
    }

    const isPasswordValid = await bcrypt.compare(dto.password, project.password);

    if (!isPasswordValid) {
      return { success: false, message: 'Invalid credentials' };
    }

    // Generate JWT token
    const payload = { projectId: project.id, email: project.email, type: 'project' };
    const token = this.jwtService.sign(payload);

    return {
      success: true,
      message: 'Login successful',
      token,
      requiresPasswordChange: !project.isPasswordChanged, // Flag for first-time login
      project: {
        id: project.id,
        name: project.name,
        email: project.email,
        isPasswordChanged: project.isPasswordChanged,
      },
    };
  }

  @AllowAnonymous()
  @Post('change-password')
  @UseGuards(ProjectAuthGuard)
  async changePassword(@Request() req: any, @Body() dto: ChangeProjectPasswordDto) {
    const project = await prisma.project.findUnique({
      where: { id: req.project.projectId },
    });

    if (!project || !project.password) {
      return { success: false, message: 'Project not found' };
    }

    const isCurrentPasswordValid = await bcrypt.compare(dto.currentPassword, project.password);

    if (!isCurrentPasswordValid) {
      return { success: false, message: 'Current password is incorrect' };
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    await prisma.project.update({
      where: { id: project.id },
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
    const project = await prisma.project.findUnique({
      where: { email: query.email },
    });

    if (!project) {
      return {
        success: false,
        message: 'Project not found',
        redirectUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-otp?error=project_not_found`
      };
    }

    if (!project.otp || !project.otpExpiry) {
      return {
        success: false,
        message: 'No OTP found for this project',
        redirectUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-otp?error=no_otp`
      };
    }

    if (new Date() > project.otpExpiry) {
      return {
        success: false,
        message: 'OTP has expired',
        redirectUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-otp?error=otp_expired`
      };
    }

    if (project.otp !== query.otp) {
      return {
        success: false,
        message: 'Invalid OTP',
        redirectUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-otp?error=invalid_otp`
      };
    }

    // OTP is valid - return success with project info
    return {
      success: true,
      message: 'OTP verified successfully. Please set your password.',
      project: {
        id: project.id,
        name: project.name,
        email: project.email,
      },
      // Include email and otp for frontend to use
      email: project.email,
      otp: query.otp,
    };
  }

  @AllowAnonymous()
  @Post('set-password-from-link')
  async setPasswordFromLink(@Body() dto: SetPasswordFromLinkDto) {
    const project = await prisma.project.findUnique({
      where: { email: dto.email },
    });

    if (!project) {
      return { success: false, message: 'Project not found' };
    }

    if (!project.otp || !project.otpExpiry) {
      return { success: false, message: 'No OTP found for this project' };
    }

    if (new Date() > project.otpExpiry) {
      return { success: false, message: 'OTP has expired' };
    }

    if (project.otp !== dto.otp) {
      return { success: false, message: 'Invalid OTP' };
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Update project with password and mark OTP as used
    await prisma.project.update({
      where: { id: project.id },
      data: {
        password: hashedPassword,
        otp: null,
        otpExpiry: null,
        isPasswordChanged: true,
      },
    });

    // Generate JWT token
    const payload = { projectId: project.id, email: project.email, type: 'project' };
    const token = this.jwtService.sign(payload);

    return {
      success: true,
      message: 'Password set successfully',
      token,
      project: {
        id: project.id,
        name: project.name,
        email: project.email,
      },
    };
  }
}

