import { JwtService } from '@nestjs/jwt';
import { Module } from '@nestjs/common';
import { QuotesController } from '@/modules/quotes/quotes.controller';
import { QuotesService } from '@/modules/quotes/quotes.service';
import { MailService } from '@/mail/mail.service';

@Module({
  controllers: [QuotesController],
  providers: [QuotesService, MailService, JwtService],
  exports: [QuotesService],
})
export class QuotesModule { }
