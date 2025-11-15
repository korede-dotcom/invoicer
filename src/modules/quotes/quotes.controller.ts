import { CreateQuoteDto, EditQuotesDto } from '@/modules/quotes/dto/quotes.dto';
import { QuotesService } from '@/modules/quotes/quotes.service';
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

@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Get()
  async getQuotesInfo(
    @Query('page') page: string,
    @Query('currency') currency?: string,
    @Query('status') status?: string,
    @Request() req?,
  ) {
    // If project token, filter by project
    if (req.project) {
      return await this.quotesService.getQuotesByProject(
        req.project.projectId,
        page,
        currency,
        status,
      );
    }
    return await this.quotesService.getQuotes(page, currency, status);
  }

  @Get('search')
  async searchClients(@Query('query') query: string, @Request() req) {
    // If project token, filter by project
    if (req.project) {
      return await this.quotesService.searchQuotesByProject(req.project.projectId, query);
    }
    return await this.quotesService.searchQuotes(query);
  }

  @Get(':id/pdf')
  async getQuotePdf(@Param('id') id: string, @Res() res: Response, @Request() req) {
    if (id === 'undefined') return res.status(400).send('Invalid quote ID');

    // If project token, verify ownership
    if (req.project) {
      await this.quotesService.verifyQuoteOwnership(id, req.project.projectId);
    }

    const pdfBuffer = await this.quotesService.getQuotePdf(id);
    if (!pdfBuffer) {
      res.status(404).send('Quote not found or PDF generation failed');
      return;
    }
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="quote-${id}.pdf"`,
      'Content-Length': pdfBuffer.length.toString(),
    });
    res.send(pdfBuffer);
  }

  @Post('/mark-as-signed')
  async markQuoteAsSigned(@Body('id') id: string, @Request() req) {
    // If project token, verify ownership
    if (req.project) {
      await this.quotesService.verifyQuoteOwnership(id, req.project.projectId);
    }
    return await this.quotesService.markQuoteAsSigned(id);
  }

  @Post()
  async postQuotesInfo(@Body() body: CreateQuoteDto, @Request() req) {
    // If project token, verify client belongs to project
    if (req.project) {
      await this.quotesService.verifyClientBelongsToProject(body.clientId, req.project.projectId);

      // Create quote and send email
      const quote = await this.quotesService.createQuote(body);

      // Send quote email
      try {
        await this.quotesService.sendQuoteByEmail(quote.id);
      } catch (error) {
        console.error('Failed to send quote email:', error);
      }

      return quote;
    }

    return this.quotesService.createQuote(body);
  }

  @Patch(':id')
  async editQuotesInfo(@Param('id') id: string, @Body() body: EditQuotesDto, @Request() req) {
    // If project token, verify ownership
    if (req.project) {
      await this.quotesService.verifyQuoteOwnership(id, req.project.projectId);
    }
    return this.quotesService.editQuote({ ...body, id });
  }

  @Delete(':id')
  async deleteQuote(@Param('id') id: string, @Request() req) {
    // If project token, verify ownership
    if (req.project) {
      await this.quotesService.verifyQuoteOwnership(id, req.project.projectId);
    }
    return this.quotesService.deleteQuote(id);
  }
}
