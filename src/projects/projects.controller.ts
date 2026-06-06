import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { type JwtPayload } from '../auth/types/jwt-payload.type';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.projectsService.findAll(user.organizationId);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(user.organizationId, dto);
  }

  @Get(':projectId')
  findOne(@Param('projectId') projectId: string) {
    return this.projectsService.findOne(projectId);
  }

  @Patch(':projectId')
  update(@Param('projectId') projectId: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(projectId, dto);
  }

  @Delete(':projectId')
  remove(@Param('projectId') projectId: string) {
    return this.projectsService.remove(projectId);
  }
}
