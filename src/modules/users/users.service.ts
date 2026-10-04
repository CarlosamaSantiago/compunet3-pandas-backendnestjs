import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Role } from '../../common/enums/role.enum';
import { User } from './entities/user.entity';

export interface CreateUserInput {
  name: string;
  email: string;
  passwordHash: string;
  role?: Role;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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
}