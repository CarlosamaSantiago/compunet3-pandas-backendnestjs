import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'node:path';

import type { AppConfiguration } from '../config/configuration';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfiguration>) => {
        const database =
          configService.getOrThrow<AppConfiguration['database']>('database');

        return {
          type: 'postgres' as const,
          host: database.host,
          port: database.port,
          username: database.username,
          password: database.password,
          database: database.name,
          autoLoadEntities: true,
          synchronize: false,
          migrationsRun: true,
          migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
          retryAttempts: 5,
          retryDelay: 2_000,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
