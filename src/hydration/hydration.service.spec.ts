import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { HydrationService } from './hydration.service';
import { PrismaService } from '../prisma/prisma.service';
import { UnitsService } from '../units/units.service';
import { AchievementsService } from '../achievements/achievements.service';

describe('HydrationService', () => {
  let service: HydrationService;

  const mockPrisma = {
    hydrationEntry: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    userProfile: { findUnique: jest.fn() },
  };

  const mockUnitsService = {
    getUserUnits: jest.fn().mockResolvedValue({ energy: 'kcal', water: 'l', weight: 'kg', height: 'cm' }),
    convertWater: jest.fn().mockImplementation((ml: number) => Math.round((ml / 1000) * 100) / 100),
  };

  const mockAchievementsService = {
    evaluateForHydration: jest.fn().mockResolvedValue([]),
  };

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
    mockUnitsService.getUserUnits.mockResolvedValue({ energy: 'kcal', water: 'l', weight: 'kg', height: 'cm' });
    mockUnitsService.convertWater.mockImplementation((ml: number) => Math.round((ml / 1000) * 100) / 100);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── getByDate ──────────────────────────────────────────────────

  describe('getByDate', () => {
    it('should throw BadRequestException for invalid date format', async () => {
      await expect(service.getByDate('user-1', 'not-a-date')).rejects.toThrow(BadRequestException);
      await expect(service.getByDate('user-1', '2025/03/15')).rejects.toThrow(BadRequestException);
    });

    it('should return entries with totalConsumed and goal in litres', async () => {
      mockPrisma.hydrationEntry.findMany.mockResolvedValue([
        { id: 'h1', amountMl: 500, loggedAt: new Date() },
        { id: 'h2', amountMl: 300, loggedAt: new Date() },
      ]);
      mockPrisma.userProfile.findUnique.mockResolvedValue({ waterGoalMl: 2000 });

      const result = await service.getByDate('user-1', '2026-03-15');

      expect(result.entries).toHaveLength(2);
      expect(result.totalConsumed).toBe(0.8);
      expect(result.goal).toBe(2);
      expect(result.unit).toBe('l');
    });

    it('should use default goal (2600ml) when profile does not exist', async () => {
      mockPrisma.hydrationEntry.findMany.mockResolvedValue([]);
      mockPrisma.userProfile.findUnique.mockResolvedValue(null);

      const result = await service.getByDate('user-1', '2026-03-15');

      expect(mockUnitsService.convertWater).toHaveBeenCalledWith(2600, 'l');
    });

    it('should return totalConsumed as 0 when no entries', async () => {
      mockPrisma.hydrationEntry.findMany.mockResolvedValue([]);
      mockPrisma.userProfile.findUnique.mockResolvedValue({ waterGoalMl: 2600 });

      const result = await service.getByDate('user-1', '2026-03-15');

      expect(result.totalConsumed).toBe(0);
      expect(result.entries).toHaveLength(0);
    });

    it('should convert water to fl_oz when unit preference is fl_oz', async () => {
      mockUnitsService.getUserUnits.mockResolvedValue({ energy: 'kcal', water: 'fl_oz', weight: 'kg', height: 'cm' });
      mockUnitsService.convertWater.mockImplementation((ml: number) =>
        Math.round((ml / 1000) * 33.814 * 100) / 100,
      );
      mockPrisma.hydrationEntry.findMany.mockResolvedValue([{ id: 'h1', amountMl: 1000, loggedAt: new Date() }]);
      mockPrisma.userProfile.findUnique.mockResolvedValue({ waterGoalMl: 2000 });

      const result = await service.getByDate('user-1', '2026-03-15');

      expect(result.unit).toBe('fl_oz');
      expect(result.totalConsumed).toBeCloseTo(33.81, 1);
    });
  });

  // ── addEntry ───────────────────────────────────────────────────

  describe('addEntry', () => {
    it('should throw BadRequestException for invalid date format', async () => {
      await expect(service.addEntry('user-1', 'bad-date', { amountMl: 250 })).rejects.toThrow(BadRequestException);
    });

    it('should create and return the entry', async () => {
      const created = { id: 'h-new', amountMl: 350, loggedAt: new Date() };
      mockPrisma.hydrationEntry.create.mockResolvedValue(created);

      const result = await service.addEntry('user-1', '2026-03-15', { amountMl: 350 });

      expect(result).toEqual({ ...created, newAchievements: [] });
      expect(mockPrisma.hydrationEntry.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', date: '2026-03-15', amountMl: 350 },
        select: { id: true, amountMl: true, loggedAt: true },
      });
    });
  });

  // ── removeEntry ────────────────────────────────────────────────

  describe('removeEntry', () => {
    it('should throw BadRequestException for invalid date format', async () => {
      await expect(service.removeEntry('user-1', 'bad-date', 'entry-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when entry does not exist', async () => {
      mockPrisma.hydrationEntry.findFirst.mockResolvedValue(null);
      await expect(service.removeEntry('user-1', '2026-03-15', 'ghost-id')).rejects.toThrow(NotFoundException);
    });

    it('should delete entry when found', async () => {
      mockPrisma.hydrationEntry.findFirst.mockResolvedValue({ id: 'h1' });
      mockPrisma.hydrationEntry.delete.mockResolvedValue({});

      await expect(service.removeEntry('user-1', '2026-03-15', 'h1')).resolves.not.toThrow();
      expect(mockPrisma.hydrationEntry.delete).toHaveBeenCalledWith({ where: { id: 'h1' } });
    });

    it('should only match entry belonging to the correct user and date', async () => {
      mockPrisma.hydrationEntry.findFirst.mockResolvedValue({ id: 'h1' });
      mockPrisma.hydrationEntry.delete.mockResolvedValue({});

      await service.removeEntry('user-1', '2026-03-15', 'h1');

      expect(mockPrisma.hydrationEntry.findFirst).toHaveBeenCalledWith({
        where: { id: 'h1', userId: 'user-1', date: '2026-03-15' },
      });
    });
  });
});
