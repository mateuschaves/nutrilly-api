import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;

  const mockUsersService = {
    getProfile: jest.fn(),
  };

  const mockReq = { user: { id: 'user-123' } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getProfile() should call usersService.getProfile with userId', async () => {
    const profile = { id: 'user-123', email: 'test@example.com', name: 'Test', created_at: new Date() };
    mockUsersService.getProfile.mockResolvedValue(profile);

    const result = await controller.getProfile(mockReq);

    expect(mockUsersService.getProfile).toHaveBeenCalledWith('user-123');
    expect(result).toEqual(profile);
  });
});
