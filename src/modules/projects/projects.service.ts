import { BadRequestException, Injectable } from '@nestjs/common';
import prisma from '@/prisma/prisma.service';
import { CreateProjectDto, EditProjectDto, SearchProjectDto } from './dto/projects.dto';
import { MailService } from '@/mail/mail.service';

@Injectable()
export class ProjectsService {
  constructor(private readonly mailService: MailService) {}

  async createProject(data: CreateProjectDto) {
    // Check if email already exists
    const existingProject = await prisma.project.findUnique({
      where: { email: data.email },
    });

    if (existingProject) {
      throw new BadRequestException('A project with this email already exists');
    }

    // Generate OTP (6-digit code)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    console.log(`🔑 Generated OTP for ${data.email}: ${otp}`);

    const project = await prisma.project.create({
      data: {
        name: data.name,
        email: data.email,
        projectType: data.projectType,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        otp,
        otpExpiry,
      },
    });

    // Send welcome email with OTP
    try {
      if (project.email) {
        await this.mailService.sendProjectWelcomeEmail(
          project.email,
          project.name,
          otp,
        );
      }
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      // Don't fail the project creation if email fails
    }

    // Don't return sensitive data in production
    // In development, return OTP for testing
    const { password: ___, ...projectData } = project;

    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production') {
      return { ...projectData, otp }; // Include OTP for testing
    }

