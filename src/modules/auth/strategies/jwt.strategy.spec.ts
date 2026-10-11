import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { UsersService } from '../../users/users.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const usersService = { findById: jest.fn() };
  let strategy: JwtStrategy;

  beforeEach(() => {
    jest.resetAllMocks();
    const config = {
      getOrThrow: jest.fn().mockReturnValue('test_secret_only'),
    };
    strategy = new JwtStrategy(
      config as unknown as ConfigService,
      usersService as unknown as UsersService,
    );
  });

  it('returns the user when the token version matches', async () => {
    const user = { id: 'u1', tokenVersion: 1, role: 'USER' };
    usersService.findById.mockResolvedValue(user);

    await expect(
      strategy.validate({ sub: 'u1', tokenVersion: 1 }),
    ).resolves.toBe(user);
  });

  it('rejects when the user does not exist', async () => {
    usersService.findById.mockResolvedValue(null);

    await expect(
      strategy.validate({ sub: 'u1', tokenVersion: 1 }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a revoked token (version mismatch)', async () => {
    usersService.findById.mockResolvedValue({ id: 'u1', tokenVersion: 2 });

    await expect(
      strategy.validate({ sub: 'u1', tokenVersion: 1 }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});