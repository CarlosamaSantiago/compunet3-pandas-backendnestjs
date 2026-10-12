import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { Role } from '../src/common/enums/role.enum';
import { Task } from '../src/modules/tasks/entities/task.entity';
import { User } from '../src/modules/users/entities/user.entity';
import { createTestApp, resetTestDatabase } from './helpers/test-app';

interface Session {
  id: string;
  token: string;
}

interface TaskResponse {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  user?: { id: string; name: string; email: string };
}

interface TaskPage {
  items: TaskResponse[];
  total: number;
  page: number;
  limit: number;
}

describe('Tasks (PostgreSQL e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let owner: Session;
  let other: Session;
  let admin: Session;
  const http = () => app.getHttpServer() as Server;

  async function register(email: string): Promise<Session> {
    const credentials = {
      name: 'Task Tester',
      email,
      password: 'TaskTest123!',
    };
    const registered = await request(http())
      .post('/api/auth/register')
      .send(credentials)
      .expect(201);
    const login = await request(http())
      .post('/api/auth/login')
      .send({ email, password: credentials.password })
      .expect(200);
    return {
      id: (registered.body as { id: string }).id,
      token: (login.body as { accessToken: string }).accessToken,
    };
  }

  async function createTask(
    session = owner,
    fields: Record<string, unknown> = {},
  ): Promise<TaskResponse> {
    const result = await request(http())
      .post('/api/tasks')
      .auth(session.token, { type: 'bearer' })
      .send({ title: 'Tarea de prueba', ...fields })
      .expect(201);
    return result.body as TaskResponse;
  }

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE "users" CASCADE');
    owner = await register('owner@tasks.test');
    other = await register('other@tasks.test');
    admin = await register('admin@tasks.test');
    // The already-issued token must use the current database role.
    await dataSource.getRepository(User).update(admin.id, { role: Role.ADMIN });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('creates, lists, reads, updates and deletes a persisted task', async () => {
    const task = await createTask(owner, { title: '  Preparar entrega  ' });
    expect(task).toMatchObject({
      title: 'Preparar entrega',
      userId: owner.id,
      status: 'PENDING',
      priority: 'MEDIUM',
      description: null,
      dueDate: null,
    });
    const stored = await dataSource
      .getRepository(Task)
      .findOneByOrFail({ id: task.id });
    expect(stored.userId).toBe(owner.id);

    const list = await request(http())
      .get('/api/tasks')
      .auth(owner.token, { type: 'bearer' })
      .expect(200);
    expect(list.body).toMatchObject({
      items: [{ id: task.id }],
      total: 1,
      page: 1,
      limit: 10,
    });
    const detail = await request(http())
      .get(`/api/tasks/${task.id}`)
      .auth(owner.token, { type: 'bearer' })
      .expect(200);
    expect(detail.body).toEqual(task);

    const changed = await request(http())
      .patch(`/api/tasks/${task.id}`)
      .auth(owner.token, { type: 'bearer' })
      .send({
        title: '  Entrega lista  ',
        description: 'Validada',
        status: 'COMPLETED',
        priority: 'HIGH',
        dueDate: '2026-10-13T12:00:00.000Z',
      })
      .expect(200);
    expect(changed.body).toMatchObject({
      id: task.id,
      userId: owner.id,
      title: 'Entrega lista',
      description: 'Validada',
      status: 'COMPLETED',
      priority: 'HIGH',
      dueDate: '2026-10-13T12:00:00.000Z',
    });
    const cleared = await request(http())
      .patch(`/api/tasks/${task.id}`)
      .auth(owner.token, { type: 'bearer' })
      .send({ description: null, dueDate: null })
      .expect(200);
    expect(cleared.body).toMatchObject({
      title: 'Entrega lista',
      description: null,
      dueDate: null,
    });

    const deleted = await request(http())
      .delete(`/api/tasks/${task.id}`)
      .auth(owner.token, { type: 'bearer' })
      .expect(204);
    expect(deleted.text).toBe('');
    expect(await dataSource.getRepository(Task).existsBy({ id: task.id })).toBe(
      false,
    );
    await request(http())
      .get(`/api/tasks/${task.id}`)
      .auth(owner.token, { type: 'bearer' })
      .expect(404);
  });

  it('returns 404 for foreign tasks, even for an ADMIN', async () => {
    const task = await createTask();
    for (const session of [other, admin]) {
      await request(http())
        .get(`/api/tasks/${task.id}`)
        .auth(session.token, { type: 'bearer' })
        .expect(404);
      await request(http())
        .patch(`/api/tasks/${task.id}`)
        .auth(session.token, { type: 'bearer' })
        .send({ title: 'Intento ajeno' })
        .expect(404);
      await request(http())
        .delete(`/api/tasks/${task.id}`)
        .auth(session.token, { type: 'bearer' })
        .expect(404);
    }
    expect(
      await dataSource.getRepository(Task).findOneByOrFail({ id: task.id }),
    ).toMatchObject({ title: task.title, userId: owner.id });
  });

  it('returns 404 for a missing UUID on read, update and delete', async () => {
    const path = `/api/tasks/${randomUUID()}`;
    await request(http())
      .get(path)
      .auth(owner.token, { type: 'bearer' })
      .expect(404);
    await request(http())
      .patch(path)
      .auth(owner.token, { type: 'bearer' })
      .send({ title: 'Missing' })
      .expect(404);
    await request(http())
      .delete(path)
      .auth(owner.token, { type: 'bearer' })
      .expect(404);
  });

  it('filters by status, priority and both without including another owner', async () => {
    const high = await createTask(owner, {
      status: 'IN_PROGRESS',
      priority: 'HIGH',
    });
    const low = await createTask(owner, {
      status: 'IN_PROGRESS',
      priority: 'LOW',
    });
    const pending = await createTask(owner, {
      status: 'PENDING',
      priority: 'HIGH',
    });
    await createTask(other, { status: 'IN_PROGRESS', priority: 'HIGH' });
    const cases = [
      ['status=IN_PROGRESS', [high.id, low.id]],
      ['priority=HIGH', [high.id, pending.id]],
      ['status=IN_PROGRESS&priority=HIGH', [high.id]],
      ['status=COMPLETED', []],
    ] as const;
    for (const [query, ids] of cases) {
      const result = await request(http())
        .get(`/api/tasks?${query}`)
        .auth(owner.token, { type: 'bearer' })
        .expect(200);
      const page = result.body as TaskPage;
      expect(page.total).toBe(ids.length);
      expect(page.items.map(({ id }) => id).sort()).toEqual([...ids].sort());
    }
  });

  it('paginates own tasks without duplicates and returns an empty out-of-range page', async () => {
    const tasks = [await createTask(), await createTask(), await createTask()];
    await createTask(other);
    const ids: string[] = [];
    for (const page of [1, 2, 3, 4]) {
      const result = await request(http())
        .get(`/api/tasks?page=${page}&limit=1`)
        .auth(owner.token, { type: 'bearer' })
        .expect(200);
      const body = result.body as TaskPage;
      expect(body).toMatchObject({ total: 3, page, limit: 1 });
      expect(body.items).toHaveLength(page === 4 ? 0 : 1);
      ids.push(...body.items.map(({ id }) => id));
    }
    expect(ids).toEqual(tasks.map(({ id }) => id).reverse());
  });

  it('allows only ADMIN to list all owners with pagination and public user fields', async () => {
    await createTask(owner);
    await createTask(other);
    await createTask(admin);
    await request(http())
      .get('/api/admin/tasks')
      .auth(owner.token, { type: 'bearer' })
      .expect(403);
    const result = await request(http())
      .get('/api/admin/tasks')
      .auth(admin.token, { type: 'bearer' })
      .expect(200);
    const page = result.body as TaskPage;
    expect(page.total).toBe(3);
    expect(page.items.map(({ userId }) => userId).sort()).toEqual(
      [owner.id, other.id, admin.id].sort(),
    );
    for (const task of page.items) {
      expect(task.user?.id).toBe(task.userId);
      expect(Object.keys(task.user ?? {}).sort()).toEqual([
        'email',
        'id',
        'name',
      ]);
    }
    const paginated = await request(http())
      .get('/api/admin/tasks?page=2&limit=1')
      .auth(admin.token, { type: 'bearer' })
      .expect(200);
    expect(paginated.body).toMatchObject({
      total: 3,
      page: 2,
      limit: 1,
      items: [page.items[1]],
    });
  });

  it('rejects an empty update after ValidationPipe transforms the DTO', async () => {
    const task = await createTask();
    await request(http())
      .patch(`/api/tasks/${task.id}`)
      .auth(owner.token, { type: 'bearer' })
      .send({})
      .expect(400);
  });

  it('rejects client-supplied userId on creation and update', async () => {
    await request(http())
      .post('/api/tasks')
      .auth(owner.token, { type: 'bearer' })
      .send({ title: 'Spoofed', userId: other.id })
      .expect(400);
    const task = await createTask();
    await request(http())
      .patch(`/api/tasks/${task.id}`)
      .auth(owner.token, { type: 'bearer' })
      .send({ title: 'Spoofed', userId: other.id })
      .expect(400);
    expect(await dataSource.getRepository(Task).count()).toBe(1);
    expect(
      await dataSource.getRepository(Task).findOneByOrFail({ id: task.id }),
    ).toMatchObject({ userId: owner.id, title: task.title });
  });

  it.each([
    ['blank title', { title: '   ' }],
    ['long title', { title: 'x'.repeat(121) }],
    ['long description', { description: 'x'.repeat(1001) }],
    ['invalid status', { status: 'DONE' }],
    ['invalid priority', { priority: 'URGENT' }],
    ['invalid date', { dueDate: '2026-02-30' }],
    ['null title', { title: null }],
    ['null status', { status: null }],
  ])('rejects %s on create and update', async (_label, fields) => {
    await request(http())
      .post('/api/tasks')
      .auth(owner.token, { type: 'bearer' })
      .send({ title: 'Tarea', ...fields })
      .expect(400);
    const task = await createTask();
    await request(http())
      .patch(`/api/tasks/${task.id}`)
      .auth(owner.token, { type: 'bearer' })
      .send(fields)
      .expect(400);
  });

  it.each([
    'page=0',
    'page=1.5',
    'page=abc',
    'limit=0',
    'limit=101',
    'limit=abc',
  ])('rejects invalid pagination %s on both listings', async (query) => {
    await request(http())
      .get(`/api/tasks?${query}`)
      .auth(owner.token, { type: 'bearer' })
      .expect(400);
    await request(http())
      .get(`/api/admin/tasks?${query}`)
      .auth(admin.token, { type: 'bearer' })
      .expect(400);
  });

  it.each(['status=INVALID', 'priority=INVALID', 'userId=anything'])(
    'rejects invalid or forbidden filters %s',
    async (query) => {
      await request(http())
        .get(`/api/tasks?${query}`)
        .auth(owner.token, { type: 'bearer' })
        .expect(400);
    },
  );

  it('rejects malformed task UUIDs', async () => {
    const path = '/api/tasks/not-a-uuid';
    await request(http())
      .get(path)
      .auth(owner.token, { type: 'bearer' })
      .expect(400);
    await request(http())
      .patch(path)
      .auth(owner.token, { type: 'bearer' })
      .send({ title: 'Tarea' })
      .expect(400);
    await request(http())
      .delete(path)
      .auth(owner.token, { type: 'bearer' })
      .expect(400);
  });

  it('requires JWT authentication on all six task endpoints', async () => {
    const task = await createTask();
    await request(http())
      .post('/api/tasks')
      .send({ title: 'Tarea' })
      .expect(401);
    await request(http()).get('/api/tasks').expect(401);
    await request(http()).get(`/api/tasks/${task.id}`).expect(401);
    await request(http())
      .patch(`/api/tasks/${task.id}`)
      .send({ title: 'Tarea' })
      .expect(401);
    await request(http()).delete(`/api/tasks/${task.id}`).expect(401);
    await request(http()).get('/api/admin/tasks').expect(401);
  });

  it('keeps the task and its owner after restarting the Nest application', async () => {
    const task = await createTask(owner, { description: 'Persistente' });
    await app.close();
    app = await createTestApp();
    dataSource = app.get(DataSource);
    const result = await request(http())
      .get(`/api/tasks/${task.id}`)
      .auth(owner.token, { type: 'bearer' })
      .expect(200);
    expect(result.body).toEqual(task);
  });

  it('enforces the PostgreSQL foreign key and cascades deletion of an owner', async () => {
    await expect(
      dataSource
        .getRepository(Task)
        .insert({ title: 'Orphan', userId: randomUUID() }),
    ).rejects.toMatchObject({ driverError: { code: '23503' } });
    const task = await createTask();
    await dataSource.getRepository(User).delete(owner.id);
    expect(await dataSource.getRepository(Task).existsBy({ id: task.id })).toBe(
      false,
    );
  });
});
