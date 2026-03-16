import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    googleLogin: jest.fn(),
    appleLogin: jest.fn(),
  };

  const authResponse = { access_token: 'mock-token', user: { id: 'user-1', name: 'Test', email: 'test@example.com' } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('register() should call authService.register with dto', async () => {
    const dto = { email: 'test@example.com', password: 'password123', name: 'Test' };
    mockAuthService.register.mockResolvedValue(authResponse);

    const result = await controller.register(dto);

    expect(mockAuthService.register).toHaveBeenCalledWith(dto);
    expect(result).toEqual(authResponse);
  });

  it('login() should call authService.login with dto', async () => {
    const dto = { email: 'test@example.com', password: 'password123' };
    mockAuthService.login.mockResolvedValue(authResponse);

    const result = await controller.login(dto);

    expect(mockAuthService.login).toHaveBeenCalledWith(dto);
    expect(result).toEqual(authResponse);
  });

  it('googleLogin() should call authService.googleLogin with dto', async () => {
    const dto = { idToken: 'google-id-token' };
    mockAuthService.googleLogin.mockResolvedValue(authResponse);

    const result = await controller.googleLogin(dto as any);

    expect(mockAuthService.googleLogin).toHaveBeenCalledWith(dto);
    expect(result).toEqual(authResponse);
  });

  it('appleLogin() should call authService.appleLogin with dto', async () => {
    const dto = { identityToken: 'apple-identity-token' };
    mockAuthService.appleLogin.mockResolvedValue(authResponse);

    const result = await controller.appleLogin(dto as any);

    expect(mockAuthService.appleLogin).toHaveBeenCalledWith(dto);
    expect(result).toEqual(authResponse);
  });
});
