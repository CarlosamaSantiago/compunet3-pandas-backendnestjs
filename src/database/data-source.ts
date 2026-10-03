import 'dotenv/config';

import { join } from 'node:path';
import { DataSource } from 'typeorm';

import configuration from '../config/configuration';
import { validateEnvironment } from '../config/env.validation';

validateEnvironment(process.env);

const database = configuration().database;

export default new DataSource({
  type: 'postgres',
  host: database.host,
  port: database.port,
  username: database.username,
  password: database.password,
  database: database.name,
  synchronize: false,
  migrationsRun: false,
  entities: [join(__dirname, '..', '**', '*.entity{.ts,.js}')],
  migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
});
