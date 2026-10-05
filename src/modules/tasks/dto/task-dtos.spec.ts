import {
  BadRequestException,
  ParseUUIDPipe,
  ValidationPipe,
  type Type,
} from '@nestjs/common';

import { CreateTaskDto } from './create-task.dto';
import { ListTasksQueryDto } from './list-tasks-query.dto';
import { UpdateTaskDto } from './update-task.dto';

describe('Task DTO validation', () => {
  const validationPipe = new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  });

  const transformBody = <T>(value: unknown, metatype: Type<T>): Promise<T> =>
    validationPipe.transform(value, { type: 'body', metatype }) as Promise<T>;

  const transformQuery = <T>(value: unknown, metatype: Type<T>): Promise<T> =>
    validationPipe.transform(value, { type: 'query', metatype }) as Promise<T>;

  it('trims a valid title', async () => {
    await expect(
      transformBody({ title: '  Preparar entrega  ' }, CreateTaskDto),
    ).resolves.toMatchObject({ title: 'Preparar entrega' });
  });

  it.each([
    ['an invalid status', { title: 'Tarea', status: 'DONE' }],
    ['an invalid priority', { title: 'Tarea', priority: 'URGENT' }],
    ['a title longer than 120 characters', { title: 'a'.repeat(121) }],
    ['a blank title after trimming', { title: '   ' }],
    [
      'a description longer than 1000 characters',
      { title: 'Tarea', description: 'a'.repeat(1001) },
    ],
    ['an invalid due date', { title: 'Tarea', dueDate: 'next Tuesday' }],
    [
      'a client-supplied userId',
      {
        title: 'Tarea',
        userId: '22222222-2222-4222-8222-222222222222',
      },
    ],
  ])('rejects %s', async (_caseName, value) => {
    await expect(transformBody(value, CreateTaskDto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a pagination limit greater than 100', async () => {
    await expect(
      transformQuery({ limit: '101' }, ListTasksQueryDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('transforms valid page and limit values to numbers', async () => {
    await expect(
      transformQuery({ page: '2', limit: '25' }, ListTasksQueryDto),
    ).resolves.toMatchObject({ page: 2, limit: 25 });
  });

  it('accepts and transforms a valid partial update', async () => {
    await expect(
      transformBody(
        { title: '  Título actualizado  ', description: null, dueDate: null },
        UpdateTaskDto,
      ),
    ).resolves.toEqual({
      title: 'Título actualizado',
      description: null,
      dueDate: null,
    });
  });

  it('rejects an invalid UUID path parameter', async () => {
    const uuidPipe = new ParseUUIDPipe({ version: '4' });

    await expect(
      uuidPipe.transform('not-a-uuid', { type: 'param' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
