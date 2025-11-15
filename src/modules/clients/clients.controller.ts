import { ClientsService } from '@/modules/clients/clients.service';
import { EditClientsDto, SearchClientsDto } from '@/modules/clients/dto/clients.dto';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
} from '@nestjs/common';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  async getClientsInfo(@Param('page') page: string, @Request() req) {
    // If project token, filter by project
    if (req.project) {
      return await this.clientsService.getClientsByProject(req.project.projectId, page);
    }
    return await this.clientsService.getClients(page);
  }

  @Get('search')
  async searchClients(@Query('query') query: string, @Request() req) {
    // If project token, filter by project
    if (req.project) {
      return await this.clientsService.searchClientsByProject(req.project.projectId, query);
    }
    return await this.clientsService.searchClients(query);
  }

  @Get('search-advanced')
  async searchClientsAdvanced(@Query() filters: SearchClientsDto, @Request() req) {
    // If project token, add project filter
    if (req.project) {
      return await this.clientsService.searchClientsAdvanced({ ...filters, projectId: req.project.projectId });
    }
    return await this.clientsService.searchClientsAdvanced(filters);
  }

  @Get(':id/project')
  async getProjectByClientId(@Param('id') id: string) {
    return await this.clientsService.getProjectByClientId(id);
  }

  @Post()
  postClientsInfo(@Body() body: EditClientsDto, @Request() req) {
    // If project token, automatically set projectId
    if (req.project) {
      return this.clientsService.createClient({ ...body, projectId: req.project.projectId });
    }
    return this.clientsService.createClient(body);
  }

  @Patch(':id')
  async editClientsInfo(@Param('id') id: string, @Body() body: EditClientsDto, @Request() req) {
    // If project token, verify client belongs to project
    if (req.project) {
      await this.clientsService.verifyClientOwnership(id, req.project.projectId);
    }
    return this.clientsService.editClientsInfo({ ...body, id });
  }

  @Delete(':id')
  async deleteClient(@Param('id') id: string, @Request() req) {
    // If project token, verify client belongs to project
    if (req.project) {
      await this.clientsService.verifyClientOwnership(id, req.project.projectId);
    }
    return this.clientsService.deleteClient(id);
  }
}
