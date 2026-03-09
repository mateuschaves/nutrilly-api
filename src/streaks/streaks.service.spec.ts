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
});
