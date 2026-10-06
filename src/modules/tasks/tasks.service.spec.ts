import { NotFoundException } from '@nestjs/common';
import { type Repository } from 'typeorm';

import { Role } from '../../common/enums/role.enum';
import { User } from '../users/entities/user.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { Task } from './entities/task.entity';
import { TaskPriority } from './enums/task-priority.enum';
import { TaskStatus } from './enums/task-status.enum';
import { TasksService } from './tasks.service';

type MockTaskRepository = jest.Mocked<
  Pick<
    Repository<Task>,
    'create' | 'save' | 'findAndCount' | 'findOne' | 'delete'
  >
>;

const userId = '11111111-1111-4111-8111-111111111111';
const otherUserId = '22222222-2222-4222-8222-222222222222';
const taskId = '33333333-3333-4333-8333-333333333333';

const makeTask = (overrides: Partial<Task> = {}): Task =>
  Object.assign(new Task(), {
    id: taskId,
    title: 'Preparar entrega',
    description: null,
    status: TaskStatus.PENDING,
    priority: TaskPriority.MEDIUM,
    dueDate: null,
    userId,
    createdAt: new Date('2026-10-05T10:00:00.000Z'),
    updatedAt: new Date('2026-10-05T10:00:00.000Z'),
    ...overrides,
  });

const makeUser = (overrides: Partial<User> = {}): User =>
  Object.assign(new User(), {
    id: userId,
    name: 'Task Owner',
    email: 'owner@example.com',
    passwordHash: 'hidden-hash',
    role: Role.USER,
    tokenVersion: 4,
    createdAt: new Date('2026-10-01T10:00:00.000Z'),
    updatedAt: new Date('2026-10-01T10:00:00.000Z'),
    tasks: [],
    ...overrides,
  });

describe('TasksService', () => {
  let repository: MockTaskRepository;
  let service: TasksService;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      save: jest.fn(),
      findAndCount: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
    };
    service = new TasksService(repository as unknown as Repository<Task>);
  });

  describe('create', () => {
    it('creates a task for the authenticated user with defaults', async () => {
      const task = makeTask();
      repository.create.mockReturnValue(task);
      repository.save.mockResolvedValue(task);

      await expect(
        service.create(userId, { title: 'Preparar entrega' }),
      ).resolves.toBe(task);
      expect(repository.create).toHaveBeenCalledWith({
        title: 'Preparar entrega',
        description: null,
        status: TaskStatus.PENDING,
        priority: TaskPriority.MEDIUM,
        dueDate: null,
        userId,
      });
      expect(repository.save).toHaveBeenCalledWith(task);
    });

    it('always takes ownership from the authenticated user', async () => {
      const task = makeTask();
      repository.create.mockReturnValue(task);
      repository.save.mockResolvedValue(task);
      const maliciousDto = {
        title: 'Intento de reasignación',
        userId: otherUserId,
      } as unknown as CreateTaskDto;

      await service.create(userId, maliciousDto);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId }),
      );
      expect(repository.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ userId: otherUserId }),
      );
    });
  });

  describe('findMine', () => {
    it('always restricts the list to the authenticated user', async () => {
      const task = makeTask();
      repository.findAndCount.mockResolvedValue([[task], 1]);

      await expect(service.findMine(userId, {})).resolves.toEqual({
        items: [task],
        total: 1,
        page: 1,
        limit: 10,
      });
      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId } }),
      );
    });

    it('filters the owned list by status', async () => {
      repository.findAndCount.mockResolvedValue([[], 0]);

      await service.findMine(userId, { status: TaskStatus.COMPLETED });

      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId, status: TaskStatus.COMPLETED },
        }),
      );
    });

    it('filters the owned list by priority', async () => {
      repository.findAndCount.mockResolvedValue([[], 0]);

      await service.findMine(userId, { priority: TaskPriority.HIGH });

      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId, priority: TaskPriority.HIGH },
        }),
      );
    });

    it('applies page and limit as skip and take', async () => {
      repository.findAndCount.mockResolvedValue([[], 45]);

      await expect(
        service.findMine(userId, { page: 3, limit: 20 }),
      ).resolves.toEqual({ items: [], total: 45, page: 3, limit: 20 });
      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 40, take: 20 }),
      );
    });
  });

  describe('findMineById', () => {
    it('finds a task using both task id and owner id', async () => {
      const task = makeTask();
      repository.findOne.mockResolvedValue(task);

      await expect(service.findMineById(userId, taskId)).resolves.toBe(task);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: taskId, userId },
      });
    });

    it('returns the same 404 for a missing or foreign task', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findMineById(userId, taskId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateMine', () => {
    it('updates an owned task without changing ownership', async () => {
      const task = makeTask();
      repository.findOne.mockResolvedValue(task);
      repository.save.mockResolvedValue(task);

      const result = await service.updateMine(userId, taskId, {
        title: 'Entrega terminada',
        status: TaskStatus.COMPLETED,
        priority: TaskPriority.HIGH,
        dueDate: '2026-10-13T23:59:00.000Z',
      });

      expect(result).toMatchObject({
        title: 'Entrega terminada',
        status: TaskStatus.COMPLETED,
        priority: TaskPriority.HIGH,
        userId,
      });
      expect(result.dueDate).toEqual(new Date('2026-10-13T23:59:00.000Z'));
      expect(repository.save).toHaveBeenCalledWith(task);
    });

    it('does not update a missing or foreign task', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.updateMine(userId, taskId, { title: 'No permitido' }),
      ).rejects.toThrow(NotFoundException);
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('removeMine', () => {
    it('deletes using both task id and owner id', async () => {
      repository.delete.mockResolvedValue({ raw: [], affected: 1 });

      await expect(service.removeMine(userId, taskId)).resolves.toBeUndefined();
      expect(repository.delete).toHaveBeenCalledWith({ id: taskId, userId });
    });

    it('returns 404 when a missing or foreign task cannot be deleted', async () => {
      repository.delete.mockResolvedValue({ raw: [], affected: 0 });

      await expect(service.removeMine(userId, taskId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAllForAdmin', () => {
    it('returns every task with only safe owner fields', async () => {
      const user = makeUser();
      const task = makeTask({ user });
      repository.findAndCount.mockResolvedValue([[task], 1]);

      const result = await service.findAllForAdmin({});

      expect(result).toMatchObject({ total: 1, page: 1, limit: 10 });
      expect(result.items[0].user).toEqual({
        id: user.id,
        name: user.name,
        email: user.email,
      });
      expect(result.items[0].user).not.toHaveProperty('passwordHash');
      expect(result.items[0].user).not.toHaveProperty('tokenVersion');
    });

    it('applies pagination to the admin listing', async () => {
      repository.findAndCount.mockResolvedValue([[], 25]);

      await expect(
        service.findAllForAdmin({ page: 2, limit: 5 }),
      ).resolves.toEqual({ items: [], total: 25, page: 2, limit: 5 });
      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 5 }),
      );
    });
  });
});
