import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import { TaskPriority } from '../enums/task-priority.enum';
import { TaskStatus } from '../enums/task-status.enum';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateTaskDto {
  @ApiProperty({ minLength: 1, maxLength: 120 })
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  title!: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 1000 })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ApiPropertyOptional({ enum: TaskStatus, default: TaskStatus.PENDING })
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: TaskPriority, default: TaskPriority.MEDIUM })
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
  })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsISO8601({ strict: true })
  dueDate?: string | null;
}
