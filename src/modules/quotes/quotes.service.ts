import * as Handlebars from 'handlebars';

import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateQuoteDto, EditQuotesDto } from '@/modules/quotes/dto/quotes.dto';
import { baseTemplate } from '@/modules/quotes/templates/base.template';
import prisma from '@/prisma/prisma.service';
import { getInvertColor, getPDF } from '@/utils/pdf';
import { formatDate } from '@/utils/date';
import { MailService } from '@/mail/mail.service';


@Injectable()
export class QuotesService {
    constructor(private readonly mailService: MailService) {}

    async getQuotes(page: string, currency?: string, status?: string) {
        const pageNumber = parseInt(page, 10) || 1;
        const pageSize = 10;
        const skip = (pageNumber - 1) * pageSize;

        // Build filter object
        const whereFilter: any = {
            isActive: true,
        };

        if (currency) {
            whereFilter.currency = currency;
        }

        if (status) {
            whereFilter.status = status;
        }

        const quotes = await prisma.quote.findMany({
            skip,
            take: pageSize,
            where: whereFilter,
            orderBy: {
                createdAt: 'desc',
            },
            include: {
                items: true,
                client: true,
                company: true
            },
        });

        const totalQuotes = await prisma.quote.count({
            where: whereFilter,
        });

        return { pageCount: Math.ceil(totalQuotes / pageSize), quotes };
    }

    async getQuotesByProject(
        projectId: string,
        page?: string,
        currency?: string,
        status?: string,
    ) {
        const pageNumber = parseInt(page || '1', 10);
        const pageSize = 10;
        const skip = (pageNumber - 1) * pageSize;

        // Build filter object
        const whereFilter: any = {
            isActive: true,
            client: {
                projectId,
            },
        };

        if (currency) {
            whereFilter.currency = currency;
        }

        if (status) {
            whereFilter.status = status;
        }

        const quotes = await prisma.quote.findMany({
            skip,
            take: pageSize,
            where: whereFilter,
            orderBy: {
                createdAt: 'desc',
            },
            include: {
                items: true,
                company: true,
                client: true,
            },
        });

        const totalQuotes = await prisma.quote.count({
            where: {
                ...whereFilter,
                isActive: true,
                client: {
                    projectId,
                },
            },
        });

        return { pageCount: Math.ceil(totalQuotes / pageSize), quotes };
    }

    async searchQuotesByProject(projectId: string, query: string) {
        return prisma.quote.findMany({
            where: {
                isActive: true,
                client: {
                    projectId,
                },
                OR: [
                    { rawNumber: { contains: query, mode: 'insensitive' } },
                    { client: { name: { contains: query, mode: 'insensitive' } } },
                ],
            },
            take: 10,
            orderBy: {
                number: 'desc',
            },
            include: {
                items: true,
                company: true,
                client: true,
            },
        });
    }

    async verifyQuoteOwnership(quoteId: string, projectId: string) {
        const quote = await prisma.quote.findUnique({
            where: { id: quoteId },
            include: { client: true },
        });

        if (!quote) {
            throw new BadRequestException('Quote not found');
        }

        if (quote.client.projectId !== projectId) {
            throw new BadRequestException('Quote does not belong to this project');
        }

        return true;
    }

    async verifyClientBelongsToProject(clientId: string, projectId: string) {
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

    async searchQuotes(query: string) {
        if (!query) {
            return prisma.quote.findMany({
                take: 10,
                orderBy: {
                    number: 'asc',
                },
                include: {
                    items: true,
                    company: true,
                    client: true,
                },
            });
        }

        return prisma.quote.findMany({
            where: {
                isActive: true,
                OR: [
                    { title: { contains: query } },
                    { client: { name: { contains: query } } },
                ],
            },
            take: 10,
            orderBy: {
                number: 'asc',
            },
            include: {
                items: true,
                company: true,
                client: true,
            },
        });
    }

    async createQuote(body: CreateQuoteDto) {
        const { items, ...data } = body;

        const company = await prisma.company.findFirst();

        if (!company) {
            throw new BadRequestException('No company found. Please create a company first.');
        }

        const client = await prisma.client.findUnique({
            where: { id: body.clientId },
        });

        if (!client) {
            throw new BadRequestException('Client not found');
        }

        return prisma.quote.create({
            data: {
                ...data,
                notes: body.notes,
                companyId: company.id,
                currency: body.currency || client.currency || company.currency,
                totalHT: items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0),
                totalVAT: items.reduce((sum, item) => sum +
                    (item.quantity * item.unitPrice * (item.vatRate || 0) / 100), 0),
                totalTTC: items.reduce((sum, item) => sum +
                    (item.quantity * item.unitPrice * (1 + (item.vatRate || 0) / 100)), 0),
                items: {
                    create: items.map(item => ({
                        ...item,
                        vatRate: item.vatRate || 0,
                        order: item.order || 0,
                    })),
                },
                validUntil: body.validUntil ? new Date(body.validUntil) : null,
            }
        });
    }

