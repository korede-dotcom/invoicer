import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { LocationsService } from './locations.service';
import { CreateProjectDto, EditProjectDto, SearchProjectDto } from './dto/projects.dto';
import { AllowAnonymous } from '@/decorators/allow-anonymous.decorator';

@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly locationsService: LocationsService,
  ) {}

  @Post()
  createProject(@Body() body: CreateProjectDto) {
    return this.projectsService.createProject(body);
  }

  @Get()
  getProjects() {
    return this.projectsService.getProjects();
  }

  @Get('search')
  searchProjects(@Query() query: SearchProjectDto) {
    return this.projectsService.searchProjects(query);
  }

  @Get(':id')
  getProjectById(@Param('id') id: string) {
    return this.projectsService.getProjectById(id);
  }

  @Get(':id/analytics')
  getProjectAnalytics(@Param('id') id: string) {
    return this.projectsService.getProjectAnalytics(id);
  }

  @Get(':id/clients')
  getClientsByProjectId(@Param('id') id: string) {
    return this.projectsService.getClientsByProjectId(id);
  }

  @Patch(':id')
  updateProject(@Param('id') id: string, @Body() body: Omit<EditProjectDto, 'id'>) {
    return this.projectsService.updateProject({ ...body, id });
  }

  @Delete(':id')
  deleteProject(@Param('id') id: string) {
    return this.projectsService.deleteProject(id);
  }

  // Location endpoints - Public access (no authentication required)
  @Get('locations/countries')
  @AllowAnonymous()
  getCountries() {
    return this.locationsService.getCountries();
  }

  @Get('locations/states')
  @AllowAnonymous()
  getStates(@Query('country') country: string) {
    if (!country) {
      return {
        success: false,
        message: 'Country parameter is required',
        data: [],
      };
    }
    return this.locationsService.getStates(country);
  }

  @Get('locations/cities')
  @AllowAnonymous()
  getCities(
    @Query('country') country: string,
    @Query('state') state: string,
  ) {
    if (!country || !state) {
      return {
        success: false,
        message: 'Country and state parameters are required',
        data: [],
      };
    }
    return this.locationsService.getCities(country, state);
  }
}

