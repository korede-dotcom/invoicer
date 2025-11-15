import { Module } from '@nestjs/common';
import { ClientsController } from '@/modules/clients/clients.controller';
import { ClientsService } from '@/modules/clients/clients.service';
import { MailService } from '@/mail/mail.service';

@Module({
  controllers: [ClientsController],
  providers: [ClientsService, MailService]
})
export class ClientsModule { }
