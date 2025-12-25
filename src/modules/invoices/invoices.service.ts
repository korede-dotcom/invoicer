import * as Handlebars from 'handlebars';
import { BadRequestException, Injectable, Inject, forwardRef } from '@nestjs/common';
import { EInvoice, ExportFormat } from '@fin.cx/einvoice';
import { MailService } from '@/mail/mail.service';
import { CreateInvoiceDto, EditInvoicesDto } from '@/modules/invoices/dto/invoices.dto';
import { baseTemplate } from '@/modules/quotes/templates/base.template';
import prisma from '@/prisma/prisma.service';
import { parseAddress } from '@/utils/adress';
import { getInvertColor, getPDF } from '@/utils/pdf';
import { finance } from '@fin.cx/einvoice/dist_ts/plugins';
import { formatDate } from '@/utils/date';
import { PaymentService } from '@/modules/payments/payment.service';

@Injectable()
export class InvoicesService {
    constructor(
        private readonly mailService: MailService,
        @Inject(forwardRef(() => PaymentService))
        private readonly paymentService: PaymentService,
    ) { }


    async getInvoices(page: string, currency?: string, status?: string) {
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

        const invoices = await prisma.invoice.findMany({
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

        const totalInvoices = await prisma.invoice.count({
            where: whereFilter,
        });

        return { pageCount: Math.ceil(totalInvoices / pageSize), invoices };
    }

    async getInvoicesByProject(
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

        const invoices = await prisma.invoice.findMany({
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

        const totalInvoices = await prisma.invoice.count({
            where: {
                ...whereFilter,
                isActive: true,
                client: {
                    projectId,
                },
            },
        });

        return { pageCount: Math.ceil(totalInvoices / pageSize), invoices };
    }

    async searchInvoicesByProject(projectId: string, query: string) {
        return prisma.invoice.findMany({
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
            include: {
                items: true,
                client: true,
                company: true,
            },
        });
    }

    async verifyInvoiceOwnership(invoiceId: string, projectId: string) {
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: { client: true },
        });

        if (!invoice) {
            throw new BadRequestException('Invoice not found');
        }

        if (invoice.client.projectId !== projectId) {
            throw new BadRequestException('Invoice does not belong to this project');
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

    async verifyQuoteOwnershipForInvoice(quoteId: string, projectId: string) {
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

    async searchInvoices(query: string) {
        if (query === '') {
            return this.getInvoices('1'); // Return first page if query is empty
        }

        return prisma.invoice.findMany({
            where: {
                OR: [
                    { client: { name: { contains: query } } },
                    { items: { some: { description: { contains: query } } } },
                ],
            },
            include: {
                items: true,
                client: true,
                company: true
            },
        });
    }

    async createInvoice(body: CreateInvoiceDto) {
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

        // Validate quoteId if provided (and not empty string)
        if (body.quoteId && body.quoteId.trim() !== '') {
            const quote = await prisma.quote.findUnique({
                where: { id: body.quoteId },
            });
            if (!quote) {
                throw new BadRequestException(`Quote with ID ${body.quoteId} not found`);
            }
        }

        // Validate recurringInvoiceId if provided (and not empty string)
        if (body.recurringInvoiceId && body.recurringInvoiceId.trim() !== '') {
            const recurringInvoice = await prisma.recurringInvoice.findUnique({
                where: { id: body.recurringInvoiceId },
            });
            if (!recurringInvoice) {
                throw new BadRequestException(`Recurring invoice with ID ${body.recurringInvoiceId} not found`);
            }
        }

        // Prepare the invoice data
        const invoiceData: any = {
            clientId: body.clientId,
            currency: body.currency || client.currency || company.currency,
            companyId: company.id,
            notes: body.notes,
            totalHT: items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0),
            totalVAT: items.reduce((sum, item) => sum +
                (item.quantity * item.unitPrice * (item.vatRate || 0) / 100), 0),
            totalTTC: items.reduce((sum, item) => sum +
                (item.quantity * item.unitPrice * (1 + (item.vatRate || 0) / 100)), 0),
            items: {
                create: items.map(item => ({
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    vatRate: item.vatRate || 0,
                    order: item.order || 0,
                })),
            },
            dueDate: data.dueDate ? new Date(data.dueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        };

        // Only add optional fields if they have valid values (not empty strings)
        if (body.quoteId && body.quoteId.trim() !== '') {
            invoiceData.quoteId = body.quoteId;
        }
        if (body.recurringInvoiceId && body.recurringInvoiceId.trim() !== '') {
            invoiceData.recurringInvoiceId = body.recurringInvoiceId;
        }
        if (body.paymentMethod && body.paymentMethod.trim() !== '') {
            invoiceData.paymentMethod = body.paymentMethod;
        }
        if (body.paymentDetails && body.paymentDetails.trim() !== '') {
            invoiceData.paymentDetails = body.paymentDetails;
        }

        const invoice = await prisma.invoice.create({
            data: invoiceData,
            include: {
                client: true,
                company: true,
            },
        });

        // Send invoice email with payment link in background
        this.sendInvoiceNotification(invoice.id).catch(error => {
            console.error(`Failed to send invoice notification for ${invoice.id}:`, error);
        });

        return invoice;
    }

    /**
     * Send invoice notification email with payment link
     */
    private async sendInvoiceNotification(invoiceId: string) {
        try {
            const invoice = await prisma.invoice.findUnique({
                where: { id: invoiceId },
                include: {
                    client: true,
                    company: true,
                },
            });

            if (!invoice || invoice.emailSent) {
                return; // Skip if already sent
            }

            // Generate payment link
            let paymentLink = '';
            try {
                paymentLink = await this.paymentService.generatePaymentLink(invoiceId);
            } catch (error) {
                console.error('Failed to generate payment link:', error);
                // Continue without payment link
            }

            // Send email
            await this.mailService.sendInvoiceEmail(
                invoice.client.contactEmail,
                invoice.client.name,
                invoice.rawNumber || invoice.number.toString(),
                invoice.totalTTC,
                invoice.currency,
                formatDate(invoice.company, invoice.dueDate),
                paymentLink,
                invoice.company.name,
            );

            // Mark email as sent
            await prisma.invoice.update({
                where: { id: invoiceId },
                data: {
                    emailSent: true,
                    emailSentAt: new Date(),
                },
            });

            console.log(`✅ Invoice notification sent for ${invoice.rawNumber || invoice.number}`);
        } catch (error) {
            console.error('Error sending invoice notification:', error);
            throw error;
        }
    }

    async editInvoice(body: EditInvoicesDto) {
        const { items, id, ...data } = body;

        if (!id) {
            throw new BadRequestException('Invoice ID is required for editing');
        }

        const company = await prisma.company.findFirst();
        if (!company) {
            throw new BadRequestException('No company found. Please create a company first.');
        }

        const client = await prisma.client.findUnique({
            where: { id: data.clientId },
        });
        if (!client) {
            throw new BadRequestException('Client not found');
        }

        const existingInvoice = await prisma.invoice.findUnique({
            where: { id },
            include: { items: true }
        });

        if (!existingInvoice) {
            throw new BadRequestException('Invoice not found');
        }

        // Validate quoteId if provided (and not empty string)
        if (data.quoteId && data.quoteId.trim() !== '') {
            const quote = await prisma.quote.findUnique({
                where: { id: data.quoteId },
            });
            if (!quote) {
                throw new BadRequestException(`Quote with ID ${data.quoteId} not found`);
            }
        }

        // Validate recurringInvoiceId if provided (and not empty string)
        if (data.recurringInvoiceId && data.recurringInvoiceId.trim() !== '') {
            const recurringInvoice = await prisma.recurringInvoice.findUnique({
                where: { id: data.recurringInvoiceId },
            });
            if (!recurringInvoice) {
                throw new BadRequestException(`Recurring invoice with ID ${data.recurringInvoiceId} not found`);
            }
        }

        const existingItemIds = existingInvoice.items.map(i => i.id);
        const incomingItemIds = items.filter(i => i.id).map(i => i.id!);

        const itemIdsToDelete = existingItemIds.filter(id => !incomingItemIds.includes(id));

        const totalHT = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        const totalVAT = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice * (item.vatRate || 0) / 100), 0);
        const totalTTC = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice * (1 + (item.vatRate || 0) / 100)), 0);

        // Prepare update data
        const updateData: any = {
            clientId: data.clientId || existingInvoice.clientId,
            notes: data.notes,
            currency: body.currency || client.currency || company.currency,
            dueDate: data.dueDate ? new Date(data.dueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
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
        };

        // Only add optional fields if they have valid values (not empty strings)
        if (data.quoteId && data.quoteId.trim() !== '') {
            updateData.quoteId = data.quoteId;
        }
        if (data.recurringInvoiceId && data.recurringInvoiceId.trim() !== '') {
            updateData.recurringInvoiceId = data.recurringInvoiceId;
        }
        if (data.paymentMethod && data.paymentMethod.trim() !== '') {
            updateData.paymentMethod = data.paymentMethod;
        }
        if (data.paymentDetails && data.paymentDetails.trim() !== '') {
            updateData.paymentDetails = data.paymentDetails;
        }

        const updateInvoice = await prisma.invoice.update({
            where: { id },
            data: updateData,
        });

        return updateInvoice;
    }

    async deleteInvoice(id: string) {
        const existingInvoice = await prisma.invoice.findUnique({ where: { id } });

        if (!existingInvoice) {
            throw new BadRequestException('Invoice not found');
        }

        return prisma.invoice.update({
            where: { id },
            data: { isActive: false },
        });
    }

    async getInvoicePdf(id: string): Promise<Uint8Array> {
        const invoice = await prisma.invoice.findUnique({
            where: { id },
            include: {
                items: true,
                client: true,
                company: {
                    include: { pdfConfig: true },
                },
            },
        });

        if (!invoice) {
            throw new BadRequestException('Invoice not found');
        }

        const template = Handlebars.compile(baseTemplate);

        const { pdfConfig } = invoice.company;
        const html = template({
            number: invoice.rawNumber || invoice.number.toString(),
            date: formatDate(invoice.company, invoice.createdAt),
            dueDate: formatDate(invoice.company, invoice.dueDate),
            company: invoice.company,
            client: invoice.client,
            currency: invoice.currency,
            items: invoice.items.map(i => ({
                description: i.description,
                quantity: i.quantity,
                unitPrice: i.unitPrice.toFixed(2),
                vatRate: i.vatRate.toFixed(2),
                totalPrice: (i.quantity * i.unitPrice * (1 + (i.vatRate || 0) / 100)).toFixed(2),
            })),
            totalHT: invoice.totalHT.toFixed(2),
            totalVAT: invoice.totalVAT.toFixed(2),
            totalTTC: invoice.totalTTC.toFixed(2),

            paymentMethod: invoice.paymentMethod,
            paymentDetails: invoice.paymentDetails,

            fontFamily: pdfConfig.fontFamily ?? 'Inter',
            primaryColor: pdfConfig.primaryColor ?? '#0ea5e9',
            secondaryColor: pdfConfig.secondaryColor ?? '#f3f4f6',
            tableTextColor: getInvertColor(pdfConfig.secondaryColor),
            padding: pdfConfig?.padding ?? 40,
            includeLogo: !!pdfConfig?.logoB64,
            logoB64: pdfConfig?.logoB64 ?? '',

            noteExists: !!invoice.notes,
            notes: (invoice.notes || '').replace(/\n/g, '<br>'),

            // Labels
            labels: {
                invoice: pdfConfig.invoice,
                dueDate: pdfConfig.dueDate,
                billTo: pdfConfig.billTo,
                description: pdfConfig.description,
                quantity: pdfConfig.quantity,
                unitPrice: pdfConfig.unitPrice,
                vatRate: pdfConfig.vatRate,
                subtotal: pdfConfig.subtotal,
                total: pdfConfig.total,
                vat: pdfConfig.vat,
                grandTotal: pdfConfig.grandTotal,
                date: pdfConfig.date,
                notes: pdfConfig.notes,
                paymentMethod: pdfConfig.paymentMethod,
                paymentDetails: pdfConfig.paymentDetails,
                legalId: pdfConfig.legalId,
                VATId: pdfConfig.VATId,
            },
        });

        const pdfBuffer = await getPDF(html);

        return pdfBuffer;
    }

    async getInvoiceXMLFormat(id: string): Promise<EInvoice> {
        const invRec = await prisma.invoice.findUnique({
            where: { id },
            include: {
                items: true,
                client: true,
                company: {
                    include: { pdfConfig: true },
                },
            },
        });

        if (!invRec) {
            throw new BadRequestException('Invoice not found');
        }

        const inv = new EInvoice();

        const companyFoundedDate = new Date(invRec.company.foundedAt || new Date())
        const clientFoundedDate = new Date(invRec.client.foundedAt || new Date());

        inv.id = invRec.rawNumber || invRec.number.toString();
        inv.issueDate = new Date(invRec.createdAt.toISOString().split('T')[0]);
        inv.currency = invRec.company.currency as finance.TCurrency || 'EUR';

        let fromAdress;
        try {
            fromAdress = parseAddress(invRec.company.address || '');
        } catch (error) {
            fromAdress = {
                streetName: invRec.company.address || 'N/A',
                houseNumber: 'N/A',
            };
        }

        inv.from = {
            name: invRec.company.name,
            description: invRec.company.description || "N/A",
            status: 'active',
            foundedDate: { day: companyFoundedDate.getDay(), month: companyFoundedDate.getMonth() + 1, year: companyFoundedDate.getFullYear() },
            type: 'company',
            address: {
                streetName: fromAdress.streetName,
                houseNumber: fromAdress.houseNumber,
                city: invRec.company.city,
                postalCode: invRec.company.postalCode,
                country: invRec.company.country,
                countryCode: invRec.company.country
            },
            registrationDetails: { vatId: invRec.company.VAT || "N/A", registrationId: invRec.company.legalId || "N/A", registrationName: invRec.company.name }
        };

        let toAdress;
        try {
            toAdress = parseAddress(invRec.client.address || '');
        } catch (error) {
            toAdress = {
                streetName: invRec.client.address || 'N/A',
                houseNumber: 'N/A',
            };
        }

        inv.to = {
            name: invRec.client.name,
            description: invRec.client.description || "N/A",
            type: 'company',
            foundedDate: { day: clientFoundedDate.getDay(), month: clientFoundedDate.getMonth() + 1, year: clientFoundedDate.getFullYear() },
            status: invRec.client.isActive ? 'active' : 'planned',
            address: {
                streetName: toAdress.streetName,
                houseNumber: toAdress.houseNumber,
                city: invRec.client.city,
                postalCode: invRec.client.postalCode,
                country: invRec.client.country || 'FR',
                countryCode: invRec.client.country || 'FR'
            },
            registrationDetails: { vatId: invRec.client.VAT || 'N/A', registrationId: invRec.client.legalId || 'N/A', registrationName: invRec.client.name }
        };

        invRec.items.forEach(item => {
            inv.addItem({
                name: item.description,
                unitQuantity: item.quantity,
                unitNetPrice: item.unitPrice,
                vatPercentage: item.vatRate || 0
            });
        });

        invRec.items.forEach(item => {
            inv.addItem({
                name: item.description,
                unitQuantity: item.quantity,
                unitNetPrice: item.unitPrice,
                vatPercentage: item.vatRate || 0
            });
        });

        return inv;
    }

    async getInvoicePDFFormat(invoiceId: string, format: '' | 'pdf' | ExportFormat): Promise<Uint8Array> {
        const invRec = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { items: true, client: true, company: true, quote: true } });
        if (!invRec) throw new BadRequestException('Invoice not found');

        const pdfBuffer = await this.getInvoicePdf(invoiceId);

        if (format === 'pdf' || format === '') {
            return pdfBuffer;
        }

        const inv = await this.getInvoiceXMLFormat(invoiceId);

        return await inv.embedInPdf(Buffer.from(pdfBuffer), format)
    }

