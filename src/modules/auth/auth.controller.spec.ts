import { User } from '../users/entities/user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  const authService = {
    register: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
  };
  let controller: AuthController;

  beforeEach(() => {
    jest.resetAllMocks();
    controller = new AuthController(authService as unknown as AuthService);
  });

  it('delegates register to the service', async () => {
    const dto = { name: 'Ana', email: 'ana@correo.com', password: '12345678' };
    authService.register.mockResolvedValue({ id: 'u1' });

    await expect(controller.register(dto)).resolves.toEqual({ id: 'u1' });
    expect(authService.register).toHaveBeenCalledWith(dto);
  });

  it('delegates login to the service', async () => {
    const dto = { email: 'ana@correo.com', password: '12345678' };
    authService.login.mockResolvedValue({ accessToken: 't' });

    await expect(controller.login(dto)).resolves.toEqual({ accessToken: 't' });
    expect(authService.login).toHaveBeenCalledWith(dto);
  });

  it('logs out the authenticated user', async () => {
    authService.logout.mockResolvedValue(undefined);

    await controller.logout({ id: 'u1' } as User);
    expect(authService.logout).toHaveBeenCalledWith('u1');
  });
});