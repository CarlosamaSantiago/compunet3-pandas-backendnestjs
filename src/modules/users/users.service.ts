import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';

import { Role } from '../../common/enums/role.enum';
import { User } from './entities/user.entity';

export interface CreateUserInput {
  name: string;
  email: string;
  passwordHash: string;
  role?: Role;
}

export interface UpdateProfileInput {
  name?: string;
  email?: string;
}

export type PublicUser = Pick<
  User,
  'id' | 'name' | 'email' | 'role' | 'createdAt' | 'updatedAt'
>;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();
  }

  findById(id: string, includePasswordHash = false): Promise<User | null> {
    const query = this.userRepository
      .createQueryBuilder('user')
      .where('user.id = :id', { id });

    if (includePasswordHash) {
      query.addSelect('user.passwordHash');
    }

    return query.getOne();
  }

  create(input: CreateUserInput): Promise<User> {
    const user = this.userRepository.create({
      ...input,
      role: input.role ?? Role.USER,
    });

    return this.userRepository.save(user);
  }

  async incrementTokenVersion(userId: string): Promise<void> {
    await this.userRepository.increment({ id: userId }, 'tokenVersion', 1);
  }

  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return this.toPublicUser(user);
  }

  async updateProfile(
    userId: string,
    input: UpdateProfileInput,
  ): Promise<PublicUser> {
    try {
      const result = await this.userRepository.update(userId, input);
      if (!result.affected) {
        throw new NotFoundException('Usuario no encontrado');
      }
      return await this.getProfile(userId);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('El correo ya está registrado');
      }
      throw error;
    }
  }

  async listUsers(
    page: number,
    limit: number,
  ): Promise<{
    items: PublicUser[];
    total: number;
    page: number;
    limit: number;
  }> {
    const [users, total] = await this.userRepository.findAndCount({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: users.map((user) => this.toPublicUser(user)),
      total,
      page,
      limit,
    };
  }

  async updateRole(userId: string, role: Role): Promise<PublicUser> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1)', [731947212]);
      const repository = manager.getRepository(User);
      const user = await repository.findOne({
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new NotFoundException('Usuario no encontrado');
      }

      if (user.role === Role.ADMIN && role !== Role.ADMIN) {
        const adminCount = await repository.count({
          where: { role: Role.ADMIN },
        });
        if (adminCount <= 1) {
          throw new ConflictException(
            'No se puede quitar el rol al último ADMIN',
          );
        }
      }

      user.role = role;
      return this.toPublicUser(await repository.save(user));
    });
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string }).code === '23505'
    );
  }
}
