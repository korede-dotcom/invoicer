import { EditClientsDto, SearchClientsDto } from '@/modules/clients/dto/clients.dto';
import prisma from '@/prisma/prisma.service';
import { BadRequestException, Injectable } from '@nestjs/common';
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

        // Create client
        const client = await prisma.client.create({
            data: {
                ...data,
            }
        });

        // Send welcome email to the new client
        try {
            console.log(`📧 Sending welcome email to ${client.contactEmail}...`);
            await this.sendWelcomeEmail(client);
            console.log(`✅ Welcome email sent successfully to ${client.contactEmail}`);
        } catch (error) {
            console.error('❌ Failed to send emails:', error);
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

    private async sendWelcomeEmail(client: any) {
        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
        }
        .content {
            background: #f8fafc;
            padding: 30px;
            border-left: 4px solid #fbbf24;
            border-right: 4px solid #fbbf24;
        }
        .footer {
            background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
            color: #1e293b;
            padding: 20px;
            text-align: center;
            border-radius: 0 0 10px 10px;
            font-size: 14px;
        }
        .button {
            display: inline-block;
            background: #1e40af;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
        }
        .highlight {
            background: #fef3c7;
            padding: 15px;
            border-left: 4px solid #fbbf24;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Welcome to Our Platform! 🎉</h1>
    </div>
    <div class="content">
        <h2>Hello ${client.contactFirstname || ''} ${client.contactLastname || ''}!</h2>
        <p>We're thrilled to have <strong>${client.name}</strong> join our platform!</p>

        <div class="highlight">
            <p><strong>Your account has been successfully created.</strong></p>
            <p>You can now enjoy all the benefits of our invoicing platform.</p>
        </div>

        <h3>What's Next?</h3>
        <ul>
            <li>📊 View and manage your quotes</li>
            <li>💰 Track your invoices</li>
            <li>📧 Receive important updates</li>
            <li>🤝 Collaborate with our team</li>
        </ul>

        <p>If you have any questions or need assistance, please don't hesitate to reach out to us.</p>
    </div>
    <div class="footer">
        <p><strong>Thank you for choosing us!</strong></p>
        <p>This email was sent to ${client.contactEmail}</p>
    </div>
</body>
</html>
        `;

        await this.mailService.sendMail({
            to: client.contactEmail,
            subject: `Welcome to Our Platform, ${client.name}! 🎉`,
            html: emailHtml,
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
}
