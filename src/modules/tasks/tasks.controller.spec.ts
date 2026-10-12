import { BadRequestException } from '@nestjs/common';

import { AdminTasksController } from './admin-tasks.controller';
import { TaskPriority } from './enums/task-priority.enum';
import { TaskStatus } from './enums/task-status.enum';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

const userId = '11111111-1111-4111-8111-111111111111';
const taskId = '33333333-3333-4333-8333-333333333333';

describe('TasksController', () => {
  const request = { user: { id: userId } } as never;

  it('creates a task for the request user', async () => {
    const result = { id: taskId };
    const create = jest.fn().mockResolvedValue(result);
    const controller = new TasksController({
      create,
    } as unknown as TasksService);
    const dto = { title: 'Preparar entrega' };

    await expect(controller.create(request, dto)).resolves.toBe(result);
    expect(create).toHaveBeenCalledWith(userId, dto);
  });

  it('lists tasks for the request user', async () => {
    const result = { items: [], total: 0, page: 2, limit: 5 };
    const findMine = jest.fn().mockResolvedValue(result);
    const controller = new TasksController({
      findMine,
    } as unknown as TasksService);
    const query = { page: 2, limit: 5, status: TaskStatus.PENDING };

    await expect(controller.findMine(request, query)).resolves.toBe(result);
    expect(findMine).toHaveBeenCalledWith(userId, query);
  });

  it('gets one task for the request user', async () => {
    const result = { id: taskId };
    const findMineById = jest.fn().mockResolvedValue(result);
    const controller = new TasksController({
      findMineById,
    } as unknown as TasksService);

    await expect(controller.findMineById(request, taskId)).resolves.toBe(
      result,
    );
    expect(findMineById).toHaveBeenCalledWith(userId, taskId);
  });

  it('updates one task for the request user', async () => {
    const result = { id: taskId, priority: TaskPriority.HIGH };
    const updateMine = jest.fn().mockResolvedValue(result);
    const controller = new TasksController({
      updateMine,
    } as unknown as TasksService);
    const dto = { priority: TaskPriority.HIGH };

    await expect(controller.updateMine(request, taskId, dto)).resolves.toBe(
      result,
    );
    expect(updateMine).toHaveBeenCalledWith(userId, taskId, dto);
  });

  it('rejects an empty update before calling the service', () => {
    const updateMine = jest.fn();
    const tasksService = {
      updateMine,
    } as unknown as TasksService;
    const controller = new TasksController(tasksService);

    expect(() => controller.updateMine(request, taskId, {})).toThrow(
      BadRequestException,
    );
    expect(updateMine).not.toHaveBeenCalled();
  });

  it('deletes one task for the request user', async () => {
    const removeMine = jest.fn().mockResolvedValue(undefined);
    const controller = new TasksController({
      removeMine,
    } as unknown as TasksService);

    await expect(
      controller.removeMine(request, taskId),
    ).resolves.toBeUndefined();
    expect(removeMine).toHaveBeenCalledWith(userId, taskId);
  });
});

describe('AdminTasksController', () => {
  it('delegates the paginated global listing to the service', async () => {
    const result = { items: [], total: 0, page: 1, limit: 10 };
    const findAllForAdmin = jest.fn().mockResolvedValue(result);
    const controller = new AdminTasksController({
      findAllForAdmin,
    } as unknown as TasksService);

    await expect(controller.findAll({ page: 1, limit: 10 })).resolves.toBe(
      result,
    );
    expect(findAllForAdmin).toHaveBeenCalledWith({ page: 1, limit: 10 });
  });
});
