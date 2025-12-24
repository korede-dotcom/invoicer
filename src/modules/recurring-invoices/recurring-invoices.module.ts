import { JwtService } from '@nestjs/jwt';
import { Module, forwardRef } from '@nestjs/common';
import { RecurringInvoicesController } from '@/modules/recurring-invoices/recurring-invoices.controller';
import { MailService } from '@/mail/mail.service';
import { InvoicesService } from '@/modules/invoices/invoices.service';
import { RecurringInvoicesCronService } from '@/modules/recurring-invoices/cron.service';
import { RecurringInvoicesService } from '@/modules/recurring-invoices/recurring-invoices.service';
import { PaymentModule } from '@/modules/payments/payment.module';

@Module({
  imports: [forwardRef(() => PaymentModule)],
  controllers: [RecurringInvoicesController],
  providers: [
    RecurringInvoicesService,
    RecurringInvoicesCronService,
    InvoicesService,
    MailService,
    JwtService,
  ],
  exports: [RecurringInvoicesService, RecurringInvoicesCronService],
})
export class RecurringInvoicesModule {}
