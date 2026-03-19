import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { HydrationService } from './hydration.service';
import { PrismaService } from '../prisma/prisma.service';
import { UnitsService } from '../units/units.service';
import { AchievementsService } from '../achievements/achievements.service';

const USER_ID = 'user-1';
const DATE = '2025-03-15';

describe('HydrationService', () => {
  let service: HydrationService;

  const mockPrisma = {
    hydrationEntry: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    userProfile: {
      findUnique: jest.fn(),
    },
  };

  const mockUnitsService = {
    getUserUnits: jest.fn(),
    convertWater: jest.fn(),
  };

  const mockAchievementsService = {
    evaluateForHydration: jest.fn(),
  };

  const defaultUnits = { energy: 'kcal', water: 'l', weight: 'kg', height: 'cm' };
  const defaultProfile = { waterGoalMl: 2600 };

  // A hydration entry as returned by Prisma
  const makeEntry = (overrides = {}) => ({
    id: 'entry-1',
    amountMl: 500,
    loggedAt: new Date('2025-03-15T09:00:00Z'),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HydrationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: UnitsService, useValue: mockUnitsService },
        { provide: AchievementsService, useValue: mockAchievementsService },
      ],
    }).compile();

    service = module.get<HydrationService>(HydrationService);
    jest.clearAllMocks();

    // Safe defaults
    mockUnitsService.getUserUnits.mockResolvedValue(defaultUnits);
    mockUnitsService.convertWater.mockImplementation((ml: number) =>
      Math.round((ml / 1000) * 100) / 100,
    );
    mockPrisma.userProfile.findUnique.mockResolvedValue(defaultProfile);
    mockAchievementsService.evaluateForHydration.mockResolvedValue([]);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── getByDate ──────────────────────────────────────────────────────────────

  describe('getByDate', () => {
    it('should throw BadRequestException for invalid date format', async () => {
      await expect(service.getByDate(USER_ID, 'not-a-date')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for partial date', async () => {
      await expect(service.getByDate(USER_ID, '2025-03')).rejects.toThrow(BadRequestException);
    });

    it('should NOT call evaluateForHydration on read operations', async () => {
      mockPrisma.hydrationEntry.findMany.mockResolvedValue([]);

      await service.getByDate(USER_ID, DATE);

      expect(mockAchievementsService.evaluateForHydration).not.toHaveBeenCalled();
    });

    it('should return entries, totalConsumed, goal and unit', async () => {
      mockPrisma.hydrationEntry.findMany.mockResolvedValue([
        makeEntry({ amountMl: 300 }),
        makeEntry({ id: 'entry-2', amountMl: 500 }),
      ]);

      const result = await service.getByDate(USER_ID, DATE);

      expect(result).toHaveProperty('entries');
      expect(result).toHaveProperty('totalConsumed');
      expect(result).toHaveProperty('goal');
      expect(result).toHaveProperty('unit', 'l');
    });

    it('should return the raw entries from Prisma', async () => {
      const entries = [makeEntry(), makeEntry({ id: 'entry-2', amountMl: 250 })];
      mockPrisma.hydrationEntry.findMany.mockResolvedValue(entries);

      const result = await service.getByDate(USER_ID, DATE);

      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].id).toBe('entry-1');
      expect(result.entries[1].id).toBe('entry-2');
    });

    it('should sum amountMl across all entries to compute totalConsumed', async () => {
      mockPrisma.hydrationEntry.findMany.mockResolvedValue([
        makeEntry({ amountMl: 500 }),
        makeEntry({ id: 'e2', amountMl: 800 }),
        makeEntry({ id: 'e3', amountMl: 200 }),
      ]);
      // convertWater gets the total (1500ml)
      mockUnitsService.convertWater.mockImplementation((ml: number) =>
        Math.round((ml / 1000) * 100) / 100,
      );

      const result = await service.getByDate(USER_ID, DATE);

      expect(mockUnitsService.convertWater).toHaveBeenCalledWith(1500, 'l');
      expect(result.totalConsumed).toBeCloseTo(1.5, 1);
    });

    it('should return totalConsumed of 0 when no entries exist', async () => {
      mockPrisma.hydrationEntry.findMany.mockResolvedValue([]);

      const result = await service.getByDate(USER_ID, DATE);

      expect(mockUnitsService.convertWater).toHaveBeenCalledWith(0, 'l');
    });

    it('should convert the water goal from profile using the unit service', async () => {
      mockPrisma.hydrationEntry.findMany.mockResolvedValue([]);
      mockPrisma.userProfile.findUnique.mockResolvedValue({ waterGoalMl: 3000 });

      await service.getByDate(USER_ID, DATE);

      expect(mockUnitsService.convertWater).toHaveBeenCalledWith(3000, 'l');
    });

    it('should use default waterGoalMl of 2600 when profile is null', async () => {
      mockPrisma.hydrationEntry.findMany.mockResolvedValue([]);
      mockPrisma.userProfile.findUnique.mockResolvedValue(null);

      await service.getByDate(USER_ID, DATE);

      expect(mockUnitsService.convertWater).toHaveBeenCalledWith(2600, 'l');
    });

    it('should convert to fl_oz when water unit is fl_oz', async () => {
      mockUnitsService.getUserUnits.mockResolvedValue({ energy: 'kcal', water: 'fl_oz', weight: 'kg', height: 'cm' });
      mockUnitsService.convertWater.mockImplementation((ml: number) =>
        Math.round((ml / 1000) * 33.814 * 100) / 100,
      );
      mockPrisma.hydrationEntry.findMany.mockResolvedValue([makeEntry({ amountMl: 1000 })]);

      const result = await service.getByDate(USER_ID, DATE);

      expect(result.unit).toBe('fl_oz');
      expect(result.totalConsumed).toBeCloseTo(33.814, 1);
    });

    it('should query entries filtered by userId and date', async () => {
      mockPrisma.hydrationEntry.findMany.mockResolvedValue([]);

      await service.getByDate(USER_ID, DATE);

      expect(mockPrisma.hydrationEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER_ID, date: DATE },
        }),
      );
    });
  });

  // ─── addEntry ───────────────────────────────────────────────────────────────

  describe('addEntry', () => {
    const dto = { amountMl: 500 };

    it('should throw BadRequestException for invalid date format', async () => {
      await expect(service.addEntry(USER_ID, 'bad-date', dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for partial date', async () => {
      await expect(service.addEntry(USER_ID, '2025/03/15', dto)).rejects.toThrow(BadRequestException);
    });

    it('should NOT call evaluateForHydration when date is invalid', async () => {
      await expect(service.addEntry(USER_ID, 'bad-date', dto)).rejects.toThrow();
      expect(mockAchievementsService.evaluateForHydration).not.toHaveBeenCalled();
    });

    it('should NOT call evaluateForHydration when Prisma create fails', async () => {
      mockPrisma.hydrationEntry.create.mockRejectedValue(new Error('DB error'));

      await expect(service.addEntry(USER_ID, DATE, dto)).rejects.toThrow('DB error');
      expect(mockAchievementsService.evaluateForHydration).not.toHaveBeenCalled();
    });

    it('should call evaluateForHydration with the correct userId after successful creation', async () => {
      mockPrisma.hydrationEntry.create.mockResolvedValue(makeEntry());

      await service.addEntry(USER_ID, DATE, dto);

      expect(mockAchievementsService.evaluateForHydration).toHaveBeenCalledTimes(1);
      expect(mockAchievementsService.evaluateForHydration).toHaveBeenCalledWith(USER_ID);
    });

    it('should call evaluateForHydration AFTER the entry is persisted', async () => {
      const callOrder: string[] = [];
      mockPrisma.hydrationEntry.create.mockImplementation(() => {
        callOrder.push('create');
        return Promise.resolve(makeEntry());
      });
      mockAchievementsService.evaluateForHydration.mockImplementation(() => {
        callOrder.push('evaluate');
        return Promise.resolve();
      });

      await service.addEntry(USER_ID, DATE, dto);

      expect(callOrder).toEqual(['create', 'evaluate']);
    });

    it('should propagate error if evaluateForHydration rejects', async () => {
      mockPrisma.hydrationEntry.create.mockResolvedValue(makeEntry());
      mockAchievementsService.evaluateForHydration.mockRejectedValue(
        new Error('achievements failed'),
      );

      await expect(service.addEntry(USER_ID, DATE, dto)).rejects.toThrow('achievements failed');
    });

    it('should return the created entry directly from Prisma', async () => {
      const created = makeEntry({ id: 'new-entry', amountMl: 750 });
      mockPrisma.hydrationEntry.create.mockResolvedValue(created);

      const result = await service.addEntry(USER_ID, DATE, { amountMl: 750 });

      expect(result).toEqual(created);
    });

    it('should return entry with id, amountMl and loggedAt', async () => {
      const loggedAt = new Date('2025-03-15T10:00:00Z');
      mockPrisma.hydrationEntry.create.mockResolvedValue(
        makeEntry({ id: 'entry-xyz', amountMl: 350, loggedAt }),
      );

      const result = await service.addEntry(USER_ID, DATE, { amountMl: 350 });

      expect(result).toHaveProperty('id', 'entry-xyz');
      expect(result).toHaveProperty('amountMl', 350);
      expect(result).toHaveProperty('loggedAt', loggedAt);
    });

    it('should pass the correct data to Prisma create', async () => {
      mockPrisma.hydrationEntry.create.mockResolvedValue(makeEntry());

      await service.addEntry(USER_ID, DATE, { amountMl: 400 });

      expect(mockPrisma.hydrationEntry.create).toHaveBeenCalledWith({
        data: { userId: USER_ID, date: DATE, amountMl: 400 },
        select: { id: true, amountMl: true, loggedAt: true },
      });
    });

    it('should select only id, amountMl and loggedAt from Prisma', async () => {
      mockPrisma.hydrationEntry.create.mockResolvedValue(makeEntry());

      await service.addEntry(USER_ID, DATE, dto);

      expect(mockPrisma.hydrationEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          select: { id: true, amountMl: true, loggedAt: true },
        }),
      );
    });

    it('should handle large water amounts (2000ml)', async () => {
      mockPrisma.hydrationEntry.create.mockResolvedValue(makeEntry({ amountMl: 2000 }));

      const result = await service.addEntry(USER_ID, DATE, { amountMl: 2000 });

      expect(result.amountMl).toBe(2000);
      expect(mockAchievementsService.evaluateForHydration).toHaveBeenCalledWith(USER_ID);
    });

    it('should handle minimum water amount (1ml)', async () => {
      mockPrisma.hydrationEntry.create.mockResolvedValue(makeEntry({ amountMl: 1 }));

      const result = await service.addEntry(USER_ID, DATE, { amountMl: 1 });

      expect(result.amountMl).toBe(1);
      expect(mockAchievementsService.evaluateForHydration).toHaveBeenCalledWith(USER_ID);
    });

    it('should include newAchievements as empty array when no achievements unlocked', async () => {
      mockPrisma.hydrationEntry.create.mockResolvedValue(makeEntry());
      mockAchievementsService.evaluateForHydration.mockResolvedValue([]);

      const result = await service.addEntry(USER_ID, DATE, { amountMl: 500 });

      expect(result).toHaveProperty('newAchievements');
      expect(result.newAchievements).toEqual([]);
    });

    it('should include newAchievements with unlocked achievements when evaluateForHydration returns them', async () => {
      const unlockedAchievement = {
        key: 'HYDRATION_HERO',
        name: 'Hydration Hero',
        icon: 'H',
        description: 'Met your water goal',
        category: 'hydration',
        earned: true,
        earnedAt: '2025-03-15T09:00:00.000Z',
      };
      mockPrisma.hydrationEntry.create.mockResolvedValue(makeEntry());
      mockAchievementsService.evaluateForHydration.mockResolvedValue([unlockedAchievement]);

      const result = await service.addEntry(USER_ID, DATE, { amountMl: 500 });

      expect(result.newAchievements).toHaveLength(1);
      expect(result.newAchievements[0]).toEqual(unlockedAchievement);
    });

    it('should include multiple newAchievements when several are unlocked at once', async () => {
      const achievements = [
        { key: 'HYDRATION_HERO', name: 'Hydration Hero', icon: 'H', description: 'Met water goal', category: 'hydration', earned: true, earnedAt: '2025-03-15T09:00:00.000Z' },
        { key: 'WATER_WEEK', name: 'Water Week', icon: '💧', description: '7 days water goal', category: 'hydration', earned: true, earnedAt: '2025-03-15T09:00:00.000Z' },
      ];
      mockPrisma.hydrationEntry.create.mockResolvedValue(makeEntry());
      mockAchievementsService.evaluateForHydration.mockResolvedValue(achievements);

      const result = await service.addEntry(USER_ID, DATE, { amountMl: 500 });

      expect(result.newAchievements).toHaveLength(2);
      expect(result.newAchievements.map((a) => a.key)).toEqual(['HYDRATION_HERO', 'WATER_WEEK']);
    });
  });

  // ─── removeEntry ────────────────────────────────────────────────────────────

  describe('removeEntry', () => {
    it('should throw BadRequestException for invalid date format', async () => {
      await expect(
        service.removeEntry(USER_ID, 'bad-date', 'entry-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when entry does not exist', async () => {
      mockPrisma.hydrationEntry.findFirst.mockResolvedValue(null);
      await expect(
        service.removeEntry(USER_ID, DATE, 'bad-entry'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should delete the entry when found', async () => {
      mockPrisma.hydrationEntry.findFirst.mockResolvedValue({ id: 'entry-1' });
      mockPrisma.hydrationEntry.delete.mockResolvedValue({});

      await expect(
        service.removeEntry(USER_ID, DATE, 'entry-1'),
      ).resolves.not.toThrow();

      expect(mockPrisma.hydrationEntry.delete).toHaveBeenCalledWith({ where: { id: 'entry-1' } });
    });

    it('should NOT call evaluateForHydration on removeEntry', async () => {
      mockPrisma.hydrationEntry.findFirst.mockResolvedValue({ id: 'entry-1' });
      mockPrisma.hydrationEntry.delete.mockResolvedValue({});

      await service.removeEntry(USER_ID, DATE, 'entry-1');

      expect(mockAchievementsService.evaluateForHydration).not.toHaveBeenCalled();
    });

    it('should look up entry with userId, date and entryId for scoping', async () => {
      mockPrisma.hydrationEntry.findFirst.mockResolvedValue({ id: 'entry-1' });
      mockPrisma.hydrationEntry.delete.mockResolvedValue({});

      await service.removeEntry(USER_ID, DATE, 'entry-1');

      expect(mockPrisma.hydrationEntry.findFirst).toHaveBeenCalledWith({
        where: { id: 'entry-1', userId: USER_ID, date: DATE },
      });
    });

    it('should NOT delete entry when findFirst returns null', async () => {
      mockPrisma.hydrationEntry.findFirst.mockResolvedValue(null);

      await expect(service.removeEntry(USER_ID, DATE, 'bad-entry')).rejects.toThrow(NotFoundException);

      expect(mockPrisma.hydrationEntry.delete).not.toHaveBeenCalled();
    });
  });
});
