import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DiaryService } from './diary.service';
import { PrismaService } from '../prisma/prisma.service';
import { UnitsService } from '../units/units.service';
import { EntryQuality } from './diary.types';

describe('DiaryService', () => {
  let service: DiaryService;

  const mockPrisma = {
    meal: { findMany: jest.fn(), findFirst: jest.fn() },
    diaryEntry: { findMany: jest.fn(), create: jest.fn(), findFirst: jest.fn(), delete: jest.fn() },
  };

  const mockUnitsService = {
    getUserUnits: jest.fn().mockResolvedValue({ energy: 'kcal', water: 'l', weight: 'kg', height: 'cm' }),
    convertEnergy: jest.fn().mockImplementation((kcal: number) => Math.round(kcal)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiaryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: UnitsService, useValue: mockUnitsService },
      ],
    }).compile();

    service = module.get<DiaryService>(DiaryService);
    jest.clearAllMocks();
    mockUnitsService.getUserUnits.mockResolvedValue({ energy: 'kcal', water: 'l', weight: 'kg', height: 'cm' });
    mockUnitsService.convertEnergy.mockImplementation((kcal: number) => Math.round(kcal));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getByDate', () => {
    it('should throw BadRequestException for invalid date format', async () => {
      await expect(service.getByDate('user-1', 'not-a-date')).rejects.toThrow(BadRequestException);
    });

    it('should return all meals with entries and quality classification', async () => {
      mockPrisma.meal.findMany.mockResolvedValue([
        { id: 'meal-1', name: 'Breakfast', icon: '🌅', sortOrder: 0 },
      ]);
      mockPrisma.diaryEntry.findMany.mockResolvedValue([
        {
          id: 'entry-1',
          mealId: 'meal-1',
          name: 'Greek Yogurt',
          kcal: 150,
          proteinG: 17, // 68 kcal → 45% → good
          carbsG: 8,    // 32 kcal
          fatG: 4,      // 36 kcal → 25%
          portion: '200g',
          loggedAt: new Date('2025-03-15T07:30:00Z'),
          photoUri: null,
        },
      ]);

      const result = await service.getByDate('user-1', '2025-03-15');

      expect(result).toHaveLength(1);
      expect(result[0].mealId).toBe('meal-1');
      expect(result[0].entries).toHaveLength(1);
      expect(result[0].entries[0].quality).toBe(EntryQuality.Good);
    });

    it('should return meals with empty entries when no diary entries exist', async () => {
      mockPrisma.meal.findMany.mockResolvedValue([
        { id: 'meal-1', name: 'Lunch', icon: '☀️', sortOrder: 1 },
      ]);
      mockPrisma.diaryEntry.findMany.mockResolvedValue([]);

      const result = await service.getByDate('user-1', '2025-03-15');

      expect(result[0].entries).toHaveLength(0);
      expect(result[0].totalCalories).toBe(0);
    });
  });

  describe('quality classification', () => {
    const makeEntry = (kcal: number, proteinG: number, carbsG: number, fatG: number) => ({
      id: 'e1',
      mealId: 'meal-1',
      name: 'Test',
      kcal,
      proteinG,
      carbsG,
      fatG,
      portion: '100g',
      loggedAt: new Date(),
      photoUri: null,
    });

    beforeEach(() => {
      mockPrisma.meal.findMany.mockResolvedValue([
        { id: 'meal-1', name: 'Breakfast', icon: '🌅', sortOrder: 0 },
      ]);
    });

    it('should return null for zero-calorie entry', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue([makeEntry(0, 0, 0, 0)]);
      const result = await service.getByDate('user-1', '2025-03-15');
      expect(result[0].entries[0].quality).toBeNull();
    });

    it('should return good for well-balanced entry (protein≥25%, fat≤35%)', async () => {
      // protein 30g=120kcal(44%), carbs 30g=120kcal(44%), fat 3g=27kcal(10%)
      mockPrisma.diaryEntry.findMany.mockResolvedValue([makeEntry(267, 30, 30, 3)]);
      const result = await service.getByDate('user-1', '2025-03-15');
      expect(result[0].entries[0].quality).toBe(EntryQuality.Good);
    });

    it('should return poor when protein < 15%', async () => {
      // protein 3g=12kcal(7%), carbs 50g=200kcal, fat 10g=90kcal
      mockPrisma.diaryEntry.findMany.mockResolvedValue([makeEntry(302, 3, 50, 10)]);
      const result = await service.getByDate('user-1', '2025-03-15');
      expect(result[0].entries[0].quality).toBe(EntryQuality.Poor);
    });

    it('should return poor when fat > 45%', async () => {
      // protein 5g=20kcal, carbs 5g=20kcal, fat 20g=180kcal(82%)
      mockPrisma.diaryEntry.findMany.mockResolvedValue([makeEntry(220, 5, 5, 20)]);
      const result = await service.getByDate('user-1', '2025-03-15');
      expect(result[0].entries[0].quality).toBe(EntryQuality.Poor);
    });

    it('should return fair for mid-range entry', async () => {
      // protein 18g=72kcal(20%), carbs 40g=160kcal, fat 10g=90kcal(28%)
      mockPrisma.diaryEntry.findMany.mockResolvedValue([makeEntry(322, 18, 40, 10)]);
      const result = await service.getByDate('user-1', '2025-03-15');
      expect(result[0].entries[0].quality).toBe(EntryQuality.Fair);
    });
  });

  describe('addEntry', () => {
    it('should throw BadRequestException for invalid date format', async () => {
      await expect(
        service.addEntry('user-1', 'bad-date', 'meal-1', {
          name: 'Oatmeal', kcal: 240, proteinG: 8, carbsG: 44, fatG: 5, portion: '80g',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if mealId does not belong to user', async () => {
      mockPrisma.meal.findFirst.mockResolvedValue(null);
      await expect(
        service.addEntry('user-1', '2025-03-15', 'bad-meal', {
          name: 'Oatmeal', kcal: 240, proteinG: 8, carbsG: 44, fatG: 5, portion: '80g',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create entry and return it with quality', async () => {
      mockPrisma.meal.findFirst.mockResolvedValue({ id: 'meal-1' });
      const loggedAt = new Date();
      mockPrisma.diaryEntry.create.mockResolvedValue({
        id: 'entry-new',
        name: 'Oatmeal',
        kcal: 240,
        proteinG: 8,
        carbsG: 44,
        fatG: 5,
        portion: '80g dry',
        loggedAt,
        photoUri: null,
      });

      const result = await service.addEntry('user-1', '2025-03-15', 'meal-1', {
        name: 'Oatmeal', kcal: 240, proteinG: 8, carbsG: 44, fatG: 5, portion: '80g dry',
      });

      expect(result.id).toBe('entry-new');
      expect(result).toHaveProperty('quality');
    });
  });

  describe('removeEntry', () => {
    it('should throw NotFoundException if entry not found', async () => {
      mockPrisma.diaryEntry.findFirst.mockResolvedValue(null);
      await expect(
        service.removeEntry('user-1', '2025-03-15', 'meal-1', 'bad-entry'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should delete entry when found', async () => {
      mockPrisma.diaryEntry.findFirst.mockResolvedValue({ id: 'entry-1' });
      mockPrisma.diaryEntry.delete.mockResolvedValue({});

      await expect(
        service.removeEntry('user-1', '2025-03-15', 'meal-1', 'entry-1'),
      ).resolves.not.toThrow();

      expect(mockPrisma.diaryEntry.delete).toHaveBeenCalledWith({ where: { id: 'entry-1' } });
    });
  });
});
