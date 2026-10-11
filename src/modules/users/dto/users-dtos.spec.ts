import {
  BadRequestException,
  ParseUUIDPipe,
  ValidationPipe,
  type Type,
} from '@nestjs/common';

import { Role } from '../../../common/enums/role.enum';
import { ListUsersQueryDto } from './list-users-query.dto';
import { UpdateProfileDto } from './update-profile.dto';
import { UpdateUserRoleDto } from './update-user-role.dto';

describe('Users DTO validation', () => {
  const validationPipe = new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  });

  const transform = <T>(value: unknown, metatype: Type<T>): Promise<T> =>
    validationPipe.transform(value, { type: 'body', metatype }) as Promise<T>;

  const transformQuery = <T>(value: unknown, metatype: Type<T>): Promise<T> =>
    validationPipe.transform(value, { type: 'query', metatype }) as Promise<T>;

  it('trims the name and trims/lowercases the email', async () => {
    await expect(
      transform(
        { name: '  Maria Perez  ', email: '  MARIA@EMAIL.COM  ' },
        UpdateProfileDto,
      ),
    ).resolves.toMatchObject({
      name: 'Maria Perez',
      email: 'maria@email.com',
    });
  });

  it.each([
    ['a name shorter than 2 characters', { name: 'M' }],
    ['an invalid email', { email: 'not-an-email' }],
    ['an unsupported role on a profile patch', { role: Role.ADMIN }],
    ['a password hash on a profile patch', { passwordHash: 'secret' }],
    ['a null name', { name: null }],
  ])('rejects %s', async (_description, body) => {
    await expect(transform(body, UpdateProfileDto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('transforms valid pagination query values to numbers', async () => {
    await expect(
      transformQuery({ page: '2', limit: '25' }, ListUsersQueryDto),
    ).resolves.toMatchObject({ page: 2, limit: 25 });
  });

  it.each([
    ['a zero page', { page: '0' }],
    ['a fractional page', { page: '1.5' }],
    ['a zero limit', { limit: '0' }],
    ['a limit greater than 100', { limit: '101' }],
    ['a nonnumeric limit', { limit: 'many' }],
  ])('rejects %s', async (_description, query) => {
    await expect(
      transformQuery(query, ListUsersQueryDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts USER and ADMIN and rejects unsupported role strings', async () => {
    await expect(
      transform({ role: Role.USER }, UpdateUserRoleDto),
    ).resolves.toMatchObject({ role: Role.USER });
    await expect(
      transform({ role: Role.ADMIN }, UpdateUserRoleDto),
    ).resolves.toMatchObject({ role: Role.ADMIN });
    await expect(
      transform({ role: 'admin' }, UpdateUserRoleDto),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      transform(
        { role: Role.USER, passwordHash: 'secret' },
        UpdateUserRoleDto,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a malformed UUID path parameter', async () => {
    await expect(
      new ParseUUIDPipe({ version: '4' }).transform('not-a-uuid', {
        type: 'param',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});