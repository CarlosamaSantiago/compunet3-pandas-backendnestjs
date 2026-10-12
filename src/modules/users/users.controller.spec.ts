import { BadRequestException } from '@nestjs/common';

import { Role } from '../../common/enums/role.enum';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

const userId = '11111111-1111-4111-8111-111111111111';
const otherUserId = '22222222-2222-4222-8222-222222222222';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: {
    getProfile: jest.Mock;
    updateProfile: jest.Mock;
    listUsers: jest.Mock;
    updateRole: jest.Mock;
  };
  const request = { user: { id: userId, role: Role.USER } } as never;

  beforeEach(() => {
    usersService = {
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
      listUsers: jest.fn(),
      updateRole: jest.fn(),
    };
    controller = new UsersController(usersService as unknown as UsersService);
  });

  it('gets the profile for the authenticated request user', async () => {
    const profile = { id: userId, name: 'Maria' };
    usersService.getProfile.mockResolvedValue(profile);

    await expect(controller.getMyProfile(request)).resolves.toBe(profile);
    expect(usersService.getProfile).toHaveBeenCalledWith(userId);
  });

  it('rejects an empty profile patch before calling the service', () => {
    expect(() => controller.updateMyProfile(request, {})).toThrow(
      BadRequestException,
    );
    expect(usersService.updateProfile).not.toHaveBeenCalled();
  });

  it('delegates a non-empty profile patch for the authenticated user', async () => {
    const updated = { id: userId, name: 'Maria Perez' };
    const patch = { name: 'Maria Perez' };
    usersService.updateProfile.mockResolvedValue(updated);

    await expect(controller.updateMyProfile(request, patch)).resolves.toBe(
      updated,
    );
    expect(usersService.updateProfile).toHaveBeenCalledWith(userId, patch);
  });

  it('uses default pagination and forwards provided page and limit', async () => {
    await controller.listUsers({});
    await controller.listUsers({ page: 2, limit: 25 });

    expect(usersService.listUsers).toHaveBeenNthCalledWith(1, 1, 10);
    expect(usersService.listUsers).toHaveBeenNthCalledWith(2, 2, 25);
  });

  it('delegates role changes with the validated target ID and role', async () => {
    const result = { id: otherUserId, role: Role.ADMIN };
    usersService.updateRole.mockResolvedValue(result);

    await expect(
      controller.updateUserRole(otherUserId, { role: Role.ADMIN }),
    ).resolves.toBe(result);
    expect(usersService.updateRole).toHaveBeenCalledWith(
      otherUserId,
      Role.ADMIN,
    );
  });
});