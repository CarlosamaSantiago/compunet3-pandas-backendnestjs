import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  QueryFailedError,
  Repository,
} from 'typeorm';

import { Role } from '../../common/enums/role.enum';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

const userId = '11111111-1111-4111-8111-111111111111';

const makeUser = (overrides: Partial<User> = {}): User =>
  Object.assign(new User(), {
    id: userId,
    name: 'Maria',
    email: 'maria@example.com',
    passwordHash: 'private-hash',
    role: Role.USER,
    tokenVersion: 0,
    createdAt: new Date('2026-10-01T10:00:00.000Z'),
    updatedAt: new Date('2026-10-01T10:00:00.000Z'),
    ...overrides,
  });

describe('UsersService', () => {
  let service: UsersService;
  let repository: Record<string, jest.Mock>;
  let transactionRepository: Record<string, jest.Mock>;
  let dataSource: { transaction: jest.Mock };
  let manager: Record<string, jest.Mock>;

  beforeEach(() => {
    repository = {
      createQueryBuilder: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      increment: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      findAndCount: jest.fn(),
    };
    transactionRepository = {
      findOne: jest.fn(),
      count: jest.fn(),
      save: jest.fn(),
    };
    manager = {
      query: jest.fn(),
      getRepository: jest.fn().mockReturnValue(transactionRepository),
    };
    dataSource = {
      transaction: jest.fn(
        (callback: (manager: EntityManager) => Promise<unknown>) =>
          callback(manager as unknown as EntityManager),
      ),
    };
    service = new UsersService(
      repository as unknown as Repository<User>,
      dataSource as unknown as DataSource,
    );
  });

  it('finds a user by email and explicitly selects the password hash', async () => {
    const found = makeUser();
    const query = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(found),
    };
    repository.createQueryBuilder.mockReturnValue(query);

    await expect(service.findByEmail(found.email)).resolves.toBe(found);
    expect(query.addSelect).toHaveBeenCalledWith('user.passwordHash');
    expect(query.where).toHaveBeenCalledWith('user.email = :email', {
      email: found.email,
    });
  });

  it('finds a user by ID without the hash unless explicitly requested', async () => {
    const found = makeUser();
    const query = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(found),
    };
    repository.createQueryBuilder.mockReturnValue(query);

    await service.findById(userId);
    expect(query.addSelect).not.toHaveBeenCalled();

    await service.findById(userId, true);
    expect(query.addSelect).toHaveBeenCalledWith('user.passwordHash');
  });

  it('creates USER by default and permits a server-supplied role', async () => {
    const saved = makeUser();
    repository.create.mockReturnValue(saved);
    repository.save.mockResolvedValue(saved);

    await expect(
      service.create({
        name: saved.name,
        email: saved.email,
        passwordHash: saved.passwordHash,
      }),
    ).resolves.toBe(saved);
    expect(repository.create).toHaveBeenCalledWith({
      name: saved.name,
      email: saved.email,
      passwordHash: saved.passwordHash,
      role: Role.USER,
    });

    await service.create({
      name: 'Admin',
      email: 'admin@example.com',
      passwordHash: 'hash',
      role: Role.ADMIN,
    });
    expect(repository.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ role: Role.ADMIN }),
    );
  });

  it('increments tokenVersion in the repository', async () => {
    await service.incrementTokenVersion(userId);
    expect(repository.increment).toHaveBeenCalledWith(
      { id: userId },
      'tokenVersion',
      1,
    );
  });

  it('returns only public fields for a profile', async () => {
    repository.findOne.mockResolvedValue(makeUser());

    const profile = await service.getProfile(userId);
    expect(profile).toMatchObject({
      id: userId,
      name: 'Maria',
      email: 'maria@example.com',
      role: Role.USER,
    });
    expect(profile).not.toHaveProperty('passwordHash');
    expect(profile).not.toHaveProperty('tokenVersion');
  });

  it('returns 404 when the profile user does not exist', async () => {
    repository.findOne.mockResolvedValue(null);
    await expect(service.getProfile(userId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates supplied profile fields and returns the public profile', async () => {
    repository.update.mockResolvedValue({ affected: 1 });
    repository.findOne.mockResolvedValue(
      makeUser({ name: 'Maria Perez', email: 'maria.perez@example.com' }),
    );

    await expect(
      service.updateProfile(userId, {
        name: 'Maria Perez',
        email: 'maria.perez@example.com',
      }),
    ).resolves.toMatchObject({
      name: 'Maria Perez',
      email: 'maria.perez@example.com',
    });
    expect(repository.update).toHaveBeenCalledWith(userId, {
      name: 'Maria Perez',
      email: 'maria.perez@example.com',
    });
  });

  it('maps duplicate email updates to 409 Conflict', async () => {
    const duplicateKeyError = Object.assign(new Error('duplicate key'), {
      code: '23505',
    });
    repository.update.mockRejectedValue(
      new QueryFailedError('UPDATE users', [], duplicateKeyError),
    );

    await expect(
      service.updateProfile(userId, { email: 'taken@example.com' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns 404 when a profile update affects no user', async () => {
    repository.update.mockResolvedValue({ affected: 0 });
    await expect(
      service.updateProfile(userId, { name: 'New name' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists public users using the requested pagination', async () => {
    repository.findAndCount.mockResolvedValue([[makeUser()], 21]);

    await expect(service.listUsers(3, 10)).resolves.toMatchObject({
      items: [{ id: userId, role: Role.USER }],
      total: 21,
      page: 3,
      limit: 10,
    });
    expect(repository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
  });

  it('changes USER to ADMIN and ADMIN to USER while another ADMIN remains', async () => {
    const regularUser = makeUser();
    transactionRepository.findOne.mockResolvedValueOnce(regularUser);
    transactionRepository.save.mockImplementation((saved) =>
      Promise.resolve(saved),
    );

    await expect(service.updateRole(userId, Role.ADMIN)).resolves.toMatchObject({
      role: Role.ADMIN,
    });

    const admin = makeUser({ role: Role.ADMIN });
    transactionRepository.findOne.mockResolvedValueOnce(admin);
    transactionRepository.count.mockResolvedValue(2);

    await expect(service.updateRole(userId, Role.USER)).resolves.toMatchObject({
      role: Role.USER,
    });
    expect(manager.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock($1)',
      [731947212],
    );
  });

  it('rejects removal of the last ADMIN and does not save the change', async () => {
    transactionRepository.findOne.mockResolvedValue(
      makeUser({ role: Role.ADMIN }),
    );
    transactionRepository.count.mockResolvedValue(1);

    await expect(
      service.updateRole(userId, Role.USER),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transactionRepository.save).not.toHaveBeenCalled();
  });

  it('returns 404 when changing a role for a missing user', async () => {
    transactionRepository.findOne.mockResolvedValue(null);

    await expect(
      service.updateRole(userId, Role.ADMIN),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not count admins when the role is not being removed', async () => {
    transactionRepository.findOne.mockResolvedValue(
      makeUser({ role: Role.ADMIN }),
    );
    transactionRepository.save.mockImplementation((saved) =>
      Promise.resolve(saved),
    );

    await service.updateRole(userId, Role.ADMIN);
    expect(transactionRepository.count).not.toHaveBeenCalled();
  });
});