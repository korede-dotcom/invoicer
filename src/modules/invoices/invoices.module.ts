import { MailService } from "@/mail/mail.service";
import { InvoicesController } from "@/modules/invoices/invoices.controller";
import { InvoicesService } from "@/modules/invoices/invoices.service";
import { PluginsService } from "@/modules/plugins/plugins.service";
import { Module, forwardRef } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PaymentModule } from "@/modules/payments/payment.module";

@Module({
  imports: [forwardRef(() => PaymentModule)],
  controllers: [InvoicesController],
  providers: [InvoicesService, MailService, JwtService, PluginsService],
  exports: [InvoicesService],
})
export class InvoicesModule { }
