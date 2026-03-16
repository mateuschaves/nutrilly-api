import { Test, TestingModule } from '@nestjs/testing';
import { StreaksService } from './streaks.service';
import { PrismaService } from '../prisma/prisma.service';

describe('StreaksService', () => {
  let service: StreaksService;

  const mockPrisma = {
    streak: { findUnique: jest.fn(), update: jest.fn() },
    userGoal: { findUnique: jest.fn() },
    dailySummary: { findUnique: jest.fn() },
    user: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreaksService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<StreaksService>(StreaksService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should increment streak when 90% calorie goal is met', async () => {
    mockPrisma.userGoal.findUnique.mockResolvedValue({ calories_goal: 2000 });
    mockPrisma.dailySummary.findUnique.mockResolvedValue({ calories: 1900 }); // 95% of 2000
    mockPrisma.streak.findUnique.mockResolvedValue({ current_streak: 3, best_streak: 5 });
    mockPrisma.streak.update.mockResolvedValue({});

    await service.checkAndUpdateStreak('user-1');

    expect(mockPrisma.streak.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ current_streak: 4 }),
      }),
    );
  });

  it('should reset streak when calorie goal not met', async () => {
    mockPrisma.userGoal.findUnique.mockResolvedValue({ calories_goal: 2000 });
    mockPrisma.dailySummary.findUnique.mockResolvedValue({ calories: 1000 }); // only 50%
    mockPrisma.streak.findUnique.mockResolvedValue({ current_streak: 3, best_streak: 5 });
    mockPrisma.streak.update.mockResolvedValue({});

    await service.checkAndUpdateStreak('user-1');

    expect(mockPrisma.streak.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { current_streak: 0 },
      }),
    );
  });

  it('should update best_streak when current exceeds it', async () => {
    mockPrisma.userGoal.findUnique.mockResolvedValue({ calories_goal: 2000 });
    mockPrisma.dailySummary.findUnique.mockResolvedValue({ calories: 2000 });
    mockPrisma.streak.findUnique.mockResolvedValue({ current_streak: 5, best_streak: 5 });
    mockPrisma.streak.update.mockResolvedValue({});

    await service.checkAndUpdateStreak('user-1');

    expect(mockPrisma.streak.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ current_streak: 6, best_streak: 6 }),
      }),
    );
  });

  it('should skip check if no goals set', async () => {
    mockPrisma.userGoal.findUnique.mockResolvedValue(null);
    mockPrisma.dailySummary.findUnique.mockResolvedValue(null);
    mockPrisma.streak.findUnique.mockResolvedValue({ current_streak: 3, best_streak: 5 });

    await service.checkAndUpdateStreak('user-1');

    expect(mockPrisma.streak.update).not.toHaveBeenCalled();
  });

  it('getStreak() should return streak for the user', async () => {
    const streak = { id: 'streak-1', user_id: 'user-1', current_streak: 7, best_streak: 14 };
    mockPrisma.streak.findUnique.mockResolvedValue(streak);

    const result = await service.getStreak('user-1');

    expect(mockPrisma.streak.findUnique).toHaveBeenCalledWith({ where: { user_id: 'user-1' } });
    expect(result).toEqual(streak);
  });

  it('runDailyStreakCheck() should process all users in batches', async () => {
    // First batch: exactly 100 users (full batch → triggers next iteration)
    const fullBatch = Array.from({ length: 100 }, (_, i) => ({ id: `user-${i}` }));
    mockPrisma.user.findMany
      .mockResolvedValueOnce(fullBatch)
      .mockResolvedValueOnce([]);
    mockPrisma.userGoal.findUnique.mockResolvedValue(null);
    mockPrisma.dailySummary.findUnique.mockResolvedValue(null);
    mockPrisma.streak.findUnique.mockResolvedValue(null);

    await service.runDailyStreakCheck();

    expect(mockPrisma.user.findMany).toHaveBeenCalledTimes(2);
  });

  it('runDailyStreakCheck() should stop when batch is smaller than batch size', async () => {
    const smallBatch = Array.from({ length: 5 }, (_, i) => ({ id: `user-${i}` }));
    mockPrisma.user.findMany.mockResolvedValueOnce(smallBatch);
    mockPrisma.userGoal.findUnique.mockResolvedValue(null);
    mockPrisma.dailySummary.findUnique.mockResolvedValue(null);
    mockPrisma.streak.findUnique.mockResolvedValue(null);

    await service.runDailyStreakCheck();

    expect(mockPrisma.user.findMany).toHaveBeenCalledTimes(1);
  });
});
