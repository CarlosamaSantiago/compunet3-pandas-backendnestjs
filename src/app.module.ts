import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import configuration from './config/configuration';
import { validateEnvironment } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnvironment,
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    UsersModule,
    TasksModule,
  ],
})
export class AppModule {}
/*
 * Trying to force a commit to see if the pipeline will run. This is a test commit and should be ignored. 
*/