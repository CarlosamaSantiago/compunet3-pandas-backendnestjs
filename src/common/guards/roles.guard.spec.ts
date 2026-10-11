import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../enums/role.enum';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;
  let guard: RolesGuard;
  let requestUser: { id: string; role: Role } | undefined;

  const makeContext = (): ExecutionContext =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user: requestUser }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
    requestUser = undefined;
  });

  it('allows a route that does not declare required roles', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(makeContext())).toBe(true);
  });

  it('allows ADMIN to access an ADMIN route', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    requestUser = { id: 'user-id', role: Role.ADMIN };
    expect(guard.canActivate(makeContext())).toBe(true);
  });

  it('returns 403 when USER tries to access an ADMIN route', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    requestUser = { id: 'user-id', role: Role.USER };
    expect(() => guard.canActivate(makeContext())).toThrow(ForbiddenException);
  });

  it('uses the role on the current request user after a role change', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    requestUser = { id: 'user-id', role: Role.USER };
    expect(() => guard.canActivate(makeContext())).toThrow(ForbiddenException);

    // Auth's JWT strategy reloads the user for each request, so this is the new DB role.
    requestUser = { id: 'user-id', role: Role.ADMIN };
    expect(guard.canActivate(makeContext())).toBe(true);
  });

  it('returns 403 if no authenticated user is attached', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    expect(() => guard.canActivate(makeContext())).toThrow(ForbiddenException);
  });

  it('reads required roles from handler and controller metadata', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    requestUser = { id: 'user-id', role: Role.ADMIN };
    const context = makeContext();

    guard.canActivate(context);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  });
});