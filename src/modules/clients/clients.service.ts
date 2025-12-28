import { EditClientsDto, SearchClientsDto } from '@/modules/clients/dto/clients.dto';
import prisma from '@/prisma/prisma.service';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MailService } from '@/mail/mail.service';

@Injectable()
export class ClientsService {
    constructor(
        private readonly mailService: MailService,
    ) {}

    async getClients(page: string) {
        const pageNumber = parseInt(page, 10) || 1;
        const pageSize = 10;
        const skip = (pageNumber - 1) * pageSize;

        const clients = await prisma.client.findMany({
            skip,
            take: pageSize,
            orderBy: {
                name: 'asc',
            },
        });

        const totalClients = await prisma.client.count();

        return { pageCount: Math.ceil(totalClients / pageSize), clients };
    }

    async searchClients(query: string) {
        if (!query) {
            return prisma.client.findMany({
                where: { isActive: true },
                take: 10,
                orderBy: {
                    name: 'asc',
                },
            });
        }

        return prisma.client.findMany({
            where: {
                isActive: true,
                OR: [
                    { name: { contains: query } },
                    { contactFirstname: { contains: query } },
                    { contactLastname: { contains: query } },
                    { contactEmail: { contains: query } },
                    { contactPhone: { contains: query } },
                    { address: { contains: query } },
                    { postalCode: { contains: query } },
                    { city: { contains: query } },
                    { country: { contains: query } },
                ],
            },
            take: 10,
            orderBy: {
                name: 'asc',
            },
        });
    }

    async createClient(editClientsDto: EditClientsDto) {
        const { id, ...data } = editClientsDto;

        // Check if client with this email already exists
        const existingClient = await prisma.client.findUnique({
            where: { contactEmail: data.contactEmail },
        });

        if (existingClient) {
            throw new BadRequestException('A client with this email already exists');
        }

        // Generate OTP for client portal access
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = new Date();
        otpExpiry.setHours(otpExpiry.getHours() + 24); // OTP valid for 24 hours

        console.log(`📝 Creating client: ${data.name} (${data.contactEmail})${data.projectId ? ` under project ${data.projectId}` : ''}`);

        // Create client with OTP
        const client = await prisma.client.create({
            data: {
                ...data,
                otp,
                otpExpiry,
                isActive: true,
            }
        });

        console.log(`✅ Client created successfully: ${client.id}`);

        // Send welcome email with OTP to the new client
        try {
            console.log(`📧 Sending welcome email with OTP to ${client.contactEmail}...`);
            await this.sendClientWelcomeEmail(client.contactEmail, client.name, otp);
            console.log(`✅ Welcome email sent successfully to ${client.contactEmail}`);
        } catch (error) {
            console.error('❌ Failed to send welcome email:', error);
            // Don't fail the client creation if email fails
        }

        return client;
    }

    async getClientsByProject(projectId: string, page?: string) {
        return await prisma.client.findMany({
            where: { projectId },
            orderBy: {
                name: 'asc',
            },
        });
    }

