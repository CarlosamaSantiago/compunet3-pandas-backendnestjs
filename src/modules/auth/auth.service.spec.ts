import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { QueryFailedError } from 'typeorm';

import { Role } from '../../common/enums/role.enum';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const usersService = {
    create: jest.fn(),
    findByEmail: jest.fn(),
    incrementTokenVersion: jest.fn(),
  };
  const jwtService = { signAsync: jest.fn(), decode: jest.fn() };
  let service: AuthService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new AuthService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
    );
  });

  describe('register', () => {
    it('hashes the password, never sends a role and hides sensitive fields', async () => {
      usersService.create.mockImplementation((input: object) =>
        Promise.resolve({
          id: 'u1',
          ...input,
          role: Role.USER,
          tokenVersion: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );

      const result = await service.register({
        name: 'Ana',
        email: 'ana@correo.com',
        password: '12345678',
      });

      const [input] = usersService.create.mock.calls[0] as [
        { passwordHash: string; role?: Role },
      ];
      expect(input.role).toBeUndefined();
      expect(input.passwordHash).not.toBe('12345678');
      expect(await bcrypt.compare('12345678', input.passwordHash)).toBe(true);
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('tokenVersion');
      expect(result.role).toBe(Role.USER);
    });

    it('throws ConflictException on duplicate email', async () => {
      const driverError = Object.assign(new Error('dup'), { code: '23505' });
      usersService.create.mockRejectedValue(
        new QueryFailedError('INSERT', [], driverError),
      );

      await expect(
        service.register({
          name: 'Ana',
          email: 'a@a.com',
          password: '12345678',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rethrows unexpected errors', async () => {
      usersService.create.mockRejectedValue(new Error('boom'));

      await expect(
        service.register({
          name: 'Ana',
          email: 'a@a.com',
          password: '12345678',
        }),
      ).rejects.toThrow('boom');
    });
  });

  describe('login', () => {
    it('returns a bearer token for valid credentials', async () => {
      const passwordHash = await bcrypt.hash('12345678', 4);
      usersService.findByEmail.mockResolvedValue({
        id: 'u1',
        tokenVersion: 2,
        passwordHash,
      });
      jwtService.signAsync.mockResolvedValue('signed.jwt');
      jwtService.decode.mockReturnValue({ iat: 1000, exp: 4600 });

      const result = await service.login({
        email: 'ana@correo.com',
        password: '12345678',
      });

      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: 'u1',
        tokenVersion: 2,
      });
      expect(result).toEqual({
        accessToken: 'signed.jwt',
        tokenType: 'Bearer',
        expiresIn: 3600,
      });
    });

    it('rejects an unknown email', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'x@x.com', password: '12345678' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('rejects a wrong password', async () => {
      const passwordHash = await bcrypt.hash('12345678', 4);
      usersService.findByEmail.mockResolvedValue({ id: 'u1', passwordHash });

      await expect(
        service.login({ email: 'ana@correo.com', password: 'incorrecta' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('increments the token version', async () => {
      await service.logout('u1');
      expect(usersService.incrementTokenVersion).toHaveBeenCalledWith('u1');
    });
  });
});
