import * as bcrypt from 'bcrypt';

import { Role } from '../../common/enums/role.enum';
import { Task } from '../../modules/tasks/entities/task.entity';
import { TaskPriority } from '../../modules/tasks/enums/task-priority.enum';
import { TaskStatus } from '../../modules/tasks/enums/task-status.enum';
import { User } from '../../modules/users/entities/user.entity';
import dataSource from '../data-source';

const SALT_ROUNDS = 10;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.length < 8) {
    throw new Error(`${name} es obligatoria (mínimo 8 caracteres)`);
  }
  return value;
}

interface SeedTask {
  owner: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: Date;
}

const SEED_TASKS: SeedTask[] = [
  {
    owner: 'user1@taskflow.com',
    title: 'Preparar informe del taller',
    description: 'Endpoints, decisiones técnicas y resultados de pruebas.',
    status: TaskStatus.IN_PROGRESS,
    priority: TaskPriority.HIGH,
    dueDate: new Date('2026-10-13T12:00:00Z'),
  },
  {
    owner: 'user1@taskflow.com',
    title: 'Configurar CI en GitHub Actions',
    status: TaskStatus.PENDING,
    priority: TaskPriority.MEDIUM,
  },
  {
    owner: 'user1@taskflow.com',
    title: 'Revisar colección de Postman',
    status: TaskStatus.COMPLETED,
    priority: TaskPriority.LOW,
  },
  {
    owner: 'user2@taskflow.com',
    title: 'Desplegar la API en la nube',
    description: 'Con PostgreSQL persistente y migrations.',
    status: TaskStatus.PENDING,
    priority: TaskPriority.HIGH,
    dueDate: new Date('2026-10-12T12:00:00Z'),
  },
  {
    owner: 'user2@taskflow.com',
    title: 'Escribir pruebas de tareas',
    status: TaskStatus.IN_PROGRESS,
    priority: TaskPriority.MEDIUM,
  },
  {
    owner: 'admin@taskflow.com',
    title: 'Revisar roles de usuarios',
    status: TaskStatus.PENDING,
    priority: TaskPriority.LOW,
  },
];

async function seed(): Promise<void> {
  const adminPassword = requireEnv('SEED_ADMIN_PASSWORD');
  const userPassword = requireEnv('SEED_USER_PASSWORD');

  const seedUsers = [
    {
      name: 'Admin',
      email: 'admin@taskflow.com',
      role: Role.ADMIN,
      password: adminPassword,
    },
    {
      name: 'Usuario Uno',
      email: 'user1@taskflow.com',
      role: Role.USER,
      password: userPassword,
    },
    {
      name: 'Usuario Dos',
      email: 'user2@taskflow.com',
      role: Role.USER,
      password: userPassword,
    },
  ];

  await dataSource.initialize();
  await dataSource.transaction(async (manager) => {
    const users = manager.getRepository(User);
    const tasks = manager.getRepository(Task);
    const byEmail = new Map<string, User>();
    let createdUsers = 0;
    let createdTasks = 0;

    for (const seedUser of seedUsers) {
      let user = await users.findOne({ where: { email: seedUser.email } });
      if (!user) {
        user = await users.save(
          users.create({
            name: seedUser.name,
            email: seedUser.email,
            role: seedUser.role,
            passwordHash: await bcrypt.hash(seedUser.password, SALT_ROUNDS),
          }),
        );
        createdUsers += 1;
      }
      byEmail.set(seedUser.email, user);
    }

    for (const seedTask of SEED_TASKS) {
      const owner = byEmail.get(seedTask.owner);
      if (!owner) continue;
      const exists = await tasks.existsBy({
        userId: owner.id,
        title: seedTask.title,
      });
      if (exists) continue;
      await tasks.save(
        tasks.create({
          userId: owner.id,
          title: seedTask.title,
          description: seedTask.description ?? null,
          status: seedTask.status,
          priority: seedTask.priority,
          dueDate: seedTask.dueDate ?? null,
        }),
      );
      createdTasks += 1;
    }

    process.stdout.write(
      `Seed completado: ${createdUsers} usuarios y ${createdTasks} tareas nuevas.\n`,
    );
  });
}

async function main(): Promise<void> {
  try {
    await seed();
  } catch (error) {
    process.stderr.write(
      `Seed falló: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

void main();