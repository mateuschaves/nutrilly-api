import { Test, TestingModule } from '@nestjs/testing';
import { ProfileService } from './profile.service';
import { PrismaService } from '../prisma/prisma.service';
import { UnitsService } from '../units/units.service';

const USER_ID = 'user-1';

const makeUser = (overrides = {}) => ({
  id: USER_ID,
  name: 'John',
  email: 'john@example.com',
  ...overrides,
});

const makeProfile = (overrides = {}) => ({
  userId: USER_ID,
  birthdate: '1990-01-01',
  sex: 'male',
  weightKg: 80,
  heightCm: 180,
  goal: 'lose_weight',
  activityLevel: 'active',
  caloriesGoal: 2200,
  waterGoalMl: 2600,
  proteinGoalG: 150,
  carbsGoalG: 250,
  fatGoalG: 70,
  ...overrides,
});

describe('ProfileService', () => {
  let service: ProfileService;

  const mockPrisma = {
    user: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
    userProfile: { findUnique: jest.fn(), upsert: jest.fn() },
    userUnitPreferences: { upsert: jest.fn() },
  };

  const mockUnitsService = {
    getUserUnits: jest.fn(),
    convertEnergy: jest.fn().mockImplementation((kcal: number) => kcal),
    convertWater: jest.fn().mockImplementation((ml: number) => ml / 1000),
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

    mockUnitsService.getUserUnits.mockResolvedValue({ energy: 'kcal', water: 'l', weight: 'kg', height: 'cm' });
    mockUnitsService.convertEnergy.mockImplementation((kcal: number) => kcal);
    mockUnitsService.convertWater.mockImplementation((ml: number) => ml / 1000);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── getProfile ──────────────────────────────────────────────────────────────

  describe('getProfile', () => {
    it('should return full profile when user and profile exist', async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(makeUser());
      mockPrisma.userProfile.findUnique.mockResolvedValue(makeProfile());

      const result = await service.getProfile(USER_ID);

      expect(result.name).toBe('John');
      expect(result.email).toBe('john@example.com');
      expect(result.birthdate).toBe('1990-01-01');
      expect(result.sex).toBe('male');
      expect(result.weightKg).toBe(80);
      expect(result.heightCm).toBe(180);
      expect(result.goal).toBe('lose_weight');
      expect(result.activityLevel).toBe('active');
    });

    it('should return null for optional profile fields when no profile exists', async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(makeUser());
      mockPrisma.userProfile.findUnique.mockResolvedValue(null);

      const result = await service.getProfile(USER_ID);

      expect(result.birthdate).toBeNull();
      expect(result.sex).toBeNull();
      expect(result.weightKg).toBeNull();
      expect(result.heightCm).toBeNull();
      expect(result.goal).toBeNull();
      expect(result.activityLevel).toBeNull();
    });

    it('should use default goals when no profile exists', async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(makeUser());
      mockPrisma.userProfile.findUnique.mockResolvedValue(null);

      const result = await service.getProfile(USER_ID);

      expect(result.dailyGoals.calories.value).toBe(2200); // default
      expect(result.dailyGoals.proteinG).toBe(150);        // default
      expect(result.dailyGoals.carbsG).toBe(250);          // default
      expect(result.dailyGoals.fatG).toBe(70);             // default
      expect(result.dailyGoals.water.value).toBe(2.6);     // 2600ml → 2.6L
    });

    it('should use profile goals when profile exists', async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(makeUser());
      mockPrisma.userProfile.findUnique.mockResolvedValue(
        makeProfile({ caloriesGoal: 1800, waterGoalMl: 3000, proteinGoalG: 180, carbsGoalG: 200, fatGoalG: 60 }),
      );

      const result = await service.getProfile(USER_ID);

      expect(result.dailyGoals.calories.value).toBe(1800);
      expect(result.dailyGoals.proteinG).toBe(180);
      expect(result.dailyGoals.carbsG).toBe(200);
      expect(result.dailyGoals.fatG).toBe(60);
      expect(result.dailyGoals.water.value).toBe(3); // 3000ml → 3L
    });

    it('should include energy and water units in daily goals', async () => {
      mockUnitsService.getUserUnits.mockResolvedValue({ energy: 'kj', water: 'fl_oz', weight: 'kg', height: 'cm' });
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(makeUser());
      mockPrisma.userProfile.findUnique.mockResolvedValue(null);

      const result = await service.getProfile(USER_ID);

      expect(result.dailyGoals.calories.unit).toBe('kj');
      expect(result.dailyGoals.water.unit).toBe('fl_oz');
    });
  });

  // ─── updateProfile ───────────────────────────────────────────────────────────

  describe('updateProfile', () => {
    beforeEach(() => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(makeUser());
      mockPrisma.userProfile.findUnique.mockResolvedValue(makeProfile());
    });

    it('should update user name when name is provided', async () => {
      mockPrisma.user.update.mockResolvedValue(makeUser({ name: 'Jane' }));

      await service.updateProfile(USER_ID, { name: 'Jane' });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: { name: 'Jane' },
      });
    });

    it('should NOT update user name when name is not provided', async () => {
      await service.updateProfile(USER_ID, { weightKg: 75 });

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should upsert profile when profile fields are provided', async () => {
      await service.updateProfile(USER_ID, { weightKg: 75, sex: 'male' });

      expect(mockPrisma.userProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER_ID },
          create: expect.objectContaining({ userId: USER_ID, weightKg: 75, sex: 'male' }),
          update: expect.objectContaining({ weightKg: 75, sex: 'male' }),
        }),
      );
    });

    it('should NOT call upsert when no profile fields are provided', async () => {
      await service.updateProfile(USER_ID, {});

      expect(mockPrisma.userProfile.upsert).not.toHaveBeenCalled();
    });

    it('should update dailyGoals.calories as caloriesGoal in profile', async () => {
      await service.updateProfile(USER_ID, { dailyGoals: { calories: 1800 } });

      expect(mockPrisma.userProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ caloriesGoal: 1800 }),
        }),
      );
    });

    it('should update dailyGoals.waterMl as waterGoalMl in profile', async () => {
      await service.updateProfile(USER_ID, { dailyGoals: { waterMl: 3000 } });

      expect(mockPrisma.userProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ waterGoalMl: 3000 }),
        }),
      );
    });

    it('should return updated profile after changes', async () => {
      mockPrisma.user.update.mockResolvedValue(makeUser({ name: 'Jane' }));
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(makeUser({ name: 'Jane' }));

      const result = await service.updateProfile(USER_ID, { name: 'Jane' });

      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('dailyGoals');
    });

    it('should run name update and profile upsert in parallel', async () => {
      const callOrder: string[] = [];
      mockPrisma.user.update.mockImplementation(() => {
        callOrder.push('user.update');
        return Promise.resolve(makeUser({ name: 'Jane' }));
      });
      mockPrisma.userProfile.upsert.mockImplementation(() => {
        callOrder.push('profile.upsert');
        return Promise.resolve(makeProfile());
      });

      await service.updateProfile(USER_ID, { name: 'Jane', weightKg: 75 });

      // Both should be called (order not deterministic due to Promise.all)
      expect(callOrder).toContain('user.update');
      expect(callOrder).toContain('profile.upsert');
    });
  });

  // ─── getUnits ────────────────────────────────────────────────────────────────

  describe('getUnits', () => {
    it('should delegate to UnitsService.getUserUnits', async () => {
      mockUnitsService.getUserUnits.mockResolvedValue({ energy: 'kj', water: 'fl_oz', weight: 'lbs', height: 'ft_in' });

      const result = await service.getUnits(USER_ID);

      expect(result).toEqual({ energy: 'kj', water: 'fl_oz', weight: 'lbs', height: 'ft_in' });
      expect(mockUnitsService.getUserUnits).toHaveBeenCalledWith(USER_ID);
    });
  });

  // ─── updateUnits ─────────────────────────────────────────────────────────────

  describe('updateUnits', () => {
    it('should upsert unit preferences with provided fields', async () => {
      mockPrisma.userUnitPreferences.upsert.mockResolvedValue({});
      mockUnitsService.getUserUnits.mockResolvedValue({ energy: 'kj', water: 'l', weight: 'kg', height: 'cm' });

      await service.updateUnits(USER_ID, { energy: 'kj' });

      expect(mockPrisma.userUnitPreferences.upsert).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        create: { userId: USER_ID, energy: 'kj' },
        update: { energy: 'kj' },
      });
    });

    it('should return updated units after upsert', async () => {
      mockPrisma.userUnitPreferences.upsert.mockResolvedValue({});
      mockUnitsService.getUserUnits.mockResolvedValue({ energy: 'kj', water: 'fl_oz', weight: 'lbs', height: 'cm' });

      const result = await service.updateUnits(USER_ID, { energy: 'kj', water: 'fl_oz', weight: 'lbs' });

      expect(result).toEqual({ energy: 'kj', water: 'fl_oz', weight: 'lbs', height: 'cm' });
    });

    it('should only include defined fields in upsert data', async () => {
      mockPrisma.userUnitPreferences.upsert.mockResolvedValue({});
      mockUnitsService.getUserUnits.mockResolvedValue({ energy: 'kcal', water: 'l', weight: 'kg', height: 'cm' });

      await service.updateUnits(USER_ID, { water: 'fl_oz' });

      const callArg = mockPrisma.userUnitPreferences.upsert.mock.calls[0][0];
      expect(callArg.update).toEqual({ water: 'fl_oz' });
      expect(callArg.update).not.toHaveProperty('energy');
      expect(callArg.update).not.toHaveProperty('weight');
    });
  });
});
