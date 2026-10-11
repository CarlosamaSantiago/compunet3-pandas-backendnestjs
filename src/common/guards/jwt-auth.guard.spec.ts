import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() };
  const context = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
  } as unknown as ExecutionContext;
  let guard: JwtAuthGuard;

  beforeEach(() => {
    jest.restoreAllMocks();
    reflector.getAllAndOverride.mockReset();
    guard = new JwtAuthGuard(reflector as unknown as Reflector);
  });

  it('allows routes marked as @Public()', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('delegates to the passport guard on protected routes', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const parent = jest
      .spyOn(
        AuthGuard('jwt').prototype as { canActivate: () => boolean },
        'canActivate',
      )
      .mockReturnValue(true);

    expect(guard.canActivate(context)).toBe(true);
    expect(parent).toHaveBeenCalled();
  });
});