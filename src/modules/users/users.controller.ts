import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { User } from './entities/user.entity';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { PaginatedUsersResponseDto } from './dto/paginated-users-response.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

interface AuthenticatedRequest extends Request {
  user: User;
}

@ApiTags('users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Token ausente, inválido, vencido o revocado.',
})
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Consultar el perfil propio' })
  @ApiOkResponse({
    type: UserResponseDto,
    description: 'Perfil del usuario autenticado.',
  })
  @ApiNotFoundResponse({ description: 'Usuario autenticado no encontrado.' })
  getMyProfile(@Req() request: AuthenticatedRequest): Promise<UserResponseDto> {
    return this.usersService.getProfile(request.user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Actualizar nombre y/o correo del perfil propio' })
  @ApiBody({ type: UpdateProfileDto })
  @ApiOkResponse({ type: UserResponseDto, description: 'Perfil actualizado.' })
  @ApiBadRequestResponse({
    description: 'Datos inválidos, campos adicionales o body vacío.',
  })
  @ApiConflictResponse({ description: 'El correo ya está registrado.' })
  @ApiNotFoundResponse({ description: 'Usuario autenticado no encontrado.' })
  updateMyProfile(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    if (dto.name === undefined && dto.email === undefined) {
      throw new BadRequestException('Debe proporcionar al menos un campo');
    }

    return this.usersService.updateProfile(request.user.id, dto);
  }

  @Get()
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Listar usuarios de forma paginada (ADMIN)' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    minimum: 1,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    minimum: 1,
    maximum: 100,
    example: 10,
  })
  @ApiOkResponse({
    type: PaginatedUsersResponseDto,
    description: 'Página de usuarios públicos.',
  })
  @ApiBadRequestResponse({ description: 'Parámetros de paginación inválidos.' })
  @ApiForbiddenResponse({ description: 'Se requiere el rol ADMIN.' })
  listUsers(
    @Query() query: ListUsersQueryDto,
  ): Promise<PaginatedUsersResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    return this.usersService.listUsers(page, limit);
  }

  @Patch(':id/role')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Cambiar el rol de un usuario (ADMIN)' })
  @ApiParam({ name: 'id', description: 'UUID del usuario', format: 'uuid' })
  @ApiBody({ type: UpdateUserRoleDto })
  @ApiOkResponse({ type: UserResponseDto, description: 'Rol actualizado.' })
  @ApiBadRequestResponse({ description: 'UUID, rol o body inválido.' })
  @ApiForbiddenResponse({ description: 'Se requiere el rol ADMIN.' })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado.' })
  @ApiConflictResponse({
    description: 'No se puede quitar el rol al último ADMIN.',
  })
  updateUserRole(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateUserRoleDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateRole(id, dto.role);
  }
}