    async searchClientsByProject(projectId: string, query: string) {
        return await prisma.client.findMany({
            where: {
                projectId,
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { contactEmail: { contains: query, mode: 'insensitive' } },
                    { contactFirstname: { contains: query, mode: 'insensitive' } },
                    { contactLastname: { contains: query, mode: 'insensitive' } },
                ],
            },
            orderBy: {
                name: 'asc',
            },
        });
    }

    async verifyClientOwnership(clientId: string, projectId: string) {
        const client = await prisma.client.findUnique({
            where: { id: clientId },
            select: { projectId: true },
        });

        if (!client) {
            throw new BadRequestException('Client not found');
        }

        if (client.projectId !== projectId) {
            throw new BadRequestException('Client does not belong to this project');
        }

        return true;
    }

    async editClientsInfo(editClientsDto: EditClientsDto) {
        if (!editClientsDto.id) {
            throw new BadRequestException('Client ID is required for editing');
        }
        if (! await prisma.client.findUnique({ where: { id: editClientsDto.id } })) {
            throw new BadRequestException('Client not found');
        }

        return await prisma.client.update({
            where: { id: editClientsDto.id },
            data: { ...editClientsDto, isActive: true },
        })
    }

    deleteClient(id: string) {
        return prisma.client.update({
            where: { id },
            data: { isActive: false },
        });
    }

    async getProjectByClientId(clientId: string) {
        const client = await prisma.client.findUnique({
            where: { id: clientId },
            include: {
                project: true,
            },
        });

        if (!client) {
            throw new BadRequestException('Client not found');
        }

        return client.project;
    }

    async searchClientsAdvanced(filters: SearchClientsDto) {
        const where: any = { isActive: true };

        if (filters.query) {
            where.OR = [
                { name: { contains: filters.query, mode: 'insensitive' } },
                { contactFirstname: { contains: filters.query, mode: 'insensitive' } },
                { contactLastname: { contains: filters.query, mode: 'insensitive' } },
                { contactEmail: { contains: filters.query, mode: 'insensitive' } },
                { contactPhone: { contains: filters.query, mode: 'insensitive' } },
                { address: { contains: filters.query, mode: 'insensitive' } },
                { city: { contains: filters.query, mode: 'insensitive' } },
                { country: { contains: filters.query, mode: 'insensitive' } },
            ];
        }

        if (filters.projectId) {
            where.projectId = filters.projectId;
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

        const clients = await prisma.client.findMany({
            where,
            include: {
                project: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        return clients;
    }

    async sendClientWelcomeEmail(email: string, clientName: string, otp: string) {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const verificationLink = `${frontendUrl}/client/verify-otp?email=${encodeURIComponent(email)}&otp=${otp}`;

        const subject = 'Welcome to Your Client Portal - Verify Your Account';
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .otp-box { background: white; border: 2px dashed #10b981; padding: 20px; margin: 20px 0; text-align: center; border-radius: 8px; }
                    .otp-code { font-size: 32px; font-weight: bold; color: #10b981; letter-spacing: 5px; }
                    .button { display: inline-block; background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                    .info-box { background: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🎉 Welcome to Your Client Portal!</h1>
                    </div>
                    <div class="content">
                        <h2>Hello ${clientName}!</h2>
                        <p>Your client account has been created successfully. To access your portal and view your quotes and invoices, please verify your account using the OTP below:</p>

                        <div class="otp-box">
                            <p style="margin: 0; color: #666; font-size: 14px;">Your One-Time Password</p>
                            <div class="otp-code">${otp}</div>
                            <p style="margin: 10px 0 0 0; color: #666; font-size: 12px;">Valid for 24 hours</p>
                        </div>

                        <div style="text-align: center;">
                            <a href="${verificationLink}" class="button">Verify Account & Set Password</a>
                        </div>

                        <div class="info-box">
                            <h3 style="margin-top: 0;">📋 What You Can Do:</h3>
                            <ul style="margin: 10px 0;">
                                <li>📊 View all your quotes</li>
                                <li>💰 Track your invoices</li>
                                <li>📥 Download documents</li>
                                <li>👤 Manage your profile</li>
                            </ul>
                        </div>

                        <p><strong>Login Email:</strong> ${email}</p>
                        <p style="color: #666; font-size: 14px;">After verification, you'll set your own password for future logins.</p>

                        <p style="margin-top: 30px;">If you didn't expect this email, please contact us immediately.</p>
                    </div>
                    <div class="footer">
                        <p>This email was sent to ${email}</p>
                        <p>© ${new Date().getFullYear()} Invoicerr. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        await this.mailService.sendMail({
            to: email,
            subject,
            html,
        });
    }



    /**
     * Get client portal data - quotes, invoices, receipts
     */
    async getClientPortalData(clientId: string) {
        const client = await prisma.client.findUnique({
            where: { id: clientId, isActive: true },
            include: {
                Quote: {
                    where: { isActive: true },
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                },
                Invoice: {
                    where: { isActive: true },
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                },
            },
        });

        if (!client) {
            throw new BadRequestException('Client not found');
        }

        return {
            client: {
                id: client.id,
                name: client.name,
                contactEmail: client.contactEmail,
                contactFirstname: client.contactFirstname,
                contactLastname: client.contactLastname,
            },
            quotes: client.Quote,
            invoices: client.Invoice,
        };
    }

    /**
     * Get client quotes for portal
     */
    async getClientQuotes(clientId: string) {
        return prisma.quote.findMany({
            where: { clientId, isActive: true },
            orderBy: { createdAt: 'desc' },
            include: {
                items: true,
            },
        });
    }

    /**
     * Get client invoices for portal
     */
    async getClientInvoices(clientId: string) {
        return prisma.invoice.findMany({
            where: { clientId, isActive: true },
            orderBy: { createdAt: 'desc' },
            include: {
                items: true,
                receipts: true,
            },
        });
    }

    /**
     * Get client analytics/dashboard data
     * Used by both admin and project to view client's dashboard
     */
    async getClientAnalytics(clientId: string, currency?: string) {
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
        const firstQuote = await prisma.quote.findFirst({
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
            const firstInvoice = await prisma.invoice.findFirst({
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
                const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

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

                const total = monthlyInvoices.reduce((sum, inv) => sum + inv.totalTTC, 0);

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
        const totalUnpaid = unpaidInvoices.reduce((sum, inv) => sum + inv.totalTTC, 0);

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
