import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DashboardService', () => {
  let service: DashboardService;

  const mockPrisma = {
    userGoal: { findUnique: jest.fn() },
    dailySummary: { findUnique: jest.fn() },
    waterLog: { aggregate: jest.fn() },
    meal: { findFirst: jest.fn() },
    streak: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return dashboard with zeroed values when no data exists', async () => {
    mockPrisma.userGoal.findUnique.mockResolvedValue(null);
    mockPrisma.dailySummary.findUnique.mockResolvedValue(null);
    mockPrisma.waterLog.aggregate.mockResolvedValue({ _sum: { amount_ml: null } });
    mockPrisma.meal.findFirst.mockResolvedValue(null);
    mockPrisma.streak.findUnique.mockResolvedValue(null);

    const result = await service.getTodayDashboard('user-123');

    expect(result.calories.consumed).toBe(0);
    expect(result.calories.goal).toBe(0);
    expect(result.hydration.consumed_ml).toBe(0);
    expect(result.last_meal).toBeNull();
    expect(result.streak.current_streak).toBe(0);
  });

  it('should calculate calories progress correctly', async () => {
    mockPrisma.userGoal.findUnique.mockResolvedValue({
      calories_goal: 2000,
      protein_goal: 150,
      carbs_goal: 250,
      fat_goal: 65,
      water_goal_ml: 2000,
    });
    mockPrisma.dailySummary.findUnique.mockResolvedValue({
      calories: 1500,
      protein: 100,
      carbs: 200,
      fat: 50,
    });
    mockPrisma.waterLog.aggregate.mockResolvedValue({ _sum: { amount_ml: 1000 } });
    mockPrisma.meal.findFirst.mockResolvedValue(null);
    mockPrisma.streak.findUnique.mockResolvedValue({ current_streak: 5, best_streak: 10 });

    const result = await service.getTodayDashboard('user-123');

    expect(result.calories.consumed).toBe(1500);
    expect(result.calories.goal).toBe(2000);
    expect(result.calories.remaining).toBe(500);
    expect(result.calories.progress_percent).toBe(75);
    expect(result.hydration.consumed_ml).toBe(1000);
    expect(result.hydration.progress_percent).toBe(50);
    expect(result.streak.current_streak).toBe(5);
    expect(result.streak.best_streak).toBe(10);
    expect(result.streak.days_to_record).toBe(5);
  });

  it('should return last meal data when available', async () => {
    mockPrisma.userGoal.findUnique.mockResolvedValue(null);
    mockPrisma.dailySummary.findUnique.mockResolvedValue(null);
    mockPrisma.waterLog.aggregate.mockResolvedValue({ _sum: { amount_ml: null } });
    mockPrisma.meal.findFirst.mockResolvedValue({
      name: 'lunch',
      eaten_at: new Date('2026-03-09T12:00:00Z'),
      items: [{ calories: 300 }, { calories: 200 }],
    });
    mockPrisma.streak.findUnique.mockResolvedValue(null);

    const result = await service.getTodayDashboard('user-123');

    expect(result.last_meal).not.toBeNull();
    expect(result.last_meal.name).toBe('lunch');
    expect(result.last_meal.calories).toBe(500);
  });

  it('should cap progress at 100%', async () => {
    mockPrisma.userGoal.findUnique.mockResolvedValue({
      calories_goal: 1000,
      protein_goal: 100,
      carbs_goal: 100,
      fat_goal: 50,
      water_goal_ml: 1000,
    });
    mockPrisma.dailySummary.findUnique.mockResolvedValue({ calories: 1500, protein: 0, carbs: 0, fat: 0 });
    mockPrisma.waterLog.aggregate.mockResolvedValue({ _sum: { amount_ml: 2000 } });
    mockPrisma.meal.findFirst.mockResolvedValue(null);
    mockPrisma.streak.findUnique.mockResolvedValue(null);

    const result = await service.getTodayDashboard('user-123');

    expect(result.calories.progress_percent).toBe(100);
    expect(result.hydration.progress_percent).toBe(100);
    expect(result.calories.remaining).toBe(0);
  });
});
