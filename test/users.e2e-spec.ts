import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { Role } from '../src/common/enums/role.enum';
import { User } from '../src/modules/users/entities/user.entity';
import { createTestApp, resetTestDatabase } from './helpers/test-app';

interface Session {
  id: string;
  email: string;
  token: string;
}

interface UserResponse {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

interface UserPage {
  items: UserResponse[];
  total: number;
  page: number;
  limit: number;
}

interface ErrorResponse {
  statusCode: number;
  message: string | string[];
}

describe('Users (PostgreSQL e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let user: Session;
  let other: Session;
  let admin: Session;
  const http = () => app.getHttpServer() as Server;

  async function register(email: string): Promise<Session> {
    const credentials = {
      name: 'User Tester',
      email,
      password: 'UserTest123!',
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
      email,
      token: (login.body as { accessToken: string }).accessToken,
    };
  }

  async function storedRole(id: string): Promise<Role | undefined> {
    const stored = await dataSource.getRepository(User).findOneBy({ id });
    return stored?.role;
  }

  function expectPublicUser(body: unknown): void {
    expect(body).toEqual(
      expect.objectContaining({
        id: expect.any(String) as string,
        name: expect.any(String) as string,
        email: expect.any(String) as string,
        role: expect.any(String) as string,
      }),
    );
    expect(body).not.toHaveProperty('passwordHash');
    expect(body).not.toHaveProperty('tokenVersion');
  }

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE "users" CASCADE');
    user = await register('user@users.test');
    other = await register('other@users.test');
    admin = await register('admin@users.test');
    // The already-issued token must use the current database role.
    await dataSource.getRepository(User).update(admin.id, { role: Role.ADMIN });
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('GET /api/users/me', () => {
    it('returns the authenticated profile without sensitive fields', async () => {
      const result = await request(http())
        .get('/api/users/me')
        .auth(user.token, { type: 'bearer' })
        .expect(200);

      expectPublicUser(result.body);
      expect(result.body).toMatchObject({
        id: user.id,
        email: user.email,
        role: Role.USER,
      });
    });

    it('requires authentication (401)', async () => {
      await request(http()).get('/api/users/me').expect(401);
    });
  });

  describe('PATCH /api/users/me', () => {
    it('updates the name and persists a normalized email', async () => {
      const result = await request(http())
        .patch('/api/users/me')
        .auth(user.token, { type: 'bearer' })
        .send({ name: '  Ana Pérez  ', email: '  ANA.PEREZ@Users.TEST  ' })
        .expect(200);

      expectPublicUser(result.body);
      expect(result.body).toMatchObject({
        name: 'Ana Pérez',
        email: 'ana.perez@users.test',
        role: Role.USER,
      });
      const stored = await dataSource
        .getRepository(User)
        .findOneByOrFail({ id: user.id });
      expect(stored.email).toBe('ana.perez@users.test');
    });

    it.each([
      ['the same email', 'other@users.test'],
      ['the same email with other casing', '  OTHER@USERS.TEST '],
    ])('returns 409 when another user already has %s', async (_case, email) => {
      const result = await request(http())
        .patch('/api/users/me')
        .auth(user.token, { type: 'bearer' })
        .send({ email })
        .expect(409);

      expect((result.body as ErrorResponse).statusCode).toBe(409);
    });

    it.each([
      ['an empty update', {}],
      ['an invalid email', { email: 'not-an-email' }],
      ['a name shorter than 2 characters', { name: 'A' }],
      ['a role change', { role: Role.ADMIN }],
      ['a password change', { password: 'OtherPassword123' }],
    ])('rejects %s (400) and keeps the USER role', async (_case, body) => {
      const result = await request(http())
        .patch('/api/users/me')
        .auth(user.token, { type: 'bearer' })
        .send(body)
        .expect(400);

      expect((result.body as ErrorResponse).statusCode).toBe(400);
      expect(await storedRole(user.id)).toBe(Role.USER);
    });
  });

  describe('GET /api/users', () => {
    it('forbids the listing to a USER (403)', async () => {
      await request(http())
        .get('/api/users')
        .auth(user.token, { type: 'bearer' })
        .expect(403);
    });

    it('lists users for an ADMIN with default pagination and public fields', async () => {
      const result = await request(http())
        .get('/api/users')
        .auth(admin.token, { type: 'bearer' })
        .expect(200);
      const page = result.body as UserPage;

      expect(page).toMatchObject({ total: 3, page: 1, limit: 10 });
      expect(page.items).toHaveLength(3);
      page.items.forEach(expectPublicUser);
      expect(page.items.map(({ email }) => email).sort()).toEqual([
        'admin@users.test',
        'other@users.test',
        'user@users.test',
      ]);
    });

    it('paginates without duplicates and returns an empty out-of-range page', async () => {
      const pages = await Promise.all(
        [1, 2, 3].map((page) =>
          request(http())
            .get(`/api/users?page=${page}&limit=2`)
            .auth(admin.token, { type: 'bearer' })
            .expect(200),
        ),
      );
      const [first, second, third] = pages.map(({ body }) => body as UserPage);

      expect(first).toMatchObject({ total: 3, page: 1, limit: 2 });
      expect(first.items).toHaveLength(2);
      expect(second.items).toHaveLength(1);
      expect(third.items).toHaveLength(0);
      const ids = [...first.items, ...second.items].map(({ id }) => id);
      expect(new Set(ids).size).toBe(3);
    });

    it.each(['page=0', 'page=1.5', 'page=abc', 'limit=0', 'limit=101'])(
      'rejects invalid pagination %s (400)',
      async (query) => {
        await request(http())
          .get(`/api/users?${query}`)
          .auth(admin.token, { type: 'bearer' })
          .expect(400);
      },
    );
  });

  describe('PATCH /api/users/:id/role', () => {
    it('forbids a USER from changing roles, including their own (403)', async () => {
      await request(http())
        .patch(`/api/users/${user.id}/role`)
        .auth(user.token, { type: 'bearer' })
        .send({ role: Role.ADMIN })
        .expect(403);

      expect(await storedRole(user.id)).toBe(Role.USER);
    });

    it('applies promotion and demotion to an already issued token', async () => {
      await request(http())
        .get('/api/users')
        .auth(user.token, { type: 'bearer' })
        .expect(403);

      const promoted = await request(http())
        .patch(`/api/users/${user.id}/role`)
        .auth(admin.token, { type: 'bearer' })
        .send({ role: Role.ADMIN })
        .expect(200);
      expectPublicUser(promoted.body);
      expect((promoted.body as UserResponse).role).toBe(Role.ADMIN);

      await request(http())
        .get('/api/users')
        .auth(user.token, { type: 'bearer' })
        .expect(200);

      await request(http())
        .patch(`/api/users/${user.id}/role`)
        .auth(admin.token, { type: 'bearer' })
        .send({ role: Role.USER })
        .expect(200);

      await request(http())
        .get('/api/users')
        .auth(user.token, { type: 'bearer' })
        .expect(403);
    });

    it.each([
      ['a malformed UUID', 'not-a-uuid', { role: Role.ADMIN }],
      ['an unsupported role', 'USER_ID', { role: 'SUPERADMIN' }],
      ['an empty body', 'USER_ID', {}],
      ['an extra field', 'USER_ID', { role: Role.ADMIN, email: 'x@y.test' }],
    ])('rejects %s (400)', async (_case, id, body) => {
      await request(http())
        .patch(`/api/users/${id === 'USER_ID' ? user.id : id}/role`)
        .auth(admin.token, { type: 'bearer' })
        .send(body)
        .expect(400);

      expect(await storedRole(user.id)).toBe(Role.USER);
    });

    it('returns 404 for a user that does not exist', async () => {
      await request(http())
        .patch(`/api/users/${randomUUID()}/role`)
        .auth(admin.token, { type: 'bearer' })
        .send({ role: Role.ADMIN })
        .expect(404);
    });

    it('protects the last ADMIN from losing the role (409)', async () => {
      const result = await request(http())
        .patch(`/api/users/${admin.id}/role`)
        .auth(admin.token, { type: 'bearer' })
        .send({ role: Role.USER })
        .expect(409);

      expect((result.body as ErrorResponse).statusCode).toBe(409);
      expect(await storedRole(admin.id)).toBe(Role.ADMIN);
    });

    it('allows demoting an ADMIN while another ADMIN remains', async () => {
      await dataSource
        .getRepository(User)
        .update(other.id, { role: Role.ADMIN });

      await request(http())
        .patch(`/api/users/${other.id}/role`)
        .auth(admin.token, { type: 'bearer' })
        .send({ role: Role.USER })
        .expect(200);

      expect(await storedRole(other.id)).toBe(Role.USER);
    });

    it('keeps one ADMIN when two ADMINs demote each other at the same time', async () => {
      await dataSource
        .getRepository(User)
        .update(other.id, { role: Role.ADMIN });

      const responses = await Promise.all([
        request(http())
          .patch(`/api/users/${other.id}/role`)
          .auth(admin.token, { type: 'bearer' })
          .send({ role: Role.USER }),
        request(http())
          .patch(`/api/users/${admin.id}/role`)
          .auth(other.token, { type: 'bearer' })
          .send({ role: Role.USER }),
      ]);

      // One demotion succeeds; the other sees one ADMIN left and is refused
      // (409) or, if it ran after its own demotion, fails authorization (403).
      const statuses = responses.map(({ status }) => status).sort();
      expect(statuses[0]).toBe(200);
      expect([403, 409]).toContain(statuses[1]);
      const admins = await dataSource
        .getRepository(User)
        .countBy({ role: Role.ADMIN });
      expect(admins).toBe(1);
    });
  });
});
