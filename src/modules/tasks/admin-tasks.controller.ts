import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { TasksService } from './tasks.service';

@ApiTags('admin tasks')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Autenticación requerida' })
@ApiForbiddenResponse({ description: 'Rol ADMIN requerido' })
@Roles(Role.ADMIN)
@UseGuards(RolesGuard)
@Controller('admin/tasks')
export class AdminTasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas las tareas con su propietario' })
  @ApiOkResponse({ description: 'Listado paginado de todas las tareas' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.tasksService.findAllForAdmin(query);
  }
}
