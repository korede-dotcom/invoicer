import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { LocationsService } from './locations.service';
import { ProjectAuthController } from './project-auth.controller';
import { ProjectPortalController } from './project-portal.controller';
import { MailModule } from '@/mail/mail.module';

@Module({
  imports: [
    MailModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [ProjectsController, ProjectAuthController, ProjectPortalController],
  providers: [
    ProjectsService,
    LocationsService,
  ],
  exports: [ProjectsService],
})
export class ProjectsModule {}

