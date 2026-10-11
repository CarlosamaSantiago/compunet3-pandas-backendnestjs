import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';
import migrationSource from '../src/database/data-source';

const credentials = {
  name: 'Ana',
  email: 'ana@correo.com',
  password: '12345678',
};

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;

  const http = () => app.getHttpServer() as Server;

  async function registerAna(): Promise<string> {
    const res = await request(http())
      .post('/api/auth/register')
      .send(credentials)
      .expect(201);
    return (res.body as { id: string }).id;
  }

  async function login(): Promise<string> {
    const res = await request(http())
      .post('/api/auth/login')
      .send({ email: credentials.email, password: credentials.password })
      .expect(200);
    return (res.body as { accessToken: string }).accessToken;
  }

  beforeAll(async () => {
    // Seguridad: nunca borrar una base que no sea de pruebas.
    expect(String(migrationSource.options.database)).toMatch(/_test$/);

    // Base vacía + migrations (evidencia de "migrations sobre base vacía").
    await migrationSource.initialize();
    await migrationSource.dropDatabase();
    await migrationSource.runMigrations();
    await migrationSource.destroy();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    dataSource = app.get(DataSource);
    jwtService = app.get(JwtService);
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE "users" CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    it('creates a USER without exposing sensitive fields', async () => {
      const res = await request(http())
        .post('/api/auth/register')
        .send(credentials)
        .expect(201);

      const body = res.body as Record<string, unknown>;
      expect(body.role).toBe('USER');
      expect(body).not.toHaveProperty('passwordHash');
      expect(body).not.toHaveProperty('tokenVersion');
    });

    it('normalizes the email to lowercase without spaces', async () => {
      const res = await request(http())
        .post('/api/auth/register')
        .send({ ...credentials, email: '  ANA@Correo.COM ' })
        .expect(201);

      expect((res.body as { email: string }).email).toBe('ana@correo.com');
    });

    it('returns 409 for a duplicate email', async () => {
      await registerAna();
      await request(http())
        .post('/api/auth/register')
        .send(credentials)
        .expect(409);
    });

    it('rejects a role sent by the client (400)', async () => {
      await request(http())
        .post('/api/auth/register')
        .send({ ...credentials, role: 'ADMIN' })
        .expect(400);
    });

    it('rejects invalid input (400)', async () => {
      await request(http())
        .post('/api/auth/register')
        .send({ name: 'A', email: 'no-es-correo', password: '123' })
        .expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns a bearer token for valid credentials', async () => {
      await registerAna();
      const res = await request(http())
        .post('/api/auth/login')
        .send({ email: credentials.email, password: credentials.password })
        .expect(200);

      const body = res.body as {
        accessToken: string;
        tokenType: string;
        expiresIn: number;
      };
      expect(body.accessToken).toEqual(expect.any(String));
      expect(body.tokenType).toBe('Bearer');
      expect(body.expiresIn).toBeGreaterThan(0);
    });

    it('rejects a wrong password (401)', async () => {
      await registerAna();
      await request(http())
        .post('/api/auth/login')
        .send({ email: credentials.email, password: 'incorrecta1' })
        .expect(401);
    });

    it('rejects an unknown email (401)', async () => {
      await request(http())
        .post('/api/auth/login')
        .send({ email: 'nadie@correo.com', password: '12345678' })
        .expect(401);
    });
  });

  describe('protected routes', () => {
    it('GET /api/health is public', async () => {
      await request(http()).get('/api/health').expect(200);
    });

    it('accepts a valid token', async () => {
      await registerAna();
      const token = await login();
      await request(http())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('rejects a missing token (401)', async () => {
      await request(http()).get('/api/users/me').expect(401);
    });

    it('rejects a malformed token (401)', async () => {
      await request(http())
        .get('/api/users/me')
        .set('Authorization', 'Bearer esto.no.es.un.jwt')
        .expect(401);
    });

    it('rejects an expired token (401)', async () => {
      const id = await registerAna();
      const expired = await jwtService.signAsync(
        { sub: id, tokenVersion: 0 },
        { expiresIn: -10 },
      );
      await request(http())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${expired}`)
        .expect(401);
    });

    it('rejects a token signed with another secret (401)', async () => {
      const id = await registerAna();
      const forged = await jwtService.signAsync(
        { sub: id, tokenVersion: 0 },
        { secret: 'otro-secreto-distinto' },
      );
      await request(http())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${forged}`)
        .expect(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('requires authentication (401)', async () => {
      await request(http()).post('/api/auth/logout').expect(401);
    });

    it('revokes the token: it cannot be reused after logout', async () => {
      await registerAna();
      const token = await login();

      await request(http())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      await request(http())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
      await request(http())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });

    it('allows a new login after logout', async () => {
      await registerAna();
      const first = await login();
      await request(http())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${first}`)
        .expect(204);

      const second = await login();
      await request(http())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${second}`)
        .expect(200);
    });
  });

  describe('role changes (RN-07)', () => {
    it('applies a role change to an already issued token', async () => {
      await registerAna();
      const token = await login();

      await request(http())
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      await dataSource.query(
        `UPDATE "users" SET "role" = 'ADMIN' WHERE "email" = $1`,
        [credentials.email],
      );

      await request(http())
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });
});