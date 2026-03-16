import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DashboardService', () => {
  let service: DashboardService;

  const mockPrisma = {
    userGoal: { findUnique: jest.fn() },
    userPreferences: { findUnique: jest.fn() },
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

  // ─── getTodayDashboard ────────────────────────────────────────────────────

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

  // ─── getDailySummary ──────────────────────────────────────────────────────

  describe('getDailySummary', () => {
    const date = '2025-03-15';

    const baseGoals = {
      calories_goal: 2200,
      protein_goal: 150,
      carbs_goal: 250,
      fat_goal: 70,
      water_goal_ml: 2500,
    };

    const baseSummary = {
      calories: 1840,
      protein: 87,
      carbs: 210,
      fat: 54,
    };

    it('should return zeroed values when no data exists', async () => {
      mockPrisma.userGoal.findUnique.mockResolvedValue(null);
      mockPrisma.userPreferences.findUnique.mockResolvedValue(null);
      mockPrisma.dailySummary.findUnique.mockResolvedValue(null);
      mockPrisma.waterLog.aggregate.mockResolvedValue({ _sum: { amount_ml: null } });
      mockPrisma.meal.findFirst.mockResolvedValue(null);
      mockPrisma.streak.findUnique.mockResolvedValue(null);

      const result = await service.getDailySummary('user-123', date);

      expect(result.calories.consumed).toBe(0);
      expect(result.calories.goal).toBe(0);
      expect(result.calories.unit).toBe('kcal');
      expect(result.water.consumed).toBe(0);
      expect(result.water.unit).toBe('l');
      expect(result.lastMeal).toBeNull();
      expect(result.streak).toBe(0);
    });

    it('should return correct values in kcal and litres (defaults)', async () => {
      mockPrisma.userGoal.findUnique.mockResolvedValue(baseGoals);
      mockPrisma.userPreferences.findUnique.mockResolvedValue({ energy_unit: 'kcal', water_unit: 'l' });
      mockPrisma.dailySummary.findUnique.mockResolvedValue(baseSummary);
      mockPrisma.waterLog.aggregate.mockResolvedValue({ _sum: { amount_ml: 1800 } });
      mockPrisma.meal.findFirst.mockResolvedValue(null);
      mockPrisma.streak.findUnique.mockResolvedValue({ current_streak: 14, best_streak: 20 });

      const result = await service.getDailySummary('user-123', date);

      expect(result.calories.consumed).toBe(1840);
      expect(result.calories.goal).toBe(2200);
      expect(result.calories.unit).toBe('kcal');
      expect(result.water.consumed).toBe(1.8);
      expect(result.water.goal).toBe(2.5);
      expect(result.water.unit).toBe('l');
      expect(result.streak).toBe(14);
    });

    it('should convert calories to kJ when energy_unit is kj', async () => {
      mockPrisma.userGoal.findUnique.mockResolvedValue(baseGoals);
      mockPrisma.userPreferences.findUnique.mockResolvedValue({ energy_unit: 'kj', water_unit: 'l' });
      mockPrisma.dailySummary.findUnique.mockResolvedValue(baseSummary);
      mockPrisma.waterLog.aggregate.mockResolvedValue({ _sum: { amount_ml: 0 } });
      mockPrisma.meal.findFirst.mockResolvedValue(null);
      mockPrisma.streak.findUnique.mockResolvedValue(null);

      const result = await service.getDailySummary('user-123', date);

      expect(result.calories.unit).toBe('kj');
      expect(result.calories.consumed).toBe(Math.round(1840 * 4.184));
      expect(result.calories.goal).toBe(Math.round(2200 * 4.184));
    });

    it('should convert water to fl_oz when water_unit is fl_oz', async () => {
      mockPrisma.userGoal.findUnique.mockResolvedValue(baseGoals);
      mockPrisma.userPreferences.findUnique.mockResolvedValue({ energy_unit: 'kcal', water_unit: 'fl_oz' });
      mockPrisma.dailySummary.findUnique.mockResolvedValue(null);
      mockPrisma.waterLog.aggregate.mockResolvedValue({ _sum: { amount_ml: 1000 } });
      mockPrisma.meal.findFirst.mockResolvedValue(null);
      mockPrisma.streak.findUnique.mockResolvedValue(null);

      const result = await service.getDailySummary('user-123', date);

      expect(result.water.unit).toBe('fl_oz');
      expect(result.water.consumed).toBeCloseTo(1000 * 0.033814, 1);
      expect(result.water.goal).toBeCloseTo(2500 * 0.033814, 1);
    });

    it('should return macros array with correct labels and accent colors', async () => {
      mockPrisma.userGoal.findUnique.mockResolvedValue(baseGoals);
      mockPrisma.userPreferences.findUnique.mockResolvedValue(null);
      mockPrisma.dailySummary.findUnique.mockResolvedValue(baseSummary);
      mockPrisma.waterLog.aggregate.mockResolvedValue({ _sum: { amount_ml: 0 } });
      mockPrisma.meal.findFirst.mockResolvedValue(null);
      mockPrisma.streak.findUnique.mockResolvedValue(null);

      const result = await service.getDailySummary('user-123', date);

      expect(result.macros).toHaveLength(3);
      expect(result.macros[0]).toMatchObject({ label: 'Protein', value: 87, unit: 'g', accentColor: 'rgba(100,220,180,0.22)' });
      expect(result.macros[1]).toMatchObject({ label: 'Carbs',   value: 210, unit: 'g', accentColor: 'rgba(255,200,80,0.22)'  });
      expect(result.macros[2]).toMatchObject({ label: 'Fat',     value: 54,  unit: 'g', accentColor: 'rgba(255,100,150,0.22)' });
    });

    it('should populate lastMeal when a meal exists on that date', async () => {
      const eatenAt = new Date(Date.now() - 2 * 3_600_000); // 2 hours ago
      mockPrisma.userGoal.findUnique.mockResolvedValue(baseGoals);
      mockPrisma.userPreferences.findUnique.mockResolvedValue({ energy_unit: 'kcal', water_unit: 'l' });
      mockPrisma.dailySummary.findUnique.mockResolvedValue(null);
      mockPrisma.waterLog.aggregate.mockResolvedValue({ _sum: { amount_ml: 0 } });
      mockPrisma.meal.findFirst.mockResolvedValue({
        name: 'Grilled Salmon',
        eaten_at: eatenAt,
        items: [{ calories: 300 }, { calories: 220 }],
      });
      mockPrisma.streak.findUnique.mockResolvedValue(null);

      const result = await service.getDailySummary('user-123', date);

      expect(result.lastMeal).not.toBeNull();
      expect(result.lastMeal.name).toBe('Grilled Salmon');
      expect(result.lastMeal.calories).toBe(520);
      expect(result.lastMeal.unit).toBe('kcal');
      expect(result.lastMeal.hoursAgo).toBe(2);
    });

    it('should convert lastMeal calories to kJ when energy_unit is kj', async () => {
      const eatenAt = new Date(Date.now() - 3_600_000);
      mockPrisma.userGoal.findUnique.mockResolvedValue(baseGoals);
      mockPrisma.userPreferences.findUnique.mockResolvedValue({ energy_unit: 'kj', water_unit: 'l' });
      mockPrisma.dailySummary.findUnique.mockResolvedValue(null);
      mockPrisma.waterLog.aggregate.mockResolvedValue({ _sum: { amount_ml: 0 } });
      mockPrisma.meal.findFirst.mockResolvedValue({
        name: 'Oatmeal',
        eaten_at: eatenAt,
        items: [{ calories: 400 }],
      });
      mockPrisma.streak.findUnique.mockResolvedValue(null);

      const result = await service.getDailySummary('user-123', date);

      expect(result.lastMeal.unit).toBe('kj');
      expect(result.lastMeal.calories).toBe(Math.round(400 * 4.184));
    });
  });
});