    const { otp: _, otpExpiry: __, ...safeProjectData } = projectData;
    return safeProjectData;
  }

  async getProjects() {
    const projects = await prisma.project.findMany({
      where: { isActive: true },
      include: {
        clients: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            contactEmail: true,
            contactFirstname: true,
            contactLastname: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return projects;
  }

  async getProjectById(id: string) {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        clients: {
          where: { isActive: true },
          include: {
            Quote: true,
            Invoice: true,
          },
        },
      },
    });

    if (!project) {
      throw new BadRequestException('Project not found');
    }

    return project;
  }

  async updateProject(data: EditProjectDto) {
    const project = await prisma.project.update({
      where: { id: data.id },
      data: {
        name: data.name,
        projectType: data.projectType,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
      },
    });

    return project;
  }

  async deleteProject(id: string) {
    // Soft delete
    const project = await prisma.project.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Project deleted successfully', project };
  }

  async searchProjects(filters: SearchProjectDto) {
    const where: any = { isActive: true };

    if (filters.query) {
      where.OR = [
        { name: { contains: filters.query, mode: 'insensitive' } },
        { projectType: { contains: filters.query, mode: 'insensitive' } },
        { address: { contains: filters.query, mode: 'insensitive' } },
        { city: { contains: filters.query, mode: 'insensitive' } },
        { state: { contains: filters.query, mode: 'insensitive' } },
        { country: { contains: filters.query, mode: 'insensitive' } },
      ];
    }

    if (filters.projectType) {
      where.projectType = { contains: filters.projectType, mode: 'insensitive' };
    }

    if (filters.country) {
      where.country = { contains: filters.country, mode: 'insensitive' };
    }

    if (filters.state) {
      where.state = { contains: filters.state, mode: 'insensitive' };
    }

    if (filters.city) {
      where.city = { contains: filters.city, mode: 'insensitive' };
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(filters.endDate);
      }
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        clients: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            contactEmail: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return projects;
  }

  async getProjectAnalytics(projectId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new BadRequestException('Project not found');
    }

    // Get company info
    const company = await prisma.company.findFirst();

    // Quote statistics with groupBy
    const quotes = await prisma.quote.groupBy({
      where: {
        isActive: true,
        client: {
          projectId,
        },
      },
      by: ['status'],
      _count: true,
    });

    // Invoice statistics with groupBy
    const invoices = await prisma.invoice.groupBy({
      where: {
        isActive: true,
        client: {
          projectId,
        },
      },
      by: ['status'],
      _count: true,
    });

    // Count clients for this project
    const clientsCount = await prisma.client.count({
      where: {
        projectId,
        isActive: true,
      },
    });

    // Recent quotes (last 5)
    const latestQuotes = await prisma.quote.findMany({
      where: {
        client: {
          projectId,
        },
        isActive: true,
      },
      include: {
        client: true,
        company: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });

    // Recent invoices (last 5)
    const latestInvoices = await prisma.invoice.findMany({
      where: {
        client: {
          projectId,
        },
        isActive: true,
      },
      include: {
        client: true,
        company: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });

    // Calculate revenue for last 6 months
    const last6Months = await Promise.all(Array.from({ length: 6 }).map(async (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const monthlyInvoices = await prisma.invoice.findMany({
        where: {
          client: {
            projectId,
          },
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
          status: 'PAID',
        },
      });

      const total = monthlyInvoices.reduce((sum, inv) => sum + inv.totalTTC, 0);

      return {
        createdAt: new Date(date.getFullYear(), date.getMonth(), 1),
        total,
      };
    }));

    // Current month revenue
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);
    const currentMonthEnd = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() + 1, 0);

    const currentMonthInvoices = await prisma.invoice.findMany({
      where: {
        client: { projectId },
        createdAt: { gte: currentMonthStart, lte: currentMonthEnd },
        status: 'PAID',
      },
    });
    const currentMonthRevenue = currentMonthInvoices.reduce((sum, inv) => sum + inv.totalTTC, 0);

    // Previous month revenue
    const previousMonthStart = new Date();
    previousMonthStart.setMonth(previousMonthStart.getMonth() - 1);
    previousMonthStart.setDate(1);
    previousMonthStart.setHours(0, 0, 0, 0);
    const previousMonthEnd = new Date(previousMonthStart.getFullYear(), previousMonthStart.getMonth() + 1, 0);

    const previousMonthInvoices = await prisma.invoice.findMany({
      where: {
        client: { projectId },
        createdAt: { gte: previousMonthStart, lte: previousMonthEnd },
        status: 'PAID',
      },
    });
    const previousMonthRevenue = previousMonthInvoices.reduce((sum, inv) => sum + inv.totalTTC, 0);

    const monthlyChange = currentMonthRevenue - previousMonthRevenue;
    const monthlyChangePercent = previousMonthRevenue === 0
      ? (currentMonthRevenue > 0 ? 100 : 0)
      : ((currentMonthRevenue - previousMonthRevenue) / Math.abs(previousMonthRevenue)) * 100;

    // Return data in the same format as main dashboard
    return {
      company: company || { name: project.name },
      quotes: {
        total: quotes.reduce((acc, q) => acc + q._count, 0),
        draft: quotes.find(q => q.status === 'DRAFT')?._count || 0,
        sent: quotes.find(q => q.status === 'SENT')?._count || 0,
        signed: quotes.find(q => q.status === 'SIGNED')?._count || 0,
        expired: quotes.find(q => q.status === 'EXPIRED')?._count || 0,
        latests: latestQuotes,
      },
      invoices: {
        total: invoices.reduce((acc, i) => acc + i._count, 0),
        unpaid: invoices.find(i => i.status === 'UNPAID')?._count || 0,
        sent: invoices.find(i => i.status === 'SENT')?._count || 0,
        paid: invoices.find(i => i.status === 'PAID')?._count || 0,
        overdue: invoices.find(i => i.status === 'OVERDUE')?._count || 0,
        latests: latestInvoices,
      },
      clients: {
        total: clientsCount,
      },
      projects: {
        total: 0, // Projects don't have sub-projects
      },
      revenue: {
        last6Months,
        currentMonth: currentMonthRevenue,
        previousMonth: previousMonthRevenue,
        monthlyChange,
        monthlyChangePercent,
        last6Years: [], // Not needed for project view
        currentYear: 0,
        previousYear: 0,
        yearlyChange: 0,
        yearlyChangePercent: 0,
      }
    };
  }

  async getClientsByProjectId(projectId: string) {
    const clients = await prisma.client.findMany({
      where: {
        projectId,
        isActive: true,
      },
      include: {
        Quote: {
          where: { isActive: true },
        },
        Invoice: {
          where: { isActive: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return clients;
  }
}

