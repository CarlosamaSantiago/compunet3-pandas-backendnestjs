import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { User } from '../users/entities/user.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

interface AuthenticatedRequest extends Request {
  user: User;
}

@ApiTags('tasks')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Autenticación requerida' })
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una tarea propia' })
  @ApiCreatedResponse({ description: 'Tarea creada' })
  @ApiBadRequestResponse({ description: 'Datos de la tarea inválidos' })
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(request.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar las tareas propias' })
  @ApiOkResponse({ description: 'Listado paginado de tareas propias' })
  findMine(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListTasksQueryDto,
  ) {
    return this.tasksService.findMine(request.user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar una tarea propia' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Detalle de la tarea' })
  @ApiBadRequestResponse({ description: 'Identificador inválido' })
  @ApiNotFoundResponse({ description: 'Tarea inexistente o ajena' })
  findMineById(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.tasksService.findMineById(request.user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una tarea propia' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Tarea actualizada' })
  @ApiBadRequestResponse({ description: 'Actualización inválida o vacía' })
  @ApiNotFoundResponse({ description: 'Tarea inexistente o ajena' })
  updateMine(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    if (!Object.values(dto).some((value) => value !== undefined)) {
      throw new BadRequestException('Debe proporcionar al menos un campo');
    }

    return this.tasksService.updateMine(request.user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una tarea propia' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Tarea eliminada' })
  @ApiBadRequestResponse({ description: 'Identificador inválido' })
  @ApiNotFoundResponse({ description: 'Tarea inexistente o ajena' })
  removeMine(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.tasksService.removeMine(request.user.id, id);
  }
}
