import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  Request,
} from '@nestjs/common';

import { Response } from 'express';
import { ExportFormat } from '@fin.cx/einvoice';
import { CreateInvoiceDto, EditInvoicesDto } from '@/modules/invoices/dto/invoices.dto';
import { InvoicesService } from '@/modules/invoices/invoices.service';
import { PluginsService } from '@/modules/plugins/plugins.service';

@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly pluginService: PluginsService,
  ) {}

  @Get()
  async getInvoicesInfo(
    @Query('page') page: string,
    @Query('currency') currency?: string,
    @Query('status') status?: string,
    @Request() req?,
  ) {
    // If project token, filter by project
    if (req.project) {
      return await this.invoicesService.getInvoicesByProject(
        req.project.projectId,
        page,
        currency,
        status,
      );
    }
    return await this.invoicesService.getInvoices(page, currency, status);
  }

  @Get('search')
  async searchInvoices(@Param('query') query: string, @Request() req) {
    // If project token, filter by project
    if (req.project) {
      return await this.invoicesService.searchInvoicesByProject(req.project.projectId, query);
    }
    return await this.invoicesService.searchInvoices(query);
  }

  @Get(':id/pdf')
  async getInvoicePdf(
    @Param('id') id: string,
    @Query('format') format: ExportFormat | undefined,
    @Res() res: Response,
    @Request() req,
  ) {
    if (id === 'undefined') return res.status(400).send('Invalid invoice ID');

    // If project token, verify ownership
    if (req.project) {
      await this.invoicesService.verifyInvoiceOwnership(id, req.project.projectId);
    }

    let pdfBuffer: Uint8Array | null = null;
    if (format) {
      pdfBuffer = await this.invoicesService.getInvoicePDFFormat(id, format);
    } else {
      pdfBuffer = await this.invoicesService.getInvoicePdf(id);
    }
    if (!pdfBuffer) {
      res.status(404).send('Invoice not found or PDF generation failed');
      return;
    }
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${id}.pdf"`,
      'Content-Length': pdfBuffer.length.toString(),
    });
    res.send(pdfBuffer);
  }

  @Get(':id/download/xml')
  async downloadInvoiceXml(
    @Param('id') id: string,
    @Query('format') format: string | ExportFormat,
    @Res() res: Response,
  ) {
    if (id === 'undefined') return res.status(400).send('Invalid invoice ID');
    let fileBuffer: Uint8Array | null = null;

    const xmlInvoice = await this.invoicesService.getInvoiceXMLFormat(id);
    let xmlString = '';
    if (this.pluginService.canGenerateXml(format)) {
      xmlString = await this.pluginService.generateXml(format, xmlInvoice);
    } else {
      xmlString = await xmlInvoice.exportXml(format as ExportFormat);
    }
    fileBuffer = Buffer.from(xmlString, 'utf-8');

    if (!fileBuffer) {
      res.status(404).send('Invoice not found or file generation failed');
      return;
    }
    res.set({
      'Content-Type': `application/xml`,
      'Content-Disposition': `attachment; filename="invoice-${id}-${format}.xml"`,
      'Content-Length': fileBuffer.length.toString(),
    });
    res.send(fileBuffer);
  }

  @Get(':id/download/pdf')
  async downloadInvoicePdf(
    @Param('id') id: string,
    @Query('format') format: ExportFormat | undefined,
    @Res() res: Response,
  ) {
    if (id === 'undefined') return res.status(400).send('Invalid invoice ID');
    let pdfBuffer: Uint8Array | null = null;
    if (format) {
      pdfBuffer = await this.invoicesService.getInvoicePDFFormat(id, format);
    } else {
      pdfBuffer = await this.invoicesService.getInvoicePdf(id);
    }
    if (!pdfBuffer) {
      res.status(404).send('Invoice not found or PDF generation failed');
      return;
    }
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${id}-${format || 'default'}.pdf"`,
      'Content-Length': pdfBuffer.length.toString(),
    });
    res.send(pdfBuffer);
  }

  @Post('create-from-quote')
  async createInvoiceFromQuote(@Body('quoteId') quoteId: string, @Request() req) {
    // If project token, verify quote ownership
    if (req.project) {
      await this.invoicesService.verifyQuoteOwnershipForInvoice(quoteId, req.project.projectId);
    }
    return this.invoicesService.createInvoiceFromQuote(quoteId);
  }

  @Post('mark-as-paid')
  async markInvoiceAsPaid(@Body('invoiceId') invoiceId: string, @Request() req) {
    // If project token, verify ownership
    if (req.project) {
      await this.invoicesService.verifyInvoiceOwnership(invoiceId, req.project.projectId);
    }
    return this.invoicesService.markInvoiceAsPaid(invoiceId);
  }

  @Post()
  async postInvoicesInfo(@Body() body: CreateInvoiceDto, @Request() req) {
    // If project token, verify client belongs to project
    if (req.project) {
      await this.invoicesService.verifyClientBelongsToProject(body.clientId, req.project.projectId);

      // Create invoice
      const invoice = await this.invoicesService.createInvoice(body);

      // Try to send invoice email (optional - don't fail if template doesn't exist)
      try {
        await this.invoicesService.sendInvoiceByEmail(invoice.id);
        console.log('✅ Invoice email sent successfully');
      } catch (error) {
        console.warn('⚠️ Failed to send invoice email (this is optional):', error.message);
        // Don't fail the request - invoice was created successfully
      }

      return invoice;
    }

    // Admin creating invoice - also try to send email
    const invoice = await this.invoicesService.createInvoice(body);

    try {
      await this.invoicesService.sendInvoiceByEmail(invoice.id);
      console.log('✅ Invoice email sent successfully');
    } catch (error) {
      console.warn('⚠️ Failed to send invoice email (this is optional):', error.message);
    }

    return invoice;
  }

  @Post('send')
  async sendInvoiceByEmail(@Body('id') id: string, @Request() req) {
    // If project token, verify ownership
    if (req.project) {
      await this.invoicesService.verifyInvoiceOwnership(id, req.project.projectId);
    }
    return this.invoicesService.sendInvoiceByEmail(id);
  }

  @Patch(':id')
  async editInvoicesInfo(@Param('id') id: string, @Body() body: EditInvoicesDto, @Request() req) {
    // If project token, verify ownership
    if (req.project) {
      await this.invoicesService.verifyInvoiceOwnership(id, req.project.projectId);
    }
    return this.invoicesService.editInvoice({ ...body, id });
  }

  @Delete(':id')
  async deleteInvoice(@Param('id') id: string, @Request() req) {
    // If project token, verify ownership
    if (req.project) {
      await this.invoicesService.verifyInvoiceOwnership(id, req.project.projectId);
    }
    return this.invoicesService.deleteInvoice(id);
  }
}
