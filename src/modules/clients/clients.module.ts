import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ClientsController } from '@/modules/clients/clients.controller';
import { ClientsService } from '@/modules/clients/clients.service';
import { ClientAuthController } from './client-auth.controller';
import { ClientPortalController } from './client-portal.controller';
import { MailModule } from '@/mail/mail.module';

@Module({
  imports: [
    MailModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [ClientsController, ClientAuthController, ClientPortalController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule { }
