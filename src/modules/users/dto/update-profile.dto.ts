import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, ValidateIf } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class UpdateProfileDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 100, example: 'Ana Pérez' })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  name?: string;

  @ApiPropertyOptional({ format: 'email', example: 'ana@correo.com' })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(normalizeEmail)
  @IsEmail()
  email?: string;
}
