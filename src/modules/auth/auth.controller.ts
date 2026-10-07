import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { User } from '../users/entities/user.entity';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Registrar un usuario (rol USER)' })
  @ApiCreatedResponse({
    description: 'Usuario creado.',
    schema: {
      example: {
        id: '73512760-018f-4dff-821f-487fa2df718f',
        name: 'Ana',
        email: 'ana@correo.com',
        role: 'USER',
        createdAt: '2026-10-04T19:35:12.140Z',
        updatedAt: '2026-10-04T19:35:12.140Z',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Datos inválidos o campos no permitidos.' })
  @ApiConflictResponse({ description: 'El correo ya está registrado.' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Iniciar sesión y obtener un JWT' })
  @ApiOkResponse({
    description: 'Token de acceso.',
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        tokenType: 'Bearer',
        expiresIn: 3600,
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Datos inválidos.' })
  @ApiUnauthorizedResponse({ description: 'Credenciales incorrectas.' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Cerrar sesión e invalidar los tokens anteriores' })
  @ApiNoContentResponse({ description: 'Sesión cerrada.' })
  @ApiUnauthorizedResponse({
    description: 'Token ausente, inválido, vencido o revocado.',
  })
  async logout(@CurrentUser() user: User): Promise<void> {
    await this.authService.logout(user.id);
  }
}