    async editQuote(body: EditQuotesDto) {
        const { items, id, ...data } = body;

        if (!id) {
            throw new BadRequestException('Quote ID is required for editing');
        }

        const existingQuote = await prisma.quote.findUnique({
            where: { id },
            include: { items: true }
        });

        if (!existingQuote) {
            throw new BadRequestException('Quote not found');
        }

        const existingItemIds = existingQuote.items.map(i => i.id);
        const incomingItemIds = items.filter(i => i.id).map(i => i.id!);

        const itemIdsToDelete = existingItemIds.filter(id => !incomingItemIds.includes(id));

        const totalHT = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        const totalVAT = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice * (item.vatRate || 0) / 100), 0);
        const totalTTC = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice * (1 + (item.vatRate || 0) / 100)), 0);

        const updateQuote = await prisma.quote.update({
            where: { id },
            data: {
                ...data,
                validUntil: body.validUntil ? new Date(body.validUntil) : null,
                totalHT,
                totalVAT,
                totalTTC,
                items: {
                    deleteMany: {
                        id: { in: itemIdsToDelete },
                    },
                    updateMany: items
                        .filter(i => i.id)
                        .map(i => ({
                            where: { id: i.id! },
                            data: {
                                description: i.description,
                                quantity: i.quantity,
                                unitPrice: i.unitPrice,
                                vatRate: i.vatRate || 0,
                                order: i.order || 0,
                            },
                        })),
                    create: items
                        .filter(i => !i.id)
                        .map(i => ({
                            description: i.description,
                            quantity: i.quantity,
                            unitPrice: i.unitPrice,
                            vatRate: i.vatRate || 0,
                            order: i.order || 0,
                        })),
                },
            },
        });

        await prisma.signature.updateMany({
            where: { quoteId: id },
            data: { isActive: false },
        });

        return updateQuote;
    }

    async deleteQuote(id: string) {
        const existingQuote = await prisma.quote.findUnique({ where: { id } });

        if (!existingQuote) {
            throw new BadRequestException('Quote not found');
        }

        return prisma.quote.update({
            where: { id },
            data: { isActive: false },
        });
    }

    async getQuotePdf(id: string): Promise<Uint8Array> {
        const quote = await prisma.quote.findUnique({
            where: { id },
            include: {
                items: true,
                client: true,
                company: {
                    include: { pdfConfig: true },
                },
            },
        });

        if (!quote || !quote.company || !quote.company.pdfConfig) {
            throw new BadRequestException('Quote or associated PDF config not found');
        }

        const config = quote.company.pdfConfig;
        const templateHtml = baseTemplate;
        const template = Handlebars.compile(templateHtml);

        const html = template({
            number: quote.rawNumber || quote.number.toString(),
            date: formatDate(quote.company, quote.createdAt),
            validUntil: formatDate(quote.company, quote.validUntil),
            company: quote.company,
            client: quote.client,
            currency: quote.currency,
            items: quote.items.map(i => ({
                description: i.description,
                quantity: i.quantity,
                unitPrice: i.unitPrice.toFixed(2),
                vatRate: i.vatRate,
                totalPrice: (i.quantity * i.unitPrice * (1 + (i.vatRate || 0) / 100)).toFixed(2),
            })),
            totalHT: quote.totalHT.toFixed(2),
            totalVAT: quote.totalVAT.toFixed(2),
            totalTTC: quote.totalTTC.toFixed(2),

            paymentMethod: quote.paymentMethod,
            paymentDetails: quote.paymentDetails,

            // 🎨 Style & labels from PDFConfig
            fontFamily: config.fontFamily,
            padding: config.padding,
            primaryColor: config.primaryColor,
            secondaryColor: config.secondaryColor,
            tableTextColor: getInvertColor(config.secondaryColor),
            includeLogo: config.includeLogo,
            logoB64: config?.logoB64 ?? '',
            noteExists: !!quote.notes,
            notes: (quote.notes || '').replace(/\n/g, '<br>'),
            labels: {
                quote: config.quote,
                quoteFor: config.quoteFor,
                description: config.description,
                quantity: config.quantity,
                unitPrice: config.unitPrice,
                vatRate: config.vatRate,
                subtotal: config.subtotal,
                total: config.total,
                vat: config.vat,
                grandTotal: config.grandTotal,
                validUntil: config.validUntil,
                date: config.date,
                notes: config.notes,
                paymentMethod: config.paymentMethod,
                paymentDetails: config.paymentDetails,
                legalId: config.legalId,
                VATId: config.VATId,
            },
        });

        const pdfBuffer = await getPDF(html);

        return pdfBuffer;
    }

    async markQuoteAsSigned(id: string) {
        if (!id) {
            throw new BadRequestException('Quote ID is required');
        }

        const existingQuote = await prisma.quote.findUnique({ where: { id } });

        if (!existingQuote) {
            throw new BadRequestException('Quote not found');
        }

        return prisma.quote.update({
            where: { id },
            data: { signedAt: new Date(), status: "SIGNED" },
        });
    }

    async sendQuoteByEmail(quoteId: string) {
        const quote = await prisma.quote.findUnique({
            where: { id: quoteId },
            include: {
                client: true,
                company: true,
                items: true,
            },
        });

        if (!quote) {
            throw new BadRequestException('Quote not found');
        }

        let pdfBuffer: Uint8Array;
        try {
            pdfBuffer = await this.getQuotePdf(quoteId);
        } catch (error) {
            console.error('Failed to generate quote PDF:', error);
            throw new BadRequestException(
                'Failed to generate quote PDF. ' +
                'If running on Linux, ensure Chrome dependencies are installed. ' +
                'Error: ' + error.message
            );
        }

        // Try to find existing template or create a default one
        let mailTemplate = await prisma.mailTemplate.findFirst({
            where: {
                type: 'QUOTE',
                companyId: quote.company.id
            },
            select: { subject: true, body: true }
        });

        // If no template exists, create a default one
        if (!mailTemplate) {
            mailTemplate = await prisma.mailTemplate.create({
                data: {
                    type: 'QUOTE',
                    companyId: quote.company.id,
                    subject: 'Quote #{{QUOTE_NUMBER}} from {{COMPANY_NAME}}',
                    body: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                                <h1 style="margin: 0; font-size: 28px;">{{COMPANY_NAME}}</h1>
                                <p style="margin: 10px 0 0 0; font-size: 16px;">Quote #{{QUOTE_NUMBER}}</p>
                            </div>
                            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                                <p style="font-size: 16px; color: #333;">Dear {{CLIENT_NAME}},</p>
                                <p style="font-size: 14px; color: #666; line-height: 1.6;">
                                    Thank you for your interest! Please find attached quote #{{QUOTE_NUMBER}} from {{COMPANY_NAME}}.
                                </p>
                                <div style="background: white; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px;">
                                    <p style="margin: 0; font-size: 14px; color: #666;">
                                        📎 The quote is attached to this email as a PDF document.<br>
                                        💡 Please review the details and let us know if you have any questions.
                                    </p>
                                </div>
                                <p style="font-size: 14px; color: #666; line-height: 1.6;">
                                    We look forward to working with you and are happy to discuss any aspect of this quote.
                                </p>
                                <p style="font-size: 14px; color: #333; margin-top: 30px;">
                                    Best regards,<br>
                                    <strong>{{COMPANY_NAME}}</strong>
                                </p>
                            </div>
                            <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
                                <p style="margin: 0;">This email was sent from {{APP_URL}}</p>
                                <p style="margin: 5px 0 0 0;">&copy; ${new Date().getFullYear()} {{COMPANY_NAME}}. All rights reserved.</p>
                            </div>
                        </div>
                    `
                },
                select: { subject: true, body: true }
            });
        }

        const envVariables = {
            APP_URL: process.env.APP_URL || 'http://localhost:3000',
            QUOTE_NUMBER: quote.rawNumber || quote.number.toString(),
            COMPANY_NAME: quote.company.name,
            CLIENT_NAME: quote.client.name,
        };

        const mailOptions = {
            to: quote.client.contactEmail,
            subject: mailTemplate.subject.replace(/{{(\w+)}}/g, (_, key) => envVariables[key] || ''),
            html: mailTemplate.body.replace(/{{(\w+)}}/g, (_, key) => envVariables[key] || ''),
            attachments: [{
                filename: `quote-${quote.rawNumber || quote.number}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf',
            }],
        };

        try {
            await this.mailService.sendMail(mailOptions);
        } catch (error) {
            throw new BadRequestException('Failed to send quote email. Please check your SMTP configuration.');
        }

        return { message: 'Quote sent successfully' };
    }

}
