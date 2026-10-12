import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '../../src/app.module';
import migrationSource from '../../src/database/data-source';

export async function resetTestDatabase(): Promise<void> {
  if (!String(migrationSource.options.database).endsWith('_test')) {
    throw new Error('E2E requires a disposable database ending in _test');
  }

  try {
    await migrationSource.initialize();
    await migrationSource.dropDatabase();
    const migrations = await migrationSource.runMigrations();
    expect(migrations.map(({ name }) => name)).toEqual([
      'CreateUsers1791142399315',
      'CreateTasks1791219749774',
    ]);
    expect(await migrationSource.runMigrations()).toEqual([]);
  } finally {
    if (migrationSource.isInitialized) await migrationSource.destroy();
  }
}

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  try {
    await app.init();
    return app;
  } catch (error) {
    await app.close();
    throw error;
  }
}
