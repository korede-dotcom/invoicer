import {
  Controller,
  Get,
  Query,
  Request,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ClientAuthGuard } from '@/guards/client-auth.guard';
import { UnifiedAuthGuard } from '@/guards/unified-auth.guard';
import prisma from '@/prisma/prisma.service';

@Controller('client-portal')
@UseGuards(ClientAuthGuard)
export class ClientPortalController {
  private prisma = prisma;
  @Get('profile')
  async getProfile(@Request() req) {
    const clientId = req.client.clientId;

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        name: true,
        description: true,
        legalId: true,
        VAT: true,
        foundedAt: true,
        contactFirstname: true,
        contactLastname: true,
        contactEmail: true,
        contactPhone: true,
        address: true,
        postalCode: true,
        city: true,
        country: true,
        currency: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!client) {
      return {
        success: false,
        message: 'Client not found',
      };
    }

    return {
      success: true,
      client,
    };
  }

  @Get('quotes')
  async getQuotes(
    @Request() req,
    @Query('page') page?: string,
    @Query('status') status?: string,
  ) {
    const clientId = req.client.clientId;
    const pageNumber = parseInt(page || '1', 10);
    const pageSize = 10;
    const skip = (pageNumber - 1) * pageSize;

    const whereClause: any = {
      clientId,
      isActive: true,
    };

    if (status) {
      whereClause.status = status;
    }

    const [quotes, totalQuotes] = await Promise.all([
      prisma.quote.findMany({
        where: whereClause,
        include: {
          items: true,
          company: {
            select: {
              name: true,
              email: true,
              phone: true,
              address: true,
              city: true,
              country: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.quote.count({ where: whereClause }),
    ]);

    return {
      success: true,
      quotes,
      pageCount: Math.ceil(totalQuotes / pageSize),
      currentPage: pageNumber,
      totalQuotes,
    };
  }

  @Get('invoices')
  async getInvoices(
    @Request() req,
    @Query('page') page?: string,
    @Query('status') status?: string,
  ) {
    const clientId = req.client.clientId;
    const pageNumber = parseInt(page || '1', 10);
    const pageSize = 10;
    const skip = (pageNumber - 1) * pageSize;

    const whereClause: any = {
      clientId,
      isActive: true,
    };

    if (status) {
      whereClause.status = status;
    }

    const [invoices, totalInvoices] = await Promise.all([
      prisma.invoice.findMany({
        where: whereClause,
        include: {
          items: true,
          company: {
            select: {
              name: true,
              email: true,
              phone: true,
              address: true,
              city: true,
              country: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.invoice.count({ where: whereClause }),
    ]);

    return {
      success: true,
      invoices,
      pageCount: Math.ceil(totalInvoices / pageSize),
      currentPage: pageNumber,
      totalInvoices,
    };
  }

  @Get('dashboard')
  @UseGuards(UnifiedAuthGuard)
  async getDashboard(
    @Request() req,
    @Query('currency') currency?: string,
    @Query('clientId') queryClientId?: string,
  ) {
    // Determine clientId based on token type
    let clientId: string;

    if (req.client) {
      // Client token - use clientId from token
      clientId = req.client.clientId;
    } else if (req.user) {
      // Admin token - require clientId query parameter
      if (!queryClientId) {
        throw new BadRequestException('clientId query parameter is required for admin access');
      }
      clientId = queryClientId;
      console.log(`📊 Admin ${req.user.email} accessing dashboard for client ${clientId}`);
    } else {
      throw new BadRequestException('Invalid authentication');
    }

    // Build currency filter
    const currencyFilter = currency ? { currency: currency as any } : {};

    // Get client info
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        name: true,
        contactEmail: true,
        currency: true,
      },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    // Get company information from the first quote or invoice
    let company: any = null;
    const firstQuote = await this.prisma.quote.findFirst({
      where: { clientId },
      select: {
        company: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            country: true,
            currency: true,
          },
        },
      },
    });

    if (firstQuote?.company) {
      company = firstQuote.company;
    } else {
      // Try to get from invoice if no quote found
      const firstInvoice = await this.prisma.invoice.findFirst({
        where: { clientId },
        select: {
          company: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              address: true,
              city: true,
              country: true,
              currency: true,
            },
          },
        },
      });

      if (firstInvoice?.company) {
        company = firstInvoice.company;
      }
    }

    if (!client) {
      return {
        success: false,
        message: 'Client not found',
      };
    }

    // Quote statistics with groupBy
    const quotes = await prisma.quote.groupBy({
      where: {
        ...currencyFilter,
        clientId,
        isActive: true,
      },
      by: ['status'],
      _count: true,
    });

    // Invoice statistics with groupBy
    const invoices = await prisma.invoice.groupBy({
      where: {
        ...currencyFilter,
        clientId,
        isActive: true,
      },
      by: ['status'],
      _count: true,
    });

    // Recent quotes (last 5)
    const latestQuotes = await prisma.quote.findMany({
      where: {
        ...currencyFilter,
        clientId,
        isActive: true,
      },
      include: {
        items: true,
        company: {
          select: {
            name: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            country: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });

    // Recent invoices (last 5)
    const latestInvoices = await prisma.invoice.findMany({
      where: {
        ...currencyFilter,
        clientId,
        isActive: true,
      },
      include: {
        items: true,
        company: {
          select: {
            name: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            country: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });

    // Calculate total amount for last 6 months
    const last6Months = await Promise.all(
      Array.from({ length: 6 }).map(async (_, i) => {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        const endOfMonth = new Date(
          date.getFullYear(),
          date.getMonth() + 1,
          0,
        );

        const monthlyInvoices = await prisma.invoice.findMany({
          where: {
            ...currencyFilter,
            clientId,
            createdAt: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
            status: 'PAID',
          },
        });

        const total = monthlyInvoices.reduce(
          (sum, inv) => sum + inv.totalTTC,
          0,
        );

        return {
          createdAt: new Date(date.getFullYear(), date.getMonth(), 1),
          total,
        };
      }),
    );

    // Current month spending
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);
    const currentMonthEnd = new Date(
      currentMonthStart.getFullYear(),
      currentMonthStart.getMonth() + 1,
      0,
    );

    const currentMonthInvoices = await prisma.invoice.findMany({
      where: {
        ...currencyFilter,
        clientId,
        createdAt: { gte: currentMonthStart, lte: currentMonthEnd },
        status: 'PAID',
      },
    });
    const currentMonthSpending = currentMonthInvoices.reduce(
      (sum, inv) => sum + inv.totalTTC,
      0,
    );

    // Previous month spending
    const previousMonthStart = new Date();
    previousMonthStart.setMonth(previousMonthStart.getMonth() - 1);
    previousMonthStart.setDate(1);
    previousMonthStart.setHours(0, 0, 0, 0);
    const previousMonthEnd = new Date(
      previousMonthStart.getFullYear(),
      previousMonthStart.getMonth() + 1,
      0,
    );

    const previousMonthInvoices = await prisma.invoice.findMany({
      where: {
        ...currencyFilter,
        clientId,
        createdAt: { gte: previousMonthStart, lte: previousMonthEnd },
        status: 'PAID',
      },
    });
    const previousMonthSpending = previousMonthInvoices.reduce(
      (sum, inv) => sum + inv.totalTTC,
      0,
    );

    const monthlyChange = currentMonthSpending - previousMonthSpending;
    const monthlyChangePercent =
      previousMonthSpending === 0
        ? currentMonthSpending > 0
          ? 100
          : 0
        : ((currentMonthSpending - previousMonthSpending) /
            Math.abs(previousMonthSpending)) *
          100;

    // Total unpaid amount
    const unpaidInvoices = await prisma.invoice.findMany({
      where: {
        ...currencyFilter,
        clientId,
        status: { in: ['UNPAID', 'SENT', 'OVERDUE'] },
        isActive: true,
      },
    });
    const totalUnpaid = unpaidInvoices.reduce(
      (sum, inv) => sum + inv.totalTTC,
      0,
    );

    // Total paid amount (all time)
    const paidInvoices = await prisma.invoice.findMany({
      where: {
        ...currencyFilter,
        clientId,
        status: 'PAID',
        isActive: true,
      },
    });
    const totalPaid = paidInvoices.reduce((sum, inv) => sum + inv.totalTTC, 0);

    return {
      success: true,
      client: {
        id: client.id,
        name: client.name,
        email: client.contactEmail,
        currency: client.currency,
      },
      company: company,
      quotes: {
        total: quotes.reduce((acc, q) => acc + q._count, 0),
        draft: quotes.find((q) => q.status === 'DRAFT')?._count || 0,
        sent: quotes.find((q) => q.status === 'SENT')?._count || 0,
        signed: quotes.find((q) => q.status === 'SIGNED')?._count || 0,
        expired: quotes.find((q) => q.status === 'EXPIRED')?._count || 0,
        latests: latestQuotes,
      },
      invoices: {
        total: invoices.reduce((acc, i) => acc + i._count, 0),
        unpaid: invoices.find((i) => i.status === 'UNPAID')?._count || 0,
        sent: invoices.find((i) => i.status === 'SENT')?._count || 0,
        paid: invoices.find((i) => i.status === 'PAID')?._count || 0,
        overdue: invoices.find((i) => i.status === 'OVERDUE')?._count || 0,
        latests: latestInvoices,
      },
      spending: {
        last6Months,
        currentMonth: currentMonthSpending,
        previousMonth: previousMonthSpending,
        monthlyChange,
        monthlyChangePercent,
        totalUnpaid,
        totalPaid,
      },
    };
  }
}

