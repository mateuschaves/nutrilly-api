import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { UnitsService } from '../units/units.service';

describe('DashboardService', () => {
  let service: DashboardService;

  const mockPrisma = {
    userProfile: { findUnique: jest.fn() },
    diaryEntry: { aggregate: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    hydrationEntry: { aggregate: jest.fn() },
  };

  const mockUnitsService = {
    getUserUnits: jest.fn().mockResolvedValue({ energy: 'kcal', water: 'l', weight: 'kg', height: 'cm' }),
    convertEnergy: jest.fn().mockImplementation((kcal: number, unit: string) =>
      unit === 'kj' ? Math.round(kcal * 4.184) : Math.round(kcal),
    ),
    convertWater: jest.fn().mockImplementation((ml: number, unit: string) =>
      unit === 'fl_oz'
        ? Math.round((ml / 1000) * 33.814 * 100) / 100
        : Math.round((ml / 1000) * 100) / 100,
    ),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: UnitsService, useValue: mockUnitsService },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    jest.clearAllMocks();

    // Reset to default implementations after clearAllMocks
    mockUnitsService.getUserUnits.mockResolvedValue({ energy: 'kcal', water: 'l', weight: 'kg', height: 'cm' });
    mockUnitsService.convertEnergy.mockImplementation((kcal: number, unit: string) =>
      unit === 'kj' ? Math.round(kcal * 4.184) : Math.round(kcal),
    );
    mockUnitsService.convertWater.mockImplementation((ml: number, unit: string) =>
      unit === 'fl_oz'
        ? Math.round((ml / 1000) * 33.814 * 100) / 100
        : Math.round((ml / 1000) * 100) / 100,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDailySummary', () => {
    const date = '2025-03-15';

    beforeEach(() => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue([]);
    });

    it('should throw BadRequestException for invalid date format', async () => {
      await expect(service.getDailySummary('user-1', 'not-a-date')).rejects.toThrow(BadRequestException);
    });

    it('should return zeroed values when no data exists', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue(null);
      mockPrisma.diaryEntry.aggregate.mockResolvedValue({ _sum: { kcal: null, proteinG: null, carbsG: null, fatG: null } });
      mockPrisma.hydrationEntry.aggregate.mockResolvedValue({ _sum: { amountMl: null } });
      mockPrisma.diaryEntry.findFirst.mockResolvedValue(null);

      const result = await service.getDailySummary('user-1', date);

      expect(result.calories.consumed).toBe(0);
      expect(result.calories.goal).toBe(0);
      expect(result.calories.unit).toBe('kcal');
      expect(result.water.consumed).toBe(0);
      expect(result.water.unit).toBe('l');
      expect(result.lastMeal).toBeNull();
      expect(result.streak).toBe(0);
    });

    it('should return correct values in kcal and litres (defaults)', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        caloriesGoal: 2200,
        waterGoalMl: 2500,
        proteinGoalG: 150,
        carbsGoalG: 250,
        fatGoalG: 70,
      });
      mockPrisma.diaryEntry.aggregate.mockResolvedValue({
        _sum: { kcal: 1840, proteinG: 87, carbsG: 210, fatG: 54 },
      });
      mockPrisma.hydrationEntry.aggregate.mockResolvedValue({ _sum: { amountMl: 1800 } });
      mockPrisma.diaryEntry.findFirst.mockResolvedValue(null);

      const result = await service.getDailySummary('user-1', date);

      expect(result.calories.consumed).toBe(1840);
      expect(result.calories.goal).toBe(2200);
      expect(result.calories.unit).toBe('kcal');
      expect(result.water.consumed).toBe(1.8);
      expect(result.water.goal).toBe(2.5);
      expect(result.water.unit).toBe('l');
    });

    it('should convert calories to kJ when energy unit is kj', async () => {
      mockUnitsService.getUserUnits.mockResolvedValue({ energy: 'kj', water: 'l', weight: 'kg', height: 'cm' });
      mockPrisma.userProfile.findUnique.mockResolvedValue({ caloriesGoal: 2200, waterGoalMl: 2600 });
      mockPrisma.diaryEntry.aggregate.mockResolvedValue({
        _sum: { kcal: 1840, proteinG: 87, carbsG: 210, fatG: 54 },
      });
      mockPrisma.hydrationEntry.aggregate.mockResolvedValue({ _sum: { amountMl: 0 } });
      mockPrisma.diaryEntry.findFirst.mockResolvedValue(null);

      const result = await service.getDailySummary('user-1', date);

      expect(result.calories.unit).toBe('kj');
      expect(result.calories.consumed).toBe(Math.round(1840 * 4.184));
      expect(result.calories.goal).toBe(Math.round(2200 * 4.184));
    });

    it('should convert water to fl_oz when water unit is fl_oz', async () => {
      mockUnitsService.getUserUnits.mockResolvedValue({ energy: 'kcal', water: 'fl_oz', weight: 'kg', height: 'cm' });
      mockPrisma.userProfile.findUnique.mockResolvedValue({ caloriesGoal: 2200, waterGoalMl: 2500 });
      mockPrisma.diaryEntry.aggregate.mockResolvedValue({ _sum: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 } });
      mockPrisma.hydrationEntry.aggregate.mockResolvedValue({ _sum: { amountMl: 1000 } });
      mockPrisma.diaryEntry.findFirst.mockResolvedValue(null);

      const result = await service.getDailySummary('user-1', date);

      expect(result.water.unit).toBe('fl_oz');
      expect(result.water.consumed).toBeCloseTo((1000 / 1000) * 33.814, 1);
      expect(result.water.goal).toBeCloseTo((2500 / 1000) * 33.814, 1);
    });

    it('should return macros array with type fields (no accentColor)', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue({ caloriesGoal: 2200, waterGoalMl: 2600 });
      mockPrisma.diaryEntry.aggregate.mockResolvedValue({
        _sum: { kcal: 1840, proteinG: 87, carbsG: 210, fatG: 54 },
      });
      mockPrisma.hydrationEntry.aggregate.mockResolvedValue({ _sum: { amountMl: 0 } });
      mockPrisma.diaryEntry.findFirst.mockResolvedValue(null);

      const result = await service.getDailySummary('user-1', date);

      expect(result.macros).toHaveLength(3);
      expect(result.macros[0]).toMatchObject({ label: 'Protein', value: 87, unit: 'g', type: 'protein' });
      expect(result.macros[1]).toMatchObject({ label: 'Carbs',   value: 210, unit: 'g', type: 'carbs'   });
      expect(result.macros[2]).toMatchObject({ label: 'Fat',     value: 54,  unit: 'g', type: 'fat'     });
      expect(result.macros[0]).not.toHaveProperty('accentColor');
    });

    it('should populate lastMeal when a diary entry exists', async () => {
      const loggedAt = new Date(Date.now() - 2 * 3_600_000); // 2 hours ago
      mockPrisma.userProfile.findUnique.mockResolvedValue({ caloriesGoal: 2200, waterGoalMl: 2600 });
      mockPrisma.diaryEntry.aggregate.mockResolvedValue({
        _sum: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
      });
      mockPrisma.hydrationEntry.aggregate.mockResolvedValue({ _sum: { amountMl: 0 } });
      mockPrisma.diaryEntry.findFirst.mockResolvedValue({
        name: 'Grilled Salmon',
        kcal: 520,
        loggedAt,
      });

      const result = await service.getDailySummary('user-1', date);

      expect(result.lastMeal).not.toBeNull();
      expect(result.lastMeal!.name).toBe('Grilled Salmon');
      expect(result.lastMeal!.calories).toBe(520);
      expect(result.lastMeal!.unit).toBe('kcal');
      expect(result.lastMeal!.hoursAgo).toBe(2);
    });

    it('should convert lastMeal calories to kJ when energy unit is kj', async () => {
      const loggedAt = new Date(Date.now() - 3_600_000);
      mockUnitsService.getUserUnits.mockResolvedValue({ energy: 'kj', water: 'l', weight: 'kg', height: 'cm' });
      mockPrisma.userProfile.findUnique.mockResolvedValue({ caloriesGoal: 2200, waterGoalMl: 2600 });
      mockPrisma.diaryEntry.aggregate.mockResolvedValue({ _sum: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 } });
      mockPrisma.hydrationEntry.aggregate.mockResolvedValue({ _sum: { amountMl: 0 } });
      mockPrisma.diaryEntry.findFirst.mockResolvedValue({ name: 'Oatmeal', kcal: 400, loggedAt });

      const result = await service.getDailySummary('user-1', date);

      expect(result.lastMeal!.unit).toBe('kj');
      expect(result.lastMeal!.calories).toBe(Math.round(400 * 4.184));
    });
  });

  describe('computeStreak', () => {
    it('should return 0 when no entries exist', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue([]);
      expect(await service.computeStreak('user-1', '2025-03-15')).toBe(0);
    });

    it('should return 0 when last entry is not today or yesterday', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue([{ date: '2025-03-10' }]);
      expect(await service.computeStreak('user-1', '2025-03-15')).toBe(0);
    });

    it('should return consecutive streak count', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue([
        { date: '2025-03-15' },
        { date: '2025-03-14' },
        { date: '2025-03-13' },
        { date: '2025-03-11' }, // gap here
      ]);
      expect(await service.computeStreak('user-1', '2025-03-15')).toBe(3);
    });

    it('should return 1 when only today has an entry', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue([{ date: '2025-03-15' }]);
      expect(await service.computeStreak('user-1', '2025-03-15')).toBe(1);
    });

    it('should return 1 when only yesterday has an entry', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue([{ date: '2025-03-14' }]);
      expect(await service.computeStreak('user-1', '2025-03-15')).toBe(1);
    });

    it('should count a 3-day streak starting from today', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue([
        { date: '2025-03-15' },
        { date: '2025-03-14' },
        { date: '2025-03-13' },
      ]);
      expect(await service.computeStreak('user-1', '2025-03-15')).toBe(3);
    });
  });

  describe('calories remaining', () => {
    beforeEach(() => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue([]);
      mockPrisma.diaryEntry.findFirst.mockResolvedValue(null);
      mockPrisma.hydrationEntry.aggregate.mockResolvedValue({ _sum: { amountMl: 0 } });
    });

    it('should return 0 consumed when no diary entries exist', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue({ caloriesGoal: 2000, waterGoalMl: 2000 });
      mockPrisma.diaryEntry.aggregate.mockResolvedValue({
        _sum: { kcal: null, proteinG: null, carbsG: null, fatG: null },
      });

      const result = await service.getDailySummary('user-1', '2025-03-15');

      expect(result.calories.consumed).toBe(0);
      expect(result.calories.goal).toBe(2000);
    });

    it('should return correct consumed calories', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue({ caloriesGoal: 2000, waterGoalMl: 2000 });
      mockPrisma.diaryEntry.aggregate.mockResolvedValue({
        _sum: { kcal: 1500, proteinG: 80, carbsG: 150, fatG: 50 },
      });

      const result = await service.getDailySummary('user-1', '2025-03-15');

      expect(result.calories.consumed).toBe(1500);
    });
  });
});
