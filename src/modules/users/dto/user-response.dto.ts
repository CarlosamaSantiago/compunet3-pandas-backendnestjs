import { ApiProperty } from '@nestjs/swagger';

import { Role } from '../../../common/enums/role.enum';

export class UserResponseDto {
  @ApiProperty({
    format: 'uuid',
    example: '73512760-018f-4dff-821f-487fa2df718f',
  })
  id!: string;

  @ApiProperty({ example: 'Ana' })
  name!: string;

  @ApiProperty({ example: 'ana@correo.com' })
  email!: string;

  @ApiProperty({ enum: Role, example: Role.USER })
  role!: Role;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}
