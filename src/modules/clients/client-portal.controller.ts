import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ClientAuthGuard } from '@/guards/client-auth.guard';
import prisma from '@/prisma/prisma.service';

@Controller('client-portal')
@UseGuards(ClientAuthGuard)
export class ClientPortalController {
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
}

