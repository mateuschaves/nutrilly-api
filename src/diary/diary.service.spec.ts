import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DiaryService } from './diary.service';
import { PrismaService } from '../prisma/prisma.service';
import { UnitsService } from '../units/units.service';
import { AchievementsService } from '../achievements/achievements.service';
import { TournamentScoringService } from '../tournaments/scoring/scoring.service';
import { EntryQuality } from './diary.types';

const USER_ID = 'user-1';
const DATE = '2025-03-15';
const MEAL_ID = 'meal-1';

describe('DiaryService', () => {
  let service: DiaryService;

  const mockPrisma = {
    meal: { findMany: jest.fn(), findFirst: jest.fn() },
    diaryEntry: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockUnitsService = {
    getUserUnits: jest.fn(),
    convertEnergy: jest.fn().mockImplementation((kcal: number) => Math.round(kcal)),
  };

  const mockAchievementsService = {
    evaluateForDiary: jest.fn(),
  };

  const mockScoringService = {
    processMealScoringEvent: jest.fn().mockResolvedValue(undefined),
  };

  // A minimal diary entry returned by Prisma after create
  const makeCreatedEntry = (overrides = {}) => ({
    id: 'entry-new',
    name: 'Oatmeal',
    kcal: 240,
    proteinG: 8,
    carbsG: 44,
    fatG: 5,
    portion: '80g',
    loggedAt: new Date('2025-03-15T07:30:00Z'),
    photoUri: null,
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiaryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: UnitsService, useValue: mockUnitsService },
        { provide: AchievementsService, useValue: mockAchievementsService },
        { provide: TournamentScoringService, useValue: mockScoringService },
      ],
    }).compile();

    service = module.get<DiaryService>(DiaryService);
    jest.clearAllMocks();

    // Safe defaults
    mockUnitsService.getUserUnits.mockResolvedValue({ energy: 'kcal', water: 'l', weight: 'kg', height: 'cm' });
    mockUnitsService.convertEnergy.mockImplementation((kcal: number) => Math.round(kcal));
    mockAchievementsService.evaluateForDiary.mockResolvedValue([]);
    mockScoringService.processMealScoringEvent.mockResolvedValue(undefined);
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

    it('should NOT call evaluateForDiary on read operations', async () => {
      mockPrisma.meal.findMany.mockResolvedValue([]);
      mockPrisma.diaryEntry.findMany.mockResolvedValue([]);

      await service.getByDate(USER_ID, DATE);

      expect(mockAchievementsService.evaluateForDiary).not.toHaveBeenCalled();
    });

    it('should return all meals grouped with their entries', async () => {
      mockPrisma.meal.findMany.mockResolvedValue([
        { id: MEAL_ID, name: 'Breakfast', icon: '🌅', sortOrder: 0 },
      ]);
      mockPrisma.diaryEntry.findMany.mockResolvedValue([
        {
          id: 'e1',
          mealId: MEAL_ID,
          name: 'Greek Yogurt',
          kcal: 150,
          proteinG: 17,
          carbsG: 8,
          fatG: 4,
          portion: '200g',
          loggedAt: new Date('2025-03-15T07:30:00Z'),
          photoUri: null,
        },
      ]);

      const result = await service.getByDate(USER_ID, DATE);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        mealId: MEAL_ID,
        mealName: 'Breakfast',
        mealIcon: '🌅',
        sortOrder: 0,
        energyUnit: 'kcal',
      });
      expect(result[0].entries).toHaveLength(1);
    });

    it('should return entries with all required fields', async () => {
      mockPrisma.meal.findMany.mockResolvedValue([
        { id: MEAL_ID, name: 'Lunch', icon: '☀️', sortOrder: 1 },
      ]);
      mockPrisma.diaryEntry.findMany.mockResolvedValue([
        {
          id: 'e1',
          mealId: MEAL_ID,
          name: 'Salad',
          kcal: 300,
          proteinG: 20,
          carbsG: 30,
          fatG: 8,
          portion: '350g',
          loggedAt: new Date('2025-03-15T12:00:00Z'),
          photoUri: 'https://cdn.example.com/photo.jpg',
        },
      ]);

      const result = await service.getByDate(USER_ID, DATE);
      const entry = result[0].entries[0];

      expect(entry).toHaveProperty('id', 'e1');
      expect(entry).toHaveProperty('name', 'Salad');
      expect(entry).toHaveProperty('calories');
      expect(entry).toHaveProperty('energyUnit', 'kcal');
      expect(entry).toHaveProperty('protein', 20);
      expect(entry).toHaveProperty('carbs', 30);
      expect(entry).toHaveProperty('fat', 8);
      expect(entry).toHaveProperty('portion', '350g');
      expect(entry).toHaveProperty('time');
      expect(entry).toHaveProperty('photoUri', 'https://cdn.example.com/photo.jpg');
      expect(entry).toHaveProperty('quality');
    });

    it('should return meals with empty entries when no diary entries exist', async () => {
      mockPrisma.meal.findMany.mockResolvedValue([
        { id: MEAL_ID, name: 'Dinner', icon: '🌙', sortOrder: 2 },
      ]);
      mockPrisma.diaryEntry.findMany.mockResolvedValue([]);

      const result = await service.getByDate(USER_ID, DATE);

      expect(result[0].entries).toHaveLength(0);
      expect(result[0].totalCalories).toBe(0);
    });

    it('should return empty array when user has no meals', async () => {
      mockPrisma.meal.findMany.mockResolvedValue([]);
      mockPrisma.diaryEntry.findMany.mockResolvedValue([]);

      const result = await service.getByDate(USER_ID, DATE);

      expect(result).toHaveLength(0);
    });

    it('should only include entries matching each meal', async () => {
      mockPrisma.meal.findMany.mockResolvedValue([
        { id: 'meal-breakfast', name: 'Breakfast', icon: '🌅', sortOrder: 0 },
        { id: 'meal-lunch', name: 'Lunch', icon: '☀️', sortOrder: 1 },
      ]);
      mockPrisma.diaryEntry.findMany.mockResolvedValue([
        { id: 'e1', mealId: 'meal-breakfast', name: 'Egg', kcal: 90, proteinG: 7, carbsG: 0, fatG: 6, portion: '1 unit', loggedAt: new Date(), photoUri: null },
        { id: 'e2', mealId: 'meal-lunch', name: 'Salad', kcal: 200, proteinG: 10, carbsG: 20, fatG: 5, portion: '300g', loggedAt: new Date(), photoUri: null },
      ]);

      const result = await service.getByDate(USER_ID, DATE);

      expect(result[0].entries).toHaveLength(1);
      expect(result[0].entries[0].name).toBe('Egg');
      expect(result[1].entries).toHaveLength(1);
      expect(result[1].entries[0].name).toBe('Salad');
    });

    it('should sum totalCalories correctly for a meal with multiple entries', async () => {
      mockPrisma.meal.findMany.mockResolvedValue([
        { id: MEAL_ID, name: 'Dinner', icon: '🌙', sortOrder: 0 },
      ]);
      mockPrisma.diaryEntry.findMany.mockResolvedValue([
        { id: 'e1', mealId: MEAL_ID, name: 'Rice', kcal: 200, proteinG: 4, carbsG: 45, fatG: 1, portion: '150g', loggedAt: new Date(), photoUri: null },
        { id: 'e2', mealId: MEAL_ID, name: 'Chicken', kcal: 300, proteinG: 35, carbsG: 0, fatG: 8, portion: '150g', loggedAt: new Date(), photoUri: null },
      ]);

      const result = await service.getByDate(USER_ID, DATE);

      expect(result[0].totalCalories).toBe(500);
    });

    it('should use kJ label when energy unit is kj', async () => {
      mockUnitsService.getUserUnits.mockResolvedValue({ energy: 'kj', water: 'l', weight: 'kg', height: 'cm' });
      mockUnitsService.convertEnergy.mockImplementation((kcal: number) => Math.round(kcal * 4.184));
      mockPrisma.meal.findMany.mockResolvedValue([{ id: MEAL_ID, name: 'Lunch', icon: '☀️', sortOrder: 0 }]);
      mockPrisma.diaryEntry.findMany.mockResolvedValue([]);

      const result = await service.getByDate(USER_ID, DATE);

      expect(result[0].energyUnit).toBe('kJ');
    });
  });

  // ─── quality classification ──────────────────────────────────────────────────

  describe('quality classification', () => {
    const makeEntry = (kcal: number, proteinG: number, carbsG: number, fatG: number) => ({
      id: 'e1',
      mealId: MEAL_ID,
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
        { id: MEAL_ID, name: 'Breakfast', icon: '🌅', sortOrder: 0 },
      ]);
    });

    it('should return null for a zero-calorie entry', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue([makeEntry(0, 0, 0, 0)]);
      const result = await service.getByDate(USER_ID, DATE);
      expect(result[0].entries[0].quality).toBeNull();
    });

    it('should return null when macroCalories are zero (all macros are zero)', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue([makeEntry(100, 0, 0, 0)]);
      const result = await service.getByDate(USER_ID, DATE);
      expect(result[0].entries[0].quality).toBeNull();
    });

    it('should return GOOD when protein ≥ 25% AND fat ≤ 35%', async () => {
      // protein 30g=120kcal(44%), fat 3g=27kcal(10%)
      mockPrisma.diaryEntry.findMany.mockResolvedValue([makeEntry(267, 30, 30, 3)]);
      const result = await service.getByDate(USER_ID, DATE);
      expect(result[0].entries[0].quality).toBe(EntryQuality.Good);
    });

    it('should return POOR when protein < 15%', async () => {
      // protein 3g=12kcal(~4%), fat 10g=90kcal
      mockPrisma.diaryEntry.findMany.mockResolvedValue([makeEntry(302, 3, 50, 10)]);
      const result = await service.getByDate(USER_ID, DATE);
      expect(result[0].entries[0].quality).toBe(EntryQuality.Poor);
    });

    it('should return POOR when fat > 45%', async () => {
      // fat 20g=180kcal(~82%)
      mockPrisma.diaryEntry.findMany.mockResolvedValue([makeEntry(220, 5, 5, 20)]);
      const result = await service.getByDate(USER_ID, DATE);
      expect(result[0].entries[0].quality).toBe(EntryQuality.Poor);
    });

    it('should return FAIR for mid-range macros', async () => {
      // protein 18g=72kcal(~22%), fat 10g=90kcal(~28%)
      mockPrisma.diaryEntry.findMany.mockResolvedValue([makeEntry(322, 18, 40, 10)]);
      const result = await service.getByDate(USER_ID, DATE);
      expect(result[0].entries[0].quality).toBe(EntryQuality.Fair);
    });
  });

  // ─── addEntry ───────────────────────────────────────────────────────────────

  describe('addEntry', () => {
    const dto = { name: 'Oatmeal', kcal: 240, proteinG: 8, carbsG: 44, fatG: 5, portion: '80g' };

    it('should throw BadRequestException for invalid date format', async () => {
      await expect(
        service.addEntry(USER_ID, 'bad-date', MEAL_ID, dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should NOT call evaluateForDiary when date is invalid', async () => {
      await expect(service.addEntry(USER_ID, 'bad-date', MEAL_ID, dto)).rejects.toThrow();
      expect(mockAchievementsService.evaluateForDiary).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when mealId does not belong to user', async () => {
      mockPrisma.meal.findFirst.mockResolvedValue(null);
      await expect(
        service.addEntry(USER_ID, DATE, 'bad-meal', dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should NOT call evaluateForDiary when meal is not found', async () => {
      mockPrisma.meal.findFirst.mockResolvedValue(null);
      await expect(service.addEntry(USER_ID, DATE, 'bad-meal', dto)).rejects.toThrow();
      expect(mockAchievementsService.evaluateForDiary).not.toHaveBeenCalled();
    });

    it('should NOT call evaluateForDiary when Prisma create fails', async () => {
      mockPrisma.meal.findFirst.mockResolvedValue({ id: MEAL_ID });
      mockPrisma.diaryEntry.create.mockRejectedValue(new Error('DB error'));

      await expect(service.addEntry(USER_ID, DATE, MEAL_ID, dto)).rejects.toThrow('DB error');
      expect(mockAchievementsService.evaluateForDiary).not.toHaveBeenCalled();
    });

    it('should call evaluateForDiary with the correct userId after successful creation', async () => {
      mockPrisma.meal.findFirst.mockResolvedValue({ id: MEAL_ID });
      mockPrisma.diaryEntry.create.mockResolvedValue(makeCreatedEntry());

      await service.addEntry(USER_ID, DATE, MEAL_ID, dto);

      expect(mockAchievementsService.evaluateForDiary).toHaveBeenCalledTimes(1);
      expect(mockAchievementsService.evaluateForDiary).toHaveBeenCalledWith(USER_ID);
    });

    it('should call evaluateForDiary AFTER the entry is persisted', async () => {
      const callOrder: string[] = [];
      mockPrisma.meal.findFirst.mockResolvedValue({ id: MEAL_ID });
      mockPrisma.diaryEntry.create.mockImplementation(() => {
        callOrder.push('create');
        return Promise.resolve(makeCreatedEntry());
      });
      mockAchievementsService.evaluateForDiary.mockImplementation(() => {
        callOrder.push('evaluate');
        return Promise.resolve();
      });

      await service.addEntry(USER_ID, DATE, MEAL_ID, dto);

      expect(callOrder).toEqual(['create', 'evaluate']);
    });

    it('should propagate error if evaluateForDiary rejects', async () => {
      mockPrisma.meal.findFirst.mockResolvedValue({ id: MEAL_ID });
      mockPrisma.diaryEntry.create.mockResolvedValue(makeCreatedEntry());
      mockAchievementsService.evaluateForDiary.mockRejectedValue(new Error('achievements failed'));

      await expect(service.addEntry(USER_ID, DATE, MEAL_ID, dto)).rejects.toThrow('achievements failed');
    });

    it('should return complete entry shape after creation', async () => {
      mockPrisma.meal.findFirst.mockResolvedValue({ id: MEAL_ID });
      mockPrisma.diaryEntry.create.mockResolvedValue(makeCreatedEntry());

      const result = await service.addEntry(USER_ID, DATE, MEAL_ID, dto);

      expect(result).toHaveProperty('id', 'entry-new');
      expect(result).toHaveProperty('name', 'Oatmeal');
      expect(result).toHaveProperty('calories');
      expect(result).toHaveProperty('energyUnit', 'kcal');
      expect(result).toHaveProperty('protein', 8);
      expect(result).toHaveProperty('carbs', 44);
      expect(result).toHaveProperty('fat', 5);
      expect(result).toHaveProperty('portion', '80g');
      expect(result).toHaveProperty('time');
      expect(result).toHaveProperty('photoUri', null);
      expect(result).toHaveProperty('quality');
    });

    it('should include quality classification in returned entry', async () => {
      mockPrisma.meal.findFirst.mockResolvedValue({ id: MEAL_ID });
      // Good quality: high protein, low fat
      mockPrisma.diaryEntry.create.mockResolvedValue(
        makeCreatedEntry({ kcal: 267, proteinG: 30, carbsG: 30, fatG: 3 }),
      );

      const result = await service.addEntry(USER_ID, DATE, MEAL_ID, dto);

      expect(result.quality).toBe(EntryQuality.Good);
    });

    it('should return quality null for a zero-calorie entry', async () => {
      mockPrisma.meal.findFirst.mockResolvedValue({ id: MEAL_ID });
      mockPrisma.diaryEntry.create.mockResolvedValue(
        makeCreatedEntry({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }),
      );

      const result = await service.addEntry(USER_ID, DATE, MEAL_ID, { ...dto, kcal: 0 });

      expect(result.quality).toBeNull();
    });

    it('should include photoUri when provided', async () => {
      mockPrisma.meal.findFirst.mockResolvedValue({ id: MEAL_ID });
      mockPrisma.diaryEntry.create.mockResolvedValue(
        makeCreatedEntry({ photoUri: 'https://cdn.example.com/photo.jpg' }),
      );

      const result = await service.addEntry(USER_ID, DATE, MEAL_ID, {
        ...dto,
        photoUri: 'https://cdn.example.com/photo.jpg',
      });

      expect(result.photoUri).toBe('https://cdn.example.com/photo.jpg');
    });

    it('should return photoUri as null when not provided', async () => {
      mockPrisma.meal.findFirst.mockResolvedValue({ id: MEAL_ID });
      mockPrisma.diaryEntry.create.mockResolvedValue(makeCreatedEntry({ photoUri: null }));

      const result = await service.addEntry(USER_ID, DATE, MEAL_ID, dto);

      expect(result.photoUri).toBeNull();
    });

    it('should convert calories to kJ when energy unit is kj', async () => {
      mockUnitsService.getUserUnits.mockResolvedValue({ energy: 'kj', water: 'l', weight: 'kg', height: 'cm' });
      mockUnitsService.convertEnergy.mockImplementation((kcal: number) => Math.round(kcal * 4.184));
      mockPrisma.meal.findFirst.mockResolvedValue({ id: MEAL_ID });
      mockPrisma.diaryEntry.create.mockResolvedValue(makeCreatedEntry({ kcal: 240 }));

      const result = await service.addEntry(USER_ID, DATE, MEAL_ID, dto);

      expect(result.calories).toBe(Math.round(240 * 4.184));
      expect(result.energyUnit).toBe('kJ');
    });

    it('should format time as AM/PM string', async () => {
      mockPrisma.meal.findFirst.mockResolvedValue({ id: MEAL_ID });
      mockPrisma.diaryEntry.create.mockResolvedValue(
        makeCreatedEntry({ loggedAt: new Date('2025-03-15T07:30:00') }),
      );

      const result = await service.addEntry(USER_ID, DATE, MEAL_ID, dto);

      expect(result.time).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
    });

    it('should pass the correct data to Prisma create', async () => {
      mockPrisma.meal.findFirst.mockResolvedValue({ id: MEAL_ID });
      mockPrisma.diaryEntry.create.mockResolvedValue(makeCreatedEntry());

      await service.addEntry(USER_ID, DATE, MEAL_ID, {
        name: 'Banana',
        kcal: 89,
        proteinG: 1.1,
        carbsG: 23,
        fatG: 0.3,
        portion: '1 unit',
        photoUri: 'https://photo.com/banana.jpg',
      });

      expect(mockPrisma.diaryEntry.create).toHaveBeenCalledWith({
        data: {
          userId: USER_ID,
          mealId: MEAL_ID,
          date: DATE,
          name: 'Banana',
          kcal: 89,
          proteinG: 1.1,
          carbsG: 23,
          fatG: 0.3,
          portion: '1 unit',
          photoUri: 'https://photo.com/banana.jpg',
        },
      });
    });

    it('should pass photoUri as null to Prisma when not provided in dto', async () => {
      mockPrisma.meal.findFirst.mockResolvedValue({ id: MEAL_ID });
      mockPrisma.diaryEntry.create.mockResolvedValue(makeCreatedEntry());

      await service.addEntry(USER_ID, DATE, MEAL_ID, dto);

      expect(mockPrisma.diaryEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ photoUri: null }),
        }),
      );
    });

    it('should include newAchievements as empty array when no achievements unlocked', async () => {
      mockPrisma.meal.findFirst.mockResolvedValue({ id: MEAL_ID });
      mockPrisma.diaryEntry.create.mockResolvedValue(makeCreatedEntry());
      mockAchievementsService.evaluateForDiary.mockResolvedValue([]);

      const result = await service.addEntry(USER_ID, DATE, MEAL_ID, dto);

      expect(result).toHaveProperty('newAchievements');
      expect(result.newAchievements).toEqual([]);
    });

    it('should include newAchievements with unlocked achievements when evaluateForDiary returns them', async () => {
      const unlockedAchievement = {
        key: 'FIRST_LOG',
        name: 'First Step',
        icon: '🌱',
        description: 'Logged your first meal',
        category: 'consistency',
        earned: true,
        earnedAt: '2025-03-15T07:30:00.000Z',
      };
      mockPrisma.meal.findFirst.mockResolvedValue({ id: MEAL_ID });
      mockPrisma.diaryEntry.create.mockResolvedValue(makeCreatedEntry());
      mockAchievementsService.evaluateForDiary.mockResolvedValue([unlockedAchievement]);

      const result = await service.addEntry(USER_ID, DATE, MEAL_ID, dto);

      expect(result.newAchievements).toHaveLength(1);
      expect(result.newAchievements[0]).toEqual(unlockedAchievement);
    });

    it('should include multiple newAchievements when several are unlocked at once', async () => {
      const achievements = [
        { key: 'FIRST_LOG', name: 'First Step', icon: '🌱', description: 'Logged first meal', category: 'consistency', earned: true, earnedAt: '2025-03-15T07:30:00.000Z' },
        { key: 'EARLY_BIRD', name: 'Early Bird', icon: 'E', description: 'Logged before 8am', category: 'behavior', earned: true, earnedAt: '2025-03-15T07:30:00.000Z' },
      ];
      mockPrisma.meal.findFirst.mockResolvedValue({ id: MEAL_ID });
      mockPrisma.diaryEntry.create.mockResolvedValue(makeCreatedEntry());
      mockAchievementsService.evaluateForDiary.mockResolvedValue(achievements);

      const result = await service.addEntry(USER_ID, DATE, MEAL_ID, dto);

      expect(result.newAchievements).toHaveLength(2);
      expect(result.newAchievements.map((a) => a.key)).toEqual(['FIRST_LOG', 'EARLY_BIRD']);
    });

    it('should NOT call processMealScoringEvent when tournamentIds is empty', async () => {
      mockPrisma.meal.findFirst.mockResolvedValue({ id: MEAL_ID });
      mockPrisma.diaryEntry.create.mockResolvedValue(makeCreatedEntry());

      await service.addEntry(USER_ID, DATE, MEAL_ID, { ...dto, tournamentIds: [] });

      expect(mockScoringService.processMealScoringEvent).not.toHaveBeenCalled();
    });

    it('should NOT call processMealScoringEvent when tournamentIds is omitted', async () => {
      mockPrisma.meal.findFirst.mockResolvedValue({ id: MEAL_ID });
      mockPrisma.diaryEntry.create.mockResolvedValue(makeCreatedEntry());

      await service.addEntry(USER_ID, DATE, MEAL_ID, dto);

      expect(mockScoringService.processMealScoringEvent).not.toHaveBeenCalled();
    });

    it('should call processMealScoringEvent with MEAL_LOGGED when tournamentIds provided', async () => {
      mockPrisma.meal.findFirst.mockResolvedValue({ id: MEAL_ID });
      mockPrisma.diaryEntry.create.mockResolvedValue(makeCreatedEntry({ kcal: 240, proteinG: 8, carbsG: 44, fatG: 5 }));

      await service.addEntry(USER_ID, DATE, MEAL_ID, { ...dto, tournamentIds: ['t-1'] });

      expect(mockScoringService.processMealScoringEvent).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({ type: 'MEAL_LOGGED' }),
        ['t-1'],
      );
    });

    it('should call processMealScoringEvent with HEALTHY_MEAL for a balanced meal < 600kcal', async () => {
      // protein 30g=120kcal(44%), fat 3g=27kcal(10%), carbs 30g — qualifies as healthy
      mockPrisma.meal.findFirst.mockResolvedValue({ id: MEAL_ID });
      mockPrisma.diaryEntry.create.mockResolvedValue(makeCreatedEntry({ kcal: 267, proteinG: 30, carbsG: 30, fatG: 3 }));

      await service.addEntry(USER_ID, DATE, MEAL_ID, { ...dto, tournamentIds: ['t-1'] });

      const calls = mockScoringService.processMealScoringEvent.mock.calls.map((c: any[]) => c[1].type);
      expect(calls).toContain('MEAL_LOGGED');
      expect(calls).toContain('HEALTHY_MEAL');
    });

    it('should call processMealScoringEvent with UNHEALTHY_MEAL for a meal > 800kcal', async () => {
      mockPrisma.meal.findFirst.mockResolvedValue({ id: MEAL_ID });
      mockPrisma.diaryEntry.create.mockResolvedValue(makeCreatedEntry({ kcal: 900, proteinG: 10, carbsG: 80, fatG: 30 }));

      await service.addEntry(USER_ID, DATE, MEAL_ID, { ...dto, tournamentIds: ['t-1'] });

      const calls = mockScoringService.processMealScoringEvent.mock.calls.map((c: any[]) => c[1].type);
      expect(calls).toContain('MEAL_LOGGED');
      expect(calls).toContain('UNHEALTHY_MEAL');
    });

    it('should NOT call HEALTHY_MEAL and UNHEALTHY_MEAL for a mid-range meal', async () => {
      // 500kcal, poor macros → not healthy, not > 800kcal
      mockPrisma.meal.findFirst.mockResolvedValue({ id: MEAL_ID });
      mockPrisma.diaryEntry.create.mockResolvedValue(makeCreatedEntry({ kcal: 500, proteinG: 10, carbsG: 60, fatG: 15 }));

      await service.addEntry(USER_ID, DATE, MEAL_ID, { ...dto, tournamentIds: ['t-1'] });

      const calls = mockScoringService.processMealScoringEvent.mock.calls.map((c: any[]) => c[1].type);
      expect(calls).toContain('MEAL_LOGGED');
      expect(calls).not.toContain('HEALTHY_MEAL');
      expect(calls).not.toContain('UNHEALTHY_MEAL');
    });
  });

  // ─── removeEntry ────────────────────────────────────────────────────────────

  describe('removeEntry', () => {
    it('should throw BadRequestException for invalid date format', async () => {
      await expect(
        service.removeEntry(USER_ID, 'bad-date', MEAL_ID, 'entry-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when entry does not exist', async () => {
      mockPrisma.diaryEntry.findFirst.mockResolvedValue(null);
      await expect(
        service.removeEntry(USER_ID, DATE, MEAL_ID, 'bad-entry'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should delete the entry when found', async () => {
      mockPrisma.diaryEntry.findFirst.mockResolvedValue({ id: 'entry-1' });
      mockPrisma.diaryEntry.delete.mockResolvedValue({});

      await expect(
        service.removeEntry(USER_ID, DATE, MEAL_ID, 'entry-1'),
      ).resolves.not.toThrow();

      expect(mockPrisma.diaryEntry.delete).toHaveBeenCalledWith({ where: { id: 'entry-1' } });
    });

    it('should NOT call evaluateForDiary on removeEntry', async () => {
      mockPrisma.diaryEntry.findFirst.mockResolvedValue({ id: 'entry-1' });
      mockPrisma.diaryEntry.delete.mockResolvedValue({});

      await service.removeEntry(USER_ID, DATE, MEAL_ID, 'entry-1');

      expect(mockAchievementsService.evaluateForDiary).not.toHaveBeenCalled();
    });

    it('should look up entry with all four scoping fields', async () => {
      mockPrisma.diaryEntry.findFirst.mockResolvedValue({ id: 'entry-1' });
      mockPrisma.diaryEntry.delete.mockResolvedValue({});

      await service.removeEntry(USER_ID, DATE, MEAL_ID, 'entry-1');

      expect(mockPrisma.diaryEntry.findFirst).toHaveBeenCalledWith({
        where: { id: 'entry-1', userId: USER_ID, mealId: MEAL_ID, date: DATE },
      });
    });
  });
});
