import { Test, TestingModule } from '@nestjs/testing';
import { ProfileService } from './profile.service';
import { PrismaService } from '../prisma/prisma.service';
import { UnitsService } from '../units/units.service';

describe('ProfileService', () => {
  let service: ProfileService;

  const mockPrisma = {
    user: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
    userProfile: { findUnique: jest.fn(), upsert: jest.fn() },
    userUnitPreferences: { upsert: jest.fn() },
    weightLog: { findMany: jest.fn() },
    diaryEntry: { findMany: jest.fn() },
    hydrationEntry: { findMany: jest.fn() },
  };

  const defaultUnits = { energy: 'kcal', water: 'l', weight: 'kg', height: 'cm' };

  const mockUnitsService = {
    getUserUnits: jest.fn().mockResolvedValue(defaultUnits),
    convertEnergy: jest.fn().mockImplementation((kcal: number) => Math.round(kcal)),
    convertWater: jest.fn().mockImplementation((ml: number) => Math.round((ml / 1000) * 100) / 100),
    convertWeight: jest.fn().mockImplementation((kg: number) => Math.round(kg * 10) / 10),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: UnitsService, useValue: mockUnitsService },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
    jest.clearAllMocks();
    mockUnitsService.getUserUnits.mockResolvedValue(defaultUnits);
    mockUnitsService.convertEnergy.mockImplementation((kcal: number) => Math.round(kcal));
    mockUnitsService.convertWater.mockImplementation((ml: number) => Math.round((ml / 1000) * 100) / 100);
    mockUnitsService.convertWeight.mockImplementation((kg: number) => Math.round(kg * 10) / 10);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── getProfileScreen ───────────────────────────────────────────

  describe('getProfileScreen', () => {
    const baseUser = { id: 'u1', name: 'Mateus Henrique', email: 'mateus@nutrilly.app' };
    const baseProfile = {
      birthdate: '1996-03-19',
      sex: 'male',
      weightKg: 78,
      heightCm: 178,
      goal: 'gain_muscle',
      activityLevel: 'active',
      caloriesGoal: 2200,
      proteinGoalG: 150,
      carbsGoalG: 250,
      fatGoalG: 70,
      waterGoalMl: 2600,
    };

    beforeEach(() => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(baseUser);
      mockPrisma.userProfile.findUnique.mockResolvedValue(baseProfile);
      mockPrisma.weightLog.findMany.mockResolvedValue([]);
      mockPrisma.diaryEntry.findMany.mockResolvedValue([]);
      mockPrisma.hydrationEntry.findMany.mockResolvedValue([]);
    });

    it('should return name, email, and initials', async () => {
      const result = await service.getProfileScreen('u1');
      expect(result.name).toBe('Mateus Henrique');
      expect(result.email).toBe('mateus@nutrilly.app');
      expect(result.initials).toBe('MH');
    });

    it('should build initials from single-word name', async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({ ...baseUser, name: 'Mateus' });
      const result = await service.getProfileScreen('u1');
      expect(result.initials).toBe('M');
    });

    it('should build initials from more than two words using only first two', async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({ ...baseUser, name: 'Mateus Henrique Chaves' });
      const result = await service.getProfileScreen('u1');
      expect(result.initials).toBe('MH');
    });

    it('should return the goal from profile', async () => {
      const result = await service.getProfileScreen('u1');
      expect(result.goal).toBe('gain_muscle');
    });

    it('should return null goal when profile has no goal', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue({ ...baseProfile, goal: null });
      const result = await service.getProfileScreen('u1');
      expect(result.goal).toBeNull();
    });

    it('should return null goal when profile does not exist', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue(null);
      const result = await service.getProfileScreen('u1');
      expect(result.goal).toBeNull();
    });

    describe('bodyStats', () => {
      it('should return converted weight and unit', async () => {
        mockUnitsService.convertWeight.mockReturnValue(78.0);
        const result = await service.getProfileScreen('u1');
        expect(result.bodyStats.weight).toEqual({ value: 78.0, unit: 'kg' });
      });

      it('should return null weight when profile has no weight', async () => {
        mockPrisma.userProfile.findUnique.mockResolvedValue({ ...baseProfile, weightKg: null });
        const result = await service.getProfileScreen('u1');
        expect(result.bodyStats.weight).toBeNull();
      });

      it('should return height in cm format', async () => {
        const result = await service.getProfileScreen('u1');
        expect(result.bodyStats.height).toEqual({ cm: 178, feet: null, inches: null, unit: 'cm' });
      });

      it('should return height in ft_in format', async () => {
        mockUnitsService.getUserUnits.mockResolvedValue({ ...defaultUnits, height: 'ft_in' });
        // 178cm → ~70.07 inches → 5ft 10in
        const result = await service.getProfileScreen('u1');
        expect(result.bodyStats.height).toMatchObject({ cm: null, feet: 5, inches: 10, unit: 'ft_in' });
      });

      it('should return null height when profile has no height', async () => {
        mockPrisma.userProfile.findUnique.mockResolvedValue({ ...baseProfile, heightCm: null });
        const result = await service.getProfileScreen('u1');
        expect(result.bodyStats.height).toBeNull();
      });

      it('should calculate age from birthdate', async () => {
        // birthdate 1996-03-19, today is 2026-03-19 → 30 years old
        const result = await service.getProfileScreen('u1');
        expect(result.bodyStats.age).toBe(30);
      });

      it('should return null age when birthdate is missing', async () => {
        mockPrisma.userProfile.findUnique.mockResolvedValue({ ...baseProfile, birthdate: null });
        const result = await service.getProfileScreen('u1');
        expect(result.bodyStats.age).toBeNull();
      });

      it('should calculate BMI from weight and height', async () => {
        // 78 / (1.78^2) = 24.6
        const result = await service.getProfileScreen('u1');
        expect(result.bodyStats.bmi).toBeCloseTo(24.6, 0);
      });

      it('should return null BMI when weight is missing', async () => {
        mockPrisma.userProfile.findUnique.mockResolvedValue({ ...baseProfile, weightKg: null });
        const result = await service.getProfileScreen('u1');
        expect(result.bodyStats.bmi).toBeNull();
      });

      it('should return null BMI when height is missing', async () => {
        mockPrisma.userProfile.findUnique.mockResolvedValue({ ...baseProfile, heightCm: null });
        const result = await service.getProfileScreen('u1');
        expect(result.bodyStats.bmi).toBeNull();
      });
    });

    describe('weightProgress', () => {
      it('should return empty entries and null stats when no logs exist', async () => {
        const result = await service.getProfileScreen('u1');
        expect(result.weightProgress.entries).toHaveLength(0);
        expect(result.weightProgress.totalEntries).toBe(0);
        expect(result.weightProgress.min).toBeNull();
        expect(result.weightProgress.max).toBeNull();
        expect(result.weightProgress.change).toBeNull();
      });

      it('should return entries converted to user weight unit', async () => {
        mockUnitsService.convertWeight.mockReturnValue(171.9);
        mockPrisma.weightLog.findMany.mockResolvedValue([
          { weightKg: 78, loggedAt: new Date('2026-02-11T08:00:00Z') },
        ]);
        const result = await service.getProfileScreen('u1');
        expect(result.weightProgress.entries).toHaveLength(1);
        expect(result.weightProgress.entries[0]).toMatchObject({ date: '2026-02-11', unit: 'kg' });
      });

      it('should calculate min, max and overall change with direction up', async () => {
        mockUnitsService.convertWeight.mockImplementation((kg: number) => kg);
        mockPrisma.weightLog.findMany.mockResolvedValue([
          { weightKg: 70, loggedAt: new Date('2026-01-01') },
          { weightKg: 78, loggedAt: new Date('2026-03-01') },
        ]);

        const result = await service.getProfileScreen('u1');
        expect(result.weightProgress.min!.value).toBe(70);
        expect(result.weightProgress.max!.value).toBe(78);
        expect(result.weightProgress.change!.direction).toBe('up');
        expect(result.weightProgress.change!.value).toBe(8);
      });

      it('should return direction down when weight decreased', async () => {
        mockUnitsService.convertWeight.mockImplementation((kg: number) => kg);
        mockPrisma.weightLog.findMany.mockResolvedValue([
          { weightKg: 90, loggedAt: new Date('2026-01-01') },
          { weightKg: 78, loggedAt: new Date('2026-03-01') },
        ]);
        const result = await service.getProfileScreen('u1');
        expect(result.weightProgress.change!.direction).toBe('down');
      });

      it('should return direction stable when weight did not change', async () => {
        mockUnitsService.convertWeight.mockImplementation((kg: number) => kg);
        mockPrisma.weightLog.findMany.mockResolvedValue([
          { weightKg: 78, loggedAt: new Date('2026-01-01') },
          { weightKg: 78, loggedAt: new Date('2026-03-01') },
        ]);
        const result = await service.getProfileScreen('u1');
        expect(result.weightProgress.change!.direction).toBe('stable');
      });

      it('should report totalEntries correctly', async () => {
        mockUnitsService.convertWeight.mockImplementation((kg: number) => kg);
        mockPrisma.weightLog.findMany.mockResolvedValue([
          { weightKg: 70, loggedAt: new Date('2026-01-01') },
          { weightKg: 74, loggedAt: new Date('2026-02-01') },
          { weightKg: 78, loggedAt: new Date('2026-03-01') },
        ]);
        const result = await service.getProfileScreen('u1');
        expect(result.weightProgress.totalEntries).toBe(3);
      });
    });

    describe('dailyGoals', () => {
      it('should sum calories from today diary entries', async () => {
        mockPrisma.diaryEntry.findMany.mockResolvedValue([
          { kcal: 500, proteinG: 30, carbsG: 60, fatG: 10 },
          { kcal: 300, proteinG: 15, carbsG: 40, fatG: 5 },
        ]);
        mockUnitsService.convertEnergy.mockImplementation((kcal: number) => kcal);
        const result = await service.getProfileScreen('u1');
        expect(result.dailyGoals.calories.consumed).toBe(800);
        expect(result.dailyGoals.calories.goal).toBe(2200);
      });

      it('should sum protein from today diary entries', async () => {
        mockPrisma.diaryEntry.findMany.mockResolvedValue([
          { kcal: 200, proteinG: 30.4, carbsG: 20, fatG: 5 },
          { kcal: 200, proteinG: 17.6, carbsG: 20, fatG: 5 },
        ]);
        const result = await service.getProfileScreen('u1');
        expect(result.dailyGoals.protein.consumed).toBe(48); // Math.round(48.0)
        expect(result.dailyGoals.protein.goal).toBe(150);
      });

      it('should sum water from today hydration entries', async () => {
        mockPrisma.hydrationEntry.findMany.mockResolvedValue([
          { amountMl: 500 },
          { amountMl: 300 },
        ]);
        mockUnitsService.convertWater.mockImplementation((ml: number) => ml / 1000);
        const result = await service.getProfileScreen('u1');
        expect(result.dailyGoals.water.consumed).toBe(0.8);
        expect(result.dailyGoals.water.goal).toBe(2.6);
      });

      it('should return zero consumed when no diary entries today', async () => {
        mockUnitsService.convertEnergy.mockImplementation((kcal: number) => kcal);
        const result = await service.getProfileScreen('u1');
        expect(result.dailyGoals.calories.consumed).toBe(0);
        expect(result.dailyGoals.protein.consumed).toBe(0);
      });

      it('should use default goals when profile is null', async () => {
        mockPrisma.userProfile.findUnique.mockResolvedValue(null);
        mockUnitsService.convertEnergy.mockImplementation((kcal: number) => kcal);
        const result = await service.getProfileScreen('u1');
        expect(result.dailyGoals.calories.goal).toBe(2200);
        expect(result.dailyGoals.protein.goal).toBe(150);
      });
    });
  });

  // ── updateProfile ──────────────────────────────────────────────

  describe('updateProfile', () => {
    beforeEach(() => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'u1', name: 'Mateus', email: 'mateus@nutrilly.app' });
      mockPrisma.userProfile.findUnique.mockResolvedValue(null);
      mockPrisma.weightLog.findMany.mockResolvedValue([]);
      mockPrisma.diaryEntry.findMany.mockResolvedValue([]);
      mockPrisma.hydrationEntry.findMany.mockResolvedValue([]);
    });

    it('should update user name when provided', async () => {
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.userProfile.upsert.mockResolvedValue({});
      await service.updateProfile('u1', { name: 'New Name', weightKg: 80 });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { name: 'New Name' },
      });
    });

    it('should upsert profile fields when provided', async () => {
      mockPrisma.userProfile.upsert.mockResolvedValue({});
      await service.updateProfile('u1', { weightKg: 80, heightCm: 178 });
      expect(mockPrisma.userProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1' },
          create: expect.objectContaining({ weightKg: 80, heightCm: 178 }),
          update: expect.objectContaining({ weightKg: 80, heightCm: 178 }),
        }),
      );
    });

    it('should not call upsert when no profile fields are provided', async () => {
      await service.updateProfile('u1', { name: 'Only Name' });
      expect(mockPrisma.userProfile.upsert).not.toHaveBeenCalled();
    });

    it('should not call user.update when name is not provided', async () => {
      mockPrisma.userProfile.upsert.mockResolvedValue({});
      await service.updateProfile('u1', { weightKg: 80 });
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  // ── getProfile (basic) ─────────────────────────────────────────

  describe('getProfile', () => {
    it('should return daily goals with converted energy and water values', async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'u1', name: 'Mateus', email: 'mateus@nutrilly.app' });
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        caloriesGoal: 2200,
        waterGoalMl: 2600,
        proteinGoalG: 150,
        carbsGoalG: 250,
        fatGoalG: 70,
        weightKg: null,
        heightCm: null,
        birthdate: null,
        sex: null,
        goal: null,
        activityLevel: null,
      });
      mockUnitsService.convertEnergy.mockReturnValue(9205);
      mockUnitsService.convertWater.mockReturnValue(2.6);

      const result = await service.getProfile('u1');

      expect(result.dailyGoals.calories.value).toBe(9205);
      expect(result.dailyGoals.water.value).toBe(2.6);
    });

    it('should return null fields when profile does not exist', async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'u1', name: 'Mateus', email: 'mateus@nutrilly.app' });
      mockPrisma.userProfile.findUnique.mockResolvedValue(null);

      const result = await service.getProfile('u1');

      expect(result.weightKg).toBeNull();
      expect(result.heightCm).toBeNull();
      expect(result.birthdate).toBeNull();
      expect(result.goal).toBeNull();
    });
  });
});
