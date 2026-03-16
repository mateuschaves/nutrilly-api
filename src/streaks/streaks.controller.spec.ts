import { Test, TestingModule } from '@nestjs/testing';
import { StreaksController } from './streaks.controller';
import { StreaksService } from './streaks.service';

describe('StreaksController', () => {
  let controller: StreaksController;

  const mockStreaksService = {
    getStreak: jest.fn(),
  };

  const mockReq = { user: { id: 'user-123' } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StreaksController],
      providers: [{ provide: StreaksService, useValue: mockStreaksService }],
    }).compile();

    controller = module.get<StreaksController>(StreaksController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getStreak() should call streaksService.getStreak with userId', async () => {
    const streak = { id: 'streak-1', user_id: 'user-123', current_streak: 7, best_streak: 14 };
    mockStreaksService.getStreak.mockResolvedValue(streak);

    const result = await controller.getStreak(mockReq);

    expect(mockStreaksService.getStreak).toHaveBeenCalledWith('user-123');
    expect(result).toEqual(streak);
  });
});
