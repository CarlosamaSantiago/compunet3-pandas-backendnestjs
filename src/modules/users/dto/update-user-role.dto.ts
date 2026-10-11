import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { Role } from '../../../common/enums/role.enum';

export class UpdateUserRoleDto {
  @ApiProperty({ enum: Role, example: Role.USER })
  @IsEnum(Role)
  role!: Role;
}
