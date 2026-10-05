import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../users/entities/user.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task } from './entities/task.entity';
import { TaskPriority } from './enums/task-priority.enum';
import { TaskStatus } from './enums/task-status.enum';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export type TaskWithOwner = Omit<Task, 'user'> & {
  user: Pick<User, 'id' | 'name' | 'email'>;
};

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
  ) {}

  create(userId: string, dto: CreateTaskDto): Promise<Task> {
    const task = this.taskRepository.create({
      title: dto.title,
      description: dto.description ?? null,
      status: dto.status ?? TaskStatus.PENDING,
      priority: dto.priority ?? TaskPriority.MEDIUM,
      dueDate: this.toDate(dto.dueDate),
      userId,
    });

    return this.taskRepository.save(task);
  }

  async findMine(
    userId: string,
    query: ListTasksQueryDto,
  ): Promise<PaginatedResult<Task>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const [items, total] = await this.taskRepository.findAndCount({
      where: {
        userId,
        ...(query.status === undefined ? {} : { status: query.status }),
        ...(query.priority === undefined ? {} : { priority: query.priority }),
      },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total, page, limit };
  }

  async findMineById(userId: string, taskId: string): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId, userId },
    });

    if (!task) {
      throw new NotFoundException('Tarea no encontrada');
    }

    return task;
  }

  async updateMine(
    userId: string,
    taskId: string,
    dto: UpdateTaskDto,
  ): Promise<Task> {
    const task = await this.findMineById(userId, taskId);

    if (dto.title !== undefined) task.title = dto.title;
    if (dto.description !== undefined) task.description = dto.description;
    if (dto.status !== undefined) task.status = dto.status;
    if (dto.priority !== undefined) task.priority = dto.priority;
    if (dto.dueDate !== undefined) task.dueDate = this.toDate(dto.dueDate);

    return this.taskRepository.save(task);
  }

  async removeMine(userId: string, taskId: string): Promise<void> {
    const result = await this.taskRepository.delete({ id: taskId, userId });
    if (!result.affected) {
      throw new NotFoundException('Tarea no encontrada');
    }
  }

  async findAllForAdmin(
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<TaskWithOwner>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const [tasks, total] = await this.taskRepository.findAndCount({
      relations: { user: true },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
        user: { id: true, name: true, email: true },
      },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const items = tasks.map(({ user, ...task }) => ({
      ...task,
      user: { id: user.id, name: user.name, email: user.email },
    }));

    return { items, total, page, limit };
  }

  private toDate(value: string | null | undefined): Date | null {
    return value ? new Date(value) : null;
  }
}
