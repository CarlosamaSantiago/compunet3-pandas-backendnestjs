import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, ValidateIf } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class UpdateProfileDto {
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  name?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(normalizeEmail)
  @IsEmail()
  email?: string;
}
