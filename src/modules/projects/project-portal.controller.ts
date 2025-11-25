import { Controller, Get, Request, Query } from '@nestjs/common';
import prisma from '@/prisma/prisma.service';

@Controller('project-portal')
export class ProjectPortalController {
  constructor() {}
  @Get('profile')
  async getProfile(@Request() req) {
    const project = await prisma.project.findUnique({
      where: { id: req.project.projectId },
      select: {
        id: true,
        name: true,
        email: true,
        projectType: true,
        address: true,
        city: true,
        state: true,
        country: true,
        createdAt: true,
        isPasswordChanged: true,
      },
    });

    return { success: true, project };
  }

  @Get('clients')
  async getClients(@Request() req, @Query('page') page?: string) {
    const pageNumber = parseInt(page || '1', 10);
    const pageSize = 10;
    const skip = (pageNumber - 1) * pageSize;

    const where = {
      projectId: req.project.projectId,
      isActive: true,
    };

    const clients = await prisma.client.findMany({
      where,
      skip,
      take: pageSize,
      select: {
        id: true,
        name: true,
        description: true,
        contactEmail: true,
        contactFirstname: true,
        contactLastname: true,
        contactPhone: true,
        address: true,
        city: true,
        country: true,
        currency: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalClients = await prisma.client.count({ where });

    return {
      success: true,
      clients,
      pageCount: Math.ceil(totalClients / pageSize),
      currentPage: pageNumber,
      totalClients
    };
  }

  @Get('quotes')
  async getQuotes(
    @Request() req,
    @Query('status') status?: string,
    @Query('page') page?: string
  ) {
    const pageNumber = parseInt(page || '1', 10);
    const pageSize = 10;
    const skip = (pageNumber - 1) * pageSize;

    const where: any = {
      client: {
        projectId: req.project.projectId,
      },
      isActive: true,
    };

    if (status) {
      where.status = status;
    }

    const quotes = await prisma.quote.findMany({
      where,
      skip,
      take: pageSize,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            contactEmail: true,
          },
        },
        items: true,
        company: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalQuotes = await prisma.quote.count({ where });

    return {
      success: true,
      quotes,
      pageCount: Math.ceil(totalQuotes / pageSize),
      currentPage: pageNumber,
      totalQuotes
    };
  }

  @Get('invoices')
  async getInvoices(
    @Request() req,
    @Query('status') status?: string,
    @Query('page') page?: string
  ) {
    const pageNumber = parseInt(page || '1', 10);
    const pageSize = 10;
    const skip = (pageNumber - 1) * pageSize;

    const where: any = {
      client: {
        projectId: req.project.projectId,
      },
      isActive: true,
    };

    if (status) {
      where.status = status;
    }

    const invoices = await prisma.invoice.findMany({
      where,
      skip,
      take: pageSize,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            contactEmail: true,
          },
        },
        items: true,
        company: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalInvoices = await prisma.invoice.count({ where });

    return {
      success: true,
      invoices,
      pageCount: Math.ceil(totalInvoices / pageSize),
      currentPage: pageNumber,
      totalInvoices
    };
  }

  @Get('analytics')
  async getAnalytics(
    @Request() req,
    @Query('currency') currency?: string,
    @Query('period') period?: string
  ) {
    const projectId = req.project.projectId;

    // Build currency filter
    const currencyFilter = currency ? { currency: currency as any } : {};

    // Get project info
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    // Get company info
    const company = await prisma.company.findFirst();

    // Quote statistics with groupBy
    const quotes = await prisma.quote.groupBy({
      where: {
        ...currencyFilter,
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
        ...currencyFilter,
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
        ...currencyFilter,
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
        ...currencyFilter,
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
          ...currencyFilter,
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
        ...currencyFilter,
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
        ...currencyFilter,
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
      company: company || { name: project?.name || 'Project' },
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

}