    async createInvoiceFromQuote(quoteId: string) {
        const quote = await prisma.quote.findUnique({ where: { id: quoteId }, include: { items: true } });

        if (!quote) {
            throw new BadRequestException('Quote not found');
        }

        return this.createInvoice({
            clientId: quote.clientId,
            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            items: quote.items,
            currency: quote.currency,
            notes: quote.notes || '',
        });
    }

    async markInvoiceAsPaid(invoiceId: string) {
        const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });

        if (!invoice) {
            throw new BadRequestException('Invoice not found');
        }

        return prisma.invoice.update({
            where: { id: invoiceId },
            data: { status: 'PAID', paidAt: new Date() }
        });
    }

    async sendInvoiceByEmail(invoiceId: string) {
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: {
                client: true,
                company: true,
                items: true,
            },
        });

        if (!invoice) {
            throw new BadRequestException('Invoice not found');
        }

        let pdfBuffer: Uint8Array;
        try {
            pdfBuffer = await this.getInvoicePDFFormat(invoiceId, (invoice.company.invoicePDFFormat as ExportFormat || 'pdf'));
        } catch (error) {
            console.error('Failed to generate invoice PDF:', error);
            throw new BadRequestException(
                'Failed to generate invoice PDF. ' +
                'If running on Linux, ensure Chrome dependencies are installed. ' +
                'Error: ' + error.message
            );
        }

        // Try to find existing template or create a default one
        let mailTemplate = await prisma.mailTemplate.findFirst({
            where: {
                type: 'INVOICE',
                companyId: invoice.company.id
            },
            select: { subject: true, body: true }
        });

        // If no template exists, create a default one
        if (!mailTemplate) {
            mailTemplate = await prisma.mailTemplate.create({
                data: {
                    type: 'INVOICE',
                    companyId: invoice.company.id,
                    subject: 'Invoice #{{INVOICE_NUMBER}} from {{COMPANY_NAME}}',
                    body: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 10px 10px 0 0;">
                                <h1 style="margin: 0; font-size: 28px;">{{COMPANY_NAME}}</h1>
                                <p style="margin: 10px 0 0 0; font-size: 16px;">Invoice #{{INVOICE_NUMBER}}</p>
                            </div>
                            <div style="background: #f9fafb; padding: 40px 30px; border-radius: 0 0 10px 10px;">
                                <p style="font-size: 16px; color: #333; margin-top: 0;">Dear {{CLIENT_NAME}},</p>
                                <p style="font-size: 14px; color: #666; line-height: 1.6;">
                                    Thank you for your business! Please find attached invoice #{{INVOICE_NUMBER}} from {{COMPANY_NAME}}.
                                </p>

                                <div style="background: white; border: 2px solid #e5e7eb; border-radius: 8px; padding: 25px; margin: 25px 0;">
                                    <table style="width: 100%; border-collapse: collapse;">
                                        <tr>
                                            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Invoice Number</td>
                                            <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #111827; font-size: 14px;">{{INVOICE_NUMBER}}</td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Due Date</td>
                                            <td style="padding: 8px 0; text-align: right; color: #111827; font-size: 14px;">{{DUE_DATE}}</td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">From</td>
                                            <td style="padding: 8px 0; text-align: right; color: #111827; font-size: 14px;">{{COMPANY_NAME}}</td>
                                        </tr>
                                    </table>

                                    <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin-top: 20px; text-align: center;">
                                        <h2 style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280; font-weight: normal;">Amount Due</h2>
                                        <p style="margin: 0; font-size: 32px; font-weight: bold; color: #1e40af;">{{CURRENCY}} {{INVOICE_AMOUNT}}</p>
                                    </div>
                                </div>

                                <div style="text-align: center; margin: 30px 0;">
                                    <a href="{{PAYMENT_LINK}}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);">
                                        💳 Pay Now
                                    </a>
                                </div>

                                <div style="background: white; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px;">
                                    <p style="margin: 0; font-size: 14px; color: #666;">
                                        📎 The invoice is attached to this email as a PDF document.
                                    </p>
                                </div>

                                <p style="font-size: 14px; color: #666; line-height: 1.6;">
                                    If you have any questions about this invoice, please don't hesitate to contact us.
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

        // Generate payment link
        let paymentLink = '';
        try {
            paymentLink = await this.paymentService.generatePaymentLink(invoice.id);
            console.log(`✅ Payment link generated for invoice ${invoice.id}: ${paymentLink}`);
        } catch (error) {
            console.warn(`⚠️ Failed to generate payment link for invoice ${invoice.id}:`, error.message);
            // Continue without payment link - email will still be sent
        }

        const envVariables = {
            APP_URL: process.env.APP_URL || 'http://localhost:3000',
            INVOICE_NUMBER: invoice.rawNumber || invoice.number.toString(),
            COMPANY_NAME: invoice.company.name,
            CLIENT_NAME: invoice.client.name,
            PAYMENT_LINK: paymentLink || '#',
            INVOICE_AMOUNT: invoice.totalTTC.toFixed(2),
            CURRENCY: invoice.currency,
            DUE_DATE: formatDate(invoice.dueDate),
        };

        const mailOptions = {
            to: invoice.client.contactEmail,
            subject: mailTemplate.subject.replace(/{{(\w+)}}/g, (_, key) => envVariables[key] || ''),
            html: mailTemplate.body.replace(/{{(\w+)}}/g, (_, key) => envVariables[key] || ''),
            attachments: [{
                filename: `invoice-${invoice.rawNumber || invoice.number}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf',
            }],
        };

        try {
            await this.mailService.sendMail(mailOptions);
        } catch (error) {
            throw new BadRequestException('Failed to send invoice email. Please check your SMTP configuration.');
        }

        return { message: 'Invoice sent successfully' };
    }
}
