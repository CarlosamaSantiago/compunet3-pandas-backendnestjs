import { type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import type { Server } from 'node:http';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { User } from '../src/modules/users/entities/user.entity';

describe('Health endpoint (e2e)', () => {
  let app: INestApplication | undefined;

  jest.setTimeout(30_000);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getDataSourceToken())
      .useValue({ isInitialized: false })
      .overrideProvider(getRepositoryToken(User))
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/health returns the application status', async () => {
    if (!app) {
      throw new Error('Nest application did not initialize');
    }

    await request(app.getHttpServer() as Server)
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok' });
  });
});
