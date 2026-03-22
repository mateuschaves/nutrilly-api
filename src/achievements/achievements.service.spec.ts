import { Test, TestingModule } from '@nestjs/testing';
import { AchievementsService } from './achievements.service';
import { PrismaService } from '../prisma/prisma.service';
import { ACHIEVEMENTS } from './achievements.constants';

const USER_ID = 'user-test-1';

/** Generate N consecutive diary-date rows ending at endDate (descending).
 *  Includes loggedAt at 12:00 UTC so EARLY_BIRD and NIGHT_OWL are not triggered. */
function makeDates(endDate: string, count: number): { date: string; loggedAt: Date }[] {
  const result: { date: string; loggedAt: Date }[] = [];
  const end = new Date(endDate + 'T00:00:00Z');
  for (let i = 0; i < count; i++) {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    result.push({ date: dateStr, loggedAt: new Date(dateStr + 'T12:00:00Z') });
  }
  return result; // descending
}

/** Generate N consecutive hydration rows ending at endDate (ascending for the service) */
function makeHydrationDates(endDate: string, count: number, amountMl = 2700) {
  return makeDates(endDate, count)
    .reverse()
    .map((r) => ({ date: r.date, _sum: { amountMl } }));
}

/** A diary entry classified as GOOD (protein ≥ 25%, fat ≤ 35%) */
const goodEntry = (date: string) => ({
  date,
  kcal: 400,
  proteinG: 40,  // protein cals = 160 → ~39.9% ✓
  carbsG: 40,    // carbs cals  = 160
  fatG: 9,       // fat cals    =  81 → ~20.2% ✓
});

/** A diary entry classified as POOR (fat > 45%) */
const poorEntry = (date: string) => ({
  date,
  kcal: 400,
  proteinG: 5,
  carbsG: 5,
  fatG: 40, // fat cals = 360 → ~90% ✗
});

describe('AchievementsService', () => {
  let service: AchievementsService;

  const mockPrisma = {
    userAchievement: {
      findMany: jest.fn(),
      createMany: jest.fn(),
    },
    userProfile: { findUnique: jest.fn() },
    diaryEntry: {
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    hydrationEntry: { groupBy: jest.fn() },
    $queryRaw: jest.fn(),
  };

  const defaultProfile = {
    caloriesGoal: 2200,
    proteinGoalG: 150,
    carbsGoalG: 250,
    fatGoalG: 70,
    waterGoalMl: 2600,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AchievementsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AchievementsService>(AchievementsService);
    jest.clearAllMocks();

    // Safe defaults: nothing earned, no data
    mockPrisma.userAchievement.findMany.mockResolvedValue([]);
    mockPrisma.userAchievement.createMany.mockResolvedValue({ count: 0 });
    mockPrisma.userProfile.findUnique.mockResolvedValue(defaultProfile);
    mockPrisma.diaryEntry.count.mockResolvedValue(0);
    mockPrisma.diaryEntry.findMany.mockResolvedValue([]);
    mockPrisma.diaryEntry.groupBy.mockResolvedValue([]);
    mockPrisma.hydrationEntry.groupBy.mockResolvedValue([]);
    mockPrisma.$queryRaw.mockResolvedValue([{ count: BigInt(0) }]);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── getAchievements ────────────────────────────────────────────────────────

  describe('getAchievements', () => {
    it('should return all 16 achievements', async () => {
      const result = await service.getAchievements(USER_ID);
      expect(result).toHaveLength(ACHIEVEMENTS.length);
    });

    it('should return correct shape for each achievement', async () => {
      const result = await service.getAchievements(USER_ID);
      for (const a of result) {
        expect(a).toHaveProperty('key');
        expect(a).toHaveProperty('name');
        expect(a).toHaveProperty('icon');
        expect(a).toHaveProperty('description');
        expect(a).toHaveProperty('category');
        expect(a).toHaveProperty('earned');
        expect(a).toHaveProperty('earnedAt');
      }
    });

    it('should return earned: false and earnedAt: null for unearned achievements', async () => {
      const result = await service.getAchievements(USER_ID);
      for (const a of result) {
        expect(a.earned).toBe(false);
        expect(a.earnedAt).toBeNull();
      }
    });

    it('should mark already-earned achievement as earned with correct earnedAt', async () => {
      const earnedAt = new Date('2026-03-10T10:00:00.000Z');
      mockPrisma.userAchievement.findMany.mockResolvedValue([
        { achievementKey: 'FIRST_LOG', earnedAt },
      ]);
      mockPrisma.diaryEntry.count.mockResolvedValue(1);

      const result = await service.getAchievements(USER_ID);
      const firstLog = result.find((a) => a.key === 'FIRST_LOG');

      expect(firstLog!.earned).toBe(true);
      expect(firstLog!.earnedAt).toBe(earnedAt.toISOString());
    });

    it('should call evaluateAll before returning results', async () => {
      const spy = jest.spyOn(service, 'evaluateAll').mockResolvedValue(undefined);
      await service.getAchievements(USER_ID);
      expect(spy).toHaveBeenCalledWith(USER_ID);
    });

    describe('category filter', () => {
      it('should return only consistency achievements when category=consistency', async () => {
        const result = await service.getAchievements(USER_ID, 'consistency');
        expect(result.every((a) => a.category === 'consistency')).toBe(true);
        expect(result).toHaveLength(5); // FIRST_LOG, PERFECT_WEEK, STREAK_14, STREAK_21, MARATHON
      });

      it('should return only hydration achievements when category=hydration', async () => {
        const result = await service.getAchievements(USER_ID, 'hydration');
        expect(result.every((a) => a.category === 'hydration')).toBe(true);
        expect(result).toHaveLength(2); // HYDRATION_HERO, WATER_WEEK
      });

      it('should return only nutrition achievements when category=nutrition', async () => {
        const result = await service.getAchievements(USER_ID, 'nutrition');
        expect(result.every((a) => a.category === 'nutrition')).toBe(true);
        expect(result).toHaveLength(4); // PROTEIN_PRO, CALORIE_MASTER, TRIPLE_CROWN, QUALITY_STREAK
      });

      it('should return only behavior achievements when category=behavior', async () => {
        const result = await service.getAchievements(USER_ID, 'behavior');
        expect(result.every((a) => a.category === 'behavior')).toBe(true);
        expect(result).toHaveLength(3); // EARLY_BIRD, PHOTO_FOODIE, NIGHT_OWL
      });

      it('should return only milestone achievements when category=milestone', async () => {
        const result = await service.getAchievements(USER_ID, 'milestone');
        expect(result.every((a) => a.category === 'milestone')).toBe(true);
        expect(result).toHaveLength(2); // CENTURION, WEEK_COMPLETE
      });

      it('should return all achievements when no category is provided', async () => {
        const result = await service.getAchievements(USER_ID);
        expect(result).toHaveLength(16);
      });
    });
  });

  // ─── No duplicate achievements ──────────────────────────────────────────────

  describe('no duplicate achievements', () => {
    it('should call createMany with the new achievement keys when achievements are unlocked', async () => {
      mockPrisma.diaryEntry.count.mockResolvedValue(1);

      await service.evaluateAll(USER_ID);

      expect(mockPrisma.userAchievement.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ userId: USER_ID, achievementKey: 'FIRST_LOG' }),
          ]),
        }),
      );
    });

    it('should not call createMany when no achievements are newly unlocked', async () => {
      // All defaults return zero/empty — nothing to unlock
      await service.evaluateAll(USER_ID);
      expect(mockPrisma.userAchievement.createMany).not.toHaveBeenCalled();
    });

    it('should not call createMany when achievement is already persisted', async () => {
      // FIRST_LOG already in DB, and diary count = 1 (so it would be earned again)
      mockPrisma.userAchievement.findMany.mockResolvedValue([
        { achievementKey: 'FIRST_LOG', earnedAt: new Date() },
      ]);
      mockPrisma.diaryEntry.count.mockResolvedValue(1);

      await service.evaluateAll(USER_ID);

      // The service filters out already-earned achievements before calling createMany,
      // so createMany should NOT be called when all earned keys are already in the DB.
      expect(mockPrisma.userAchievement.createMany).not.toHaveBeenCalled();
    });

    it('should preserve original earnedAt from DB for already-earned achievements', async () => {
      const originalDate = new Date('2026-01-01T00:00:00.000Z');
      mockPrisma.userAchievement.findMany.mockResolvedValue([
        { achievementKey: 'FIRST_LOG', earnedAt: originalDate },
      ]);
      mockPrisma.diaryEntry.count.mockResolvedValue(50);

      const result = await service.getAchievements(USER_ID);
      const firstLog = result.find((a) => a.key === 'FIRST_LOG');

      expect(firstLog!.earnedAt).toBe(originalDate.toISOString());
    });
  });

  // ─── FIRST_LOG ──────────────────────────────────────────────────────────────

  describe('FIRST_LOG', () => {
    it('should be granted when user has 1 diary entry', async () => {
      mockPrisma.diaryEntry.count.mockResolvedValue(1);
      const result = await service['checkFirstLog'](USER_ID);
      expect(result).toContain('FIRST_LOG');
    });

    it('should be granted when user has many diary entries', async () => {
      mockPrisma.diaryEntry.count.mockResolvedValue(50);
      const result = await service['checkFirstLog'](USER_ID);
      expect(result).toContain('FIRST_LOG');
    });

    it('should not be granted when user has 0 diary entries', async () => {
      mockPrisma.diaryEntry.count.mockResolvedValue(0);
      const result = await service['checkFirstLog'](USER_ID);
      expect(result).not.toContain('FIRST_LOG');
    });

    it('should save FIRST_LOG to DB via evaluateForDiary', async () => {
      mockPrisma.diaryEntry.count.mockResolvedValue(1);
      await service.evaluateForDiary(USER_ID);
      expect(mockPrisma.userAchievement.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ userId: USER_ID, achievementKey: 'FIRST_LOG' }),
          ]),
        }),
      );
    });
  });

  // ─── Streak achievements ────────────────────────────────────────────────────

  describe('PERFECT_WEEK (best streak ≥ 7)', () => {
    it('should be granted when best streak is exactly 7 days', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue(makeDates('2026-03-19', 7));
      const result = await service['checkStreaks'](USER_ID);
      expect(result).toContain('PERFECT_WEEK');
    });

    it('should be granted when best streak exceeds 7 days', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue(makeDates('2026-03-19', 15));
      const result = await service['checkStreaks'](USER_ID);
      expect(result).toContain('PERFECT_WEEK');
    });

    it('should not be granted when best streak is 6 days', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue(makeDates('2026-03-19', 6));
      const result = await service['checkStreaks'](USER_ID);
      expect(result).not.toContain('PERFECT_WEEK');
    });

    it('should not be granted when 7 days have a gap', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue([
        { date: '2026-03-19' }, { date: '2026-03-18' }, { date: '2026-03-17' },
        // gap on 16th
        { date: '2026-03-15' }, { date: '2026-03-14' }, { date: '2026-03-13' }, { date: '2026-03-12' },
      ]);
      const result = await service['checkStreaks'](USER_ID);
      expect(result).not.toContain('PERFECT_WEEK');
    });

    it('should not be granted when no entries exist', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue([]);
      const result = await service['checkStreaks'](USER_ID);
      expect(result).not.toContain('PERFECT_WEEK');
    });
  });

  describe('STREAK_14 (best streak ≥ 14)', () => {
    it('should be granted when best streak is exactly 14 days', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue(makeDates('2026-03-19', 14));
      const result = await service['checkStreaks'](USER_ID);
      expect(result).toContain('STREAK_14');
    });

    it('should not be granted when best streak is 13 days', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue(makeDates('2026-03-19', 13));
      const result = await service['checkStreaks'](USER_ID);
      expect(result).not.toContain('STREAK_14');
    });

    it('should also grant PERFECT_WEEK alongside STREAK_14', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue(makeDates('2026-03-19', 14));
      const result = await service['checkStreaks'](USER_ID);
      expect(result).toContain('PERFECT_WEEK');
      expect(result).toContain('STREAK_14');
    });
  });

  describe('STREAK_21 (best streak ≥ 21)', () => {
    it('should be granted when best streak is exactly 21 days', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue(makeDates('2026-03-19', 21));
      const result = await service['checkStreaks'](USER_ID);
      expect(result).toContain('STREAK_21');
    });

    it('should not be granted when best streak is 20 days', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue(makeDates('2026-03-19', 20));
      const result = await service['checkStreaks'](USER_ID);
      expect(result).not.toContain('STREAK_21');
    });
  });

  describe('MARATHON (best streak ≥ 30)', () => {
    it('should be granted when best streak is exactly 30 days', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue(makeDates('2026-03-19', 30));
      const result = await service['checkStreaks'](USER_ID);
      expect(result).toContain('MARATHON');
    });

    it('should grant all 4 streak achievements when streak is 30 days', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue(makeDates('2026-03-19', 30));
      const result = await service['checkStreaks'](USER_ID);
      expect(result).toContain('PERFECT_WEEK');
      expect(result).toContain('STREAK_14');
      expect(result).toContain('STREAK_21');
      expect(result).toContain('MARATHON');
    });

    it('should not be granted when best streak is 29 days', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue(makeDates('2026-03-19', 29));
      const result = await service['checkStreaks'](USER_ID);
      expect(result).not.toContain('MARATHON');
    });

    it('should use best historical streak, not just the current streak', async () => {
      // Best streak: Jan 1–30 (30 days). Current streak: only 3 days.
      const pastStreak = makeDates('2026-01-30', 30);
      const currentStreak = makeDates('2026-03-19', 3);
      mockPrisma.diaryEntry.findMany.mockResolvedValue([...currentStreak, ...pastStreak]);

      const result = await service['checkStreaks'](USER_ID);
      expect(result).toContain('MARATHON');
    });
  });

  // ─── HYDRATION_HERO ─────────────────────────────────────────────────────────

  describe('HYDRATION_HERO', () => {
    it('should be granted when a day meets the exact water goal', async () => {
      mockPrisma.hydrationEntry.groupBy.mockResolvedValue([
        { date: '2026-03-19', _sum: { amountMl: 2600 } },
      ]);
      const result = await service['checkHydrationHero'](USER_ID);
      expect(result).toContain('HYDRATION_HERO');
    });

    it('should be granted when a day exceeds the water goal', async () => {
      mockPrisma.hydrationEntry.groupBy.mockResolvedValue([
        { date: '2026-03-19', _sum: { amountMl: 3500 } },
      ]);
      const result = await service['checkHydrationHero'](USER_ID);
      expect(result).toContain('HYDRATION_HERO');
    });

    it('should not be granted when no qualifying day exists', async () => {
      mockPrisma.hydrationEntry.groupBy.mockResolvedValue([]);
      const result = await service['checkHydrationHero'](USER_ID);
      expect(result).not.toContain('HYDRATION_HERO');
    });

    it('should save HYDRATION_HERO to DB via evaluateForHydration', async () => {
      mockPrisma.hydrationEntry.groupBy.mockResolvedValue([
        { date: '2026-03-19', _sum: { amountMl: 2600 } },
      ]);
      await service.evaluateForHydration(USER_ID);
      expect(mockPrisma.userAchievement.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ userId: USER_ID, achievementKey: 'HYDRATION_HERO' }),
          ]),
        }),
      );
    });

    it('should not be triggered by diary evaluation (only hydration)', async () => {
      // Even if hydration data would qualify, evaluateForDiary doesn't check HYDRATION_HERO
      mockPrisma.hydrationEntry.groupBy.mockResolvedValue([
        { date: '2026-03-19', _sum: { amountMl: 3000 } },
      ]);
      mockPrisma.diaryEntry.count.mockResolvedValue(0);
      await service.evaluateForDiary(USER_ID);

      const allCalls = mockPrisma.userAchievement.createMany.mock.calls;
      const allGrantedKeys = allCalls.flatMap((c) => c[0].data.map((d) => d.achievementKey));
      expect(allGrantedKeys).not.toContain('HYDRATION_HERO');
    });
  });

  // ─── WATER_WEEK ─────────────────────────────────────────────────────────────

  describe('WATER_WEEK', () => {
    it('should be granted when exactly 7 consecutive days meet the water goal', async () => {
      mockPrisma.hydrationEntry.groupBy.mockResolvedValue(
        makeHydrationDates('2026-03-19', 7),
      );
      const result = await service['checkWaterWeek'](USER_ID);
      expect(result).toContain('WATER_WEEK');
    });

    it('should be granted when more than 7 consecutive days meet the water goal', async () => {
      mockPrisma.hydrationEntry.groupBy.mockResolvedValue(
        makeHydrationDates('2026-03-19', 10),
      );
      const result = await service['checkWaterWeek'](USER_ID);
      expect(result).toContain('WATER_WEEK');
    });

    it('should not be granted when only 6 consecutive days meet the goal', async () => {
      mockPrisma.hydrationEntry.groupBy.mockResolvedValue(
        makeHydrationDates('2026-03-19', 6),
      );
      const result = await service['checkWaterWeek'](USER_ID);
      expect(result).not.toContain('WATER_WEEK');
    });

    it('should not be granted when 7 days have a gap between them', async () => {
      mockPrisma.hydrationEntry.groupBy.mockResolvedValue([
        { date: '2026-03-13', _sum: { amountMl: 3000 } },
        { date: '2026-03-14', _sum: { amountMl: 3000 } },
        { date: '2026-03-15', _sum: { amountMl: 3000 } },
        // gap: 2026-03-16 missing
        { date: '2026-03-17', _sum: { amountMl: 3000 } },
        { date: '2026-03-18', _sum: { amountMl: 3000 } },
        { date: '2026-03-19', _sum: { amountMl: 3000 } },
        { date: '2026-03-20', _sum: { amountMl: 3000 } },
      ]);
      const result = await service['checkWaterWeek'](USER_ID);
      expect(result).not.toContain('WATER_WEEK');
    });

    it('should not be granted when no hydration data exists', async () => {
      mockPrisma.hydrationEntry.groupBy.mockResolvedValue([]);
      const result = await service['checkWaterWeek'](USER_ID);
      expect(result).not.toContain('WATER_WEEK');
    });
  });

  // ─── PROTEIN_PRO ────────────────────────────────────────────────────────────

  describe('PROTEIN_PRO', () => {
    it('should be granted when a day meets the exact protein goal (150g)', async () => {
      mockPrisma.diaryEntry.groupBy.mockResolvedValue([
        { date: '2026-03-19', _sum: { proteinG: 150 } },
      ]);
      const result = await service['checkProteinPro'](USER_ID);
      expect(result).toContain('PROTEIN_PRO');
    });

    it('should be granted when a day exceeds the protein goal', async () => {
      mockPrisma.diaryEntry.groupBy.mockResolvedValue([
        { date: '2026-03-19', _sum: { proteinG: 200 } },
      ]);
      const result = await service['checkProteinPro'](USER_ID);
      expect(result).toContain('PROTEIN_PRO');
    });

    it('should not be granted when no day meets the protein goal', async () => {
      mockPrisma.diaryEntry.groupBy.mockResolvedValue([]);
      const result = await service['checkProteinPro'](USER_ID);
      expect(result).not.toContain('PROTEIN_PRO');
    });
  });

  // ─── CALORIE_MASTER ─────────────────────────────────────────────────────────

  describe('CALORIE_MASTER', () => {
    // Goal: 2200 kcal. Range ±10% → [1980, 2420]

    it('should be granted when exactly 3 days are within ±10% of the calorie goal', async () => {
      mockPrisma.diaryEntry.groupBy.mockResolvedValue([
        { date: '2026-03-17', _sum: { kcal: 2200 } }, // exact
        { date: '2026-03-18', _sum: { kcal: 2100 } }, // within range
        { date: '2026-03-19', _sum: { kcal: 2300 } }, // within range
      ]);
      const result = await service['checkCalorieMaster'](USER_ID);
      expect(result).toContain('CALORIE_MASTER');
    });

    it('should be granted when more than 3 days are within range', async () => {
      mockPrisma.diaryEntry.groupBy.mockResolvedValue([
        { date: '2026-03-16', _sum: { kcal: 2200 } },
        { date: '2026-03-17', _sum: { kcal: 2200 } },
        { date: '2026-03-18', _sum: { kcal: 2200 } },
        { date: '2026-03-19', _sum: { kcal: 2200 } },
      ]);
      const result = await service['checkCalorieMaster'](USER_ID);
      expect(result).toContain('CALORIE_MASTER');
    });

    it('should not be granted when only 2 days are within range', async () => {
      mockPrisma.diaryEntry.groupBy.mockResolvedValue([
        { date: '2026-03-18', _sum: { kcal: 2200 } },
        { date: '2026-03-19', _sum: { kcal: 2200 } },
        { date: '2026-03-17', _sum: { kcal: 500 } }, // outside range
      ]);
      const result = await service['checkCalorieMaster'](USER_ID);
      expect(result).not.toContain('CALORIE_MASTER');
    });

    it('should not count calories above upper bound (2421 > 2420)', async () => {
      mockPrisma.diaryEntry.groupBy.mockResolvedValue([
        { date: '2026-03-17', _sum: { kcal: 2421 } },
        { date: '2026-03-18', _sum: { kcal: 2421 } },
        { date: '2026-03-19', _sum: { kcal: 2421 } },
      ]);
      const result = await service['checkCalorieMaster'](USER_ID);
      expect(result).not.toContain('CALORIE_MASTER');
    });

    it('should not count calories below lower bound (1979 < 1980)', async () => {
      mockPrisma.diaryEntry.groupBy.mockResolvedValue([
        { date: '2026-03-17', _sum: { kcal: 1979 } },
        { date: '2026-03-18', _sum: { kcal: 1979 } },
        { date: '2026-03-19', _sum: { kcal: 1979 } },
      ]);
      const result = await service['checkCalorieMaster'](USER_ID);
      expect(result).not.toContain('CALORIE_MASTER');
    });

    it('should count calories at exactly the upper bound (2420)', async () => {
      mockPrisma.diaryEntry.groupBy.mockResolvedValue([
        { date: '2026-03-17', _sum: { kcal: 2420 } },
        { date: '2026-03-18', _sum: { kcal: 2420 } },
        { date: '2026-03-19', _sum: { kcal: 2420 } },
      ]);
      const result = await service['checkCalorieMaster'](USER_ID);
      expect(result).toContain('CALORIE_MASTER');
    });

    it('should count calories at exactly the lower bound (1980)', async () => {
      mockPrisma.diaryEntry.groupBy.mockResolvedValue([
        { date: '2026-03-17', _sum: { kcal: 1980 } },
        { date: '2026-03-18', _sum: { kcal: 1980 } },
        { date: '2026-03-19', _sum: { kcal: 1980 } },
      ]);
      const result = await service['checkCalorieMaster'](USER_ID);
      expect(result).toContain('CALORIE_MASTER');
    });
  });

  // ─── TRIPLE_CROWN ───────────────────────────────────────────────────────────

  describe('TRIPLE_CROWN', () => {
    it('should be granted when all 3 goals are met on the same day', async () => {
      mockPrisma.diaryEntry.groupBy.mockResolvedValue([
        { date: '2026-03-19', _sum: { kcal: 2200, proteinG: 150 } },
      ]);
      mockPrisma.hydrationEntry.groupBy.mockResolvedValue([
        { date: '2026-03-19', _sum: { amountMl: 2600 } },
      ]);
      const result = await service['checkTripleCrown'](USER_ID);
      expect(result).toContain('TRIPLE_CROWN');
    });

    it('should be granted when calories are within ±10% of goal', async () => {
      mockPrisma.diaryEntry.groupBy.mockResolvedValue([
        { date: '2026-03-19', _sum: { kcal: 2100, proteinG: 160 } },
      ]);
      mockPrisma.hydrationEntry.groupBy.mockResolvedValue([
        { date: '2026-03-19', _sum: { amountMl: 3000 } },
      ]);
      const result = await service['checkTripleCrown'](USER_ID);
      expect(result).toContain('TRIPLE_CROWN');
    });

    it('should not be granted when water goal is not met', async () => {
      mockPrisma.diaryEntry.groupBy.mockResolvedValue([
        { date: '2026-03-19', _sum: { kcal: 2200, proteinG: 150 } },
      ]);
      mockPrisma.hydrationEntry.groupBy.mockResolvedValue([
        { date: '2026-03-19', _sum: { amountMl: 1000 } }, // below 2600ml
      ]);
      const result = await service['checkTripleCrown'](USER_ID);
      expect(result).not.toContain('TRIPLE_CROWN');
    });

    it('should not be granted when protein goal is not met', async () => {
      mockPrisma.diaryEntry.groupBy.mockResolvedValue([
        { date: '2026-03-19', _sum: { kcal: 2200, proteinG: 80 } }, // below 150g
      ]);
      mockPrisma.hydrationEntry.groupBy.mockResolvedValue([
        { date: '2026-03-19', _sum: { amountMl: 2600 } },
      ]);
      const result = await service['checkTripleCrown'](USER_ID);
      expect(result).not.toContain('TRIPLE_CROWN');
    });

    it('should not be granted when calorie goal deviation exceeds 10%', async () => {
      mockPrisma.diaryEntry.groupBy.mockResolvedValue([
        { date: '2026-03-19', _sum: { kcal: 500, proteinG: 150 } }, // way below goal
      ]);
      mockPrisma.hydrationEntry.groupBy.mockResolvedValue([
        { date: '2026-03-19', _sum: { amountMl: 2600 } },
      ]);
      const result = await service['checkTripleCrown'](USER_ID);
      expect(result).not.toContain('TRIPLE_CROWN');
    });

    it('should not be granted when goals are met on different days', async () => {
      mockPrisma.diaryEntry.groupBy.mockResolvedValue([
        { date: '2026-03-18', _sum: { kcal: 2200, proteinG: 150 } },
      ]);
      mockPrisma.hydrationEntry.groupBy.mockResolvedValue([
        { date: '2026-03-19', _sum: { amountMl: 2600 } }, // different day
      ]);
      const result = await service['checkTripleCrown'](USER_ID);
      expect(result).not.toContain('TRIPLE_CROWN');
    });

    it('should not be granted when no profile exists', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue(null);
      const result = await service['checkTripleCrown'](USER_ID);
      expect(result).not.toContain('TRIPLE_CROWN');
    });
  });

  // ─── QUALITY_STREAK ─────────────────────────────────────────────────────────

  describe('QUALITY_STREAK', () => {
    it('should be granted when 5 GOOD entries exist on the same day', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue([
        goodEntry('2026-03-19'),
        goodEntry('2026-03-19'),
        goodEntry('2026-03-19'),
        goodEntry('2026-03-19'),
        goodEntry('2026-03-19'),
      ]);
      const result = await service['checkQualityStreak'](USER_ID);
      expect(result).toContain('QUALITY_STREAK');
    });

    it('should be granted when more than 5 GOOD entries exist on the same day', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue([
        goodEntry('2026-03-19'),
        goodEntry('2026-03-19'),
        goodEntry('2026-03-19'),
        goodEntry('2026-03-19'),
        goodEntry('2026-03-19'),
        goodEntry('2026-03-19'),
      ]);
      const result = await service['checkQualityStreak'](USER_ID);
      expect(result).toContain('QUALITY_STREAK');
    });

    it('should not be granted when only 4 GOOD entries exist on the same day', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue([
        goodEntry('2026-03-19'),
        goodEntry('2026-03-19'),
        goodEntry('2026-03-19'),
        goodEntry('2026-03-19'),
      ]);
      const result = await service['checkQualityStreak'](USER_ID);
      expect(result).not.toContain('QUALITY_STREAK');
    });

    it('should not be granted when 5 GOOD entries are spread across different days', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue([
        goodEntry('2026-03-15'),
        goodEntry('2026-03-16'),
        goodEntry('2026-03-17'),
        goodEntry('2026-03-18'),
        goodEntry('2026-03-19'),
      ]);
      const result = await service['checkQualityStreak'](USER_ID);
      expect(result).not.toContain('QUALITY_STREAK');
    });

    it('should not count POOR entries towards the total', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue([
        goodEntry('2026-03-19'),
        goodEntry('2026-03-19'),
        goodEntry('2026-03-19'),
        goodEntry('2026-03-19'),
        poorEntry('2026-03-19'), // POOR — should not count
      ]);
      const result = await service['checkQualityStreak'](USER_ID);
      expect(result).not.toContain('QUALITY_STREAK');
    });

    it('should not be granted when no diary entries exist', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue([]);
      const result = await service['checkQualityStreak'](USER_ID);
      expect(result).not.toContain('QUALITY_STREAK');
    });
  });

  // ─── EARLY_BIRD ─────────────────────────────────────────────────────────────

  describe('EARLY_BIRD', () => {
    it('should be granted when at least 1 meal was logged before 8am UTC', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue([{ loggedAt: new Date('2026-03-19T06:00:00Z') }]);
      const result = await service['checkEarlyBird'](USER_ID);
      expect(result).toContain('EARLY_BIRD');
    });

    it('should be granted when multiple meals were logged before 8am', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue([
        { loggedAt: new Date('2026-03-19T05:00:00Z') },
        { loggedAt: new Date('2026-03-20T07:30:00Z') },
        { loggedAt: new Date('2026-03-21T06:45:00Z') },
        { loggedAt: new Date('2026-03-22T04:00:00Z') },
        { loggedAt: new Date('2026-03-23T07:59:00Z') },
      ]);
      const result = await service['checkEarlyBird'](USER_ID);
      expect(result).toContain('EARLY_BIRD');
    });

    it('should not be granted when no meal was logged before 8am', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue([
        { loggedAt: new Date('2026-03-19T09:00:00Z') },
        { loggedAt: new Date('2026-03-20T12:00:00Z') },
      ]);
      const result = await service['checkEarlyBird'](USER_ID);
      expect(result).not.toContain('EARLY_BIRD');
    });
  });

  // ─── PHOTO_FOODIE ───────────────────────────────────────────────────────────

  describe('PHOTO_FOODIE', () => {
    it('should be granted when exactly 5 entries have a photo', async () => {
      mockPrisma.diaryEntry.count.mockResolvedValue(5);
      const result = await service['checkPhotoFoodie'](USER_ID);
      expect(result).toContain('PHOTO_FOODIE');
    });

    it('should be granted when more than 5 entries have a photo', async () => {
      mockPrisma.diaryEntry.count.mockResolvedValue(12);
      const result = await service['checkPhotoFoodie'](USER_ID);
      expect(result).toContain('PHOTO_FOODIE');
    });

    it('should not be granted when only 4 entries have a photo', async () => {
      mockPrisma.diaryEntry.count.mockResolvedValue(4);
      const result = await service['checkPhotoFoodie'](USER_ID);
      expect(result).not.toContain('PHOTO_FOODIE');
    });

    it('should not be granted when no entry has a photo', async () => {
      mockPrisma.diaryEntry.count.mockResolvedValue(0);
      const result = await service['checkPhotoFoodie'](USER_ID);
      expect(result).not.toContain('PHOTO_FOODIE');
    });
  });

  // ─── NIGHT_OWL ──────────────────────────────────────────────────────────────

  describe('NIGHT_OWL', () => {
    it('should be granted when exactly 3 meals were logged after 9pm', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue([
        { loggedAt: new Date('2026-03-19T21:00:00Z') },
        { loggedAt: new Date('2026-03-20T22:30:00Z') },
        { loggedAt: new Date('2026-03-21T23:00:00Z') },
      ]);
      const result = await service['checkNightOwl'](USER_ID);
      expect(result).toContain('NIGHT_OWL');
    });

    it('should be granted when more than 3 meals were logged after 9pm', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue([
        { loggedAt: new Date('2026-03-19T21:00:00Z') },
        { loggedAt: new Date('2026-03-20T22:00:00Z') },
        { loggedAt: new Date('2026-03-21T23:00:00Z') },
        { loggedAt: new Date('2026-03-22T21:30:00Z') },
        { loggedAt: new Date('2026-03-23T22:45:00Z') },
        { loggedAt: new Date('2026-03-24T23:59:00Z') },
        { loggedAt: new Date('2026-03-25T21:01:00Z') },
      ]);
      const result = await service['checkNightOwl'](USER_ID);
      expect(result).toContain('NIGHT_OWL');
    });

    it('should not be granted when only 2 meals were logged after 9pm', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue([
        { loggedAt: new Date('2026-03-19T21:00:00Z') },
        { loggedAt: new Date('2026-03-20T22:00:00Z') },
        { loggedAt: new Date('2026-03-21T19:00:00Z') }, // 19:00 UTC — does not qualify
      ]);
      const result = await service['checkNightOwl'](USER_ID);
      expect(result).not.toContain('NIGHT_OWL');
    });

    it('should not be granted when no meal was logged after 9pm', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue([
        { loggedAt: new Date('2026-03-19T12:00:00Z') },
        { loggedAt: new Date('2026-03-20T15:00:00Z') },
      ]);
      const result = await service['checkNightOwl'](USER_ID);
      expect(result).not.toContain('NIGHT_OWL');
    });
  });

  // ─── CENTURION ──────────────────────────────────────────────────────────────

  describe('CENTURION', () => {
    it('should be granted when user has exactly 100 diary entries', async () => {
      mockPrisma.diaryEntry.count.mockResolvedValue(100);
      const result = await service['checkCenturion'](USER_ID);
      expect(result).toContain('CENTURION');
    });

    it('should be granted when user has more than 100 diary entries', async () => {
      mockPrisma.diaryEntry.count.mockResolvedValue(250);
      const result = await service['checkCenturion'](USER_ID);
      expect(result).toContain('CENTURION');
    });

    it('should not be granted when user has 99 diary entries', async () => {
      mockPrisma.diaryEntry.count.mockResolvedValue(99);
      const result = await service['checkCenturion'](USER_ID);
      expect(result).not.toContain('CENTURION');
    });

    it('should not be granted when user has no diary entries', async () => {
      mockPrisma.diaryEntry.count.mockResolvedValue(0);
      const result = await service['checkCenturion'](USER_ID);
      expect(result).not.toContain('CENTURION');
    });
  });

  // ─── WEEK_COMPLETE ──────────────────────────────────────────────────────────

  describe('WEEK_COMPLETE', () => {
    // 2026-03-16 (Mon) → 2026-03-22 (Sun)
    const fullWeek = [
      { date: '2026-03-16' }, { date: '2026-03-17' }, { date: '2026-03-18' },
      { date: '2026-03-19' }, { date: '2026-03-20' }, { date: '2026-03-21' },
      { date: '2026-03-22' },
    ];

    it('should be granted when all 7 days of a Mon–Sun week are logged', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue(fullWeek);
      const result = await service['checkWeekComplete'](USER_ID);
      expect(result).toContain('WEEK_COMPLETE');
    });

    it('should be granted even with extra entries outside that week', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue([
        ...fullWeek,
        { date: '2026-03-23' }, // next week
        { date: '2026-03-15' }, // prev week
      ]);
      const result = await service['checkWeekComplete'](USER_ID);
      expect(result).toContain('WEEK_COMPLETE');
    });

    it('should not be granted when one day of the week is missing', async () => {
      const incompleteWeek = fullWeek.filter((r) => r.date !== '2026-03-22'); // missing Sunday
      mockPrisma.diaryEntry.findMany.mockResolvedValue(incompleteWeek);
      const result = await service['checkWeekComplete'](USER_ID);
      expect(result).not.toContain('WEEK_COMPLETE');
    });

    it('should not be granted when only the first day of a week is logged', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue([{ date: '2026-03-16' }]);
      const result = await service['checkWeekComplete'](USER_ID);
      expect(result).not.toContain('WEEK_COMPLETE');
    });

    it('should not be granted when no entries exist', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue([]);
      const result = await service['checkWeekComplete'](USER_ID);
      expect(result).not.toContain('WEEK_COMPLETE');
    });
  });

  // ─── evaluateForDiary & evaluateForHydration ────────────────────────────────

  describe('evaluateForDiary', () => {
    it('should not evaluate HYDRATION_HERO or WATER_WEEK', async () => {
      // Simulate qualifying hydration data — but evaluateForDiary should ignore it
      mockPrisma.hydrationEntry.groupBy.mockResolvedValue([
        { date: '2026-03-19', _sum: { amountMl: 3000 } },
      ]);
      await service.evaluateForDiary(USER_ID);

      const allGranted = mockPrisma.userAchievement.createMany.mock.calls
        .flatMap((c) => c[0].data.map((d) => d.achievementKey));

      expect(allGranted).not.toContain('HYDRATION_HERO');
      expect(allGranted).not.toContain('WATER_WEEK');
    });

    it('should not call createMany when no diary achievement is earned', async () => {
      await service.evaluateForDiary(USER_ID);
      expect(mockPrisma.userAchievement.createMany).not.toHaveBeenCalled();
    });
  });

  describe('evaluateForHydration', () => {
    it('should not call createMany when no hydration achievement is earned', async () => {
      await service.evaluateForHydration(USER_ID);
      expect(mockPrisma.userAchievement.createMany).not.toHaveBeenCalled();
    });

    it('should save WATER_WEEK when 7 consecutive days meet the goal', async () => {
      mockPrisma.hydrationEntry.groupBy.mockResolvedValue(
        makeHydrationDates('2026-03-19', 7),
      );
      await service.evaluateForHydration(USER_ID);
      expect(mockPrisma.userAchievement.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ userId: USER_ID, achievementKey: 'WATER_WEEK' }),
          ]),
        }),
      );
    });
  });

  // ─── Null / undefined Prisma return handling ────────────────────────────────

  describe('null and edge-case Prisma returns', () => {
    it('checkWaterWeek: should treat null amountMl as 0 and not grant achievement', async () => {
      mockPrisma.hydrationEntry.groupBy.mockResolvedValue([
        { date: '2026-03-19', _sum: { amountMl: null } },
        { date: '2026-03-18', _sum: { amountMl: null } },
      ]);
      const result = await service['checkWaterWeek'](USER_ID);
      expect(result).not.toContain('WATER_WEEK');
    });

    it('checkCalorieMaster: should treat null kcal sum as 0 and exclude it from range', async () => {
      mockPrisma.diaryEntry.groupBy.mockResolvedValue([
        { date: '2026-03-17', _sum: { kcal: null } }, // treated as 0 → outside ±10% of 2200
        { date: '2026-03-18', _sum: { kcal: null } },
        { date: '2026-03-19', _sum: { kcal: null } },
      ]);
      const result = await service['checkCalorieMaster'](USER_ID);
      expect(result).not.toContain('CALORIE_MASTER');
    });

    it('checkTripleCrown: should treat null kcal/protein as 0 and not grant achievement', async () => {
      mockPrisma.diaryEntry.groupBy.mockResolvedValue([
        { date: '2026-03-19', _sum: { kcal: null, proteinG: null } },
      ]);
      mockPrisma.hydrationEntry.groupBy.mockResolvedValue([
        { date: '2026-03-19', _sum: { amountMl: 3000 } },
      ]);
      const result = await service['checkTripleCrown'](USER_ID);
      expect(result).not.toContain('TRIPLE_CROWN');
    });

    it('checkTripleCrown: should use 0 water when date has no hydration entry', async () => {
      mockPrisma.diaryEntry.groupBy.mockResolvedValue([
        { date: '2026-03-19', _sum: { kcal: 2200, proteinG: 150 } },
      ]);
      // No matching hydration entry for that date
      mockPrisma.hydrationEntry.groupBy.mockResolvedValue([
        { date: '2026-03-18', _sum: { amountMl: 5000 } }, // different day
      ]);
      const result = await service['checkTripleCrown'](USER_ID);
      expect(result).not.toContain('TRIPLE_CROWN');
    });

    it('checkEarlyBird: should not grant when no entry has loggedAt before 8am', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue([
        { loggedAt: new Date('2026-03-19T09:00:00Z') },
      ]);
      const result = await service['checkEarlyBird'](USER_ID);
      expect(result).not.toContain('EARLY_BIRD');
    });

    it('checkNightOwl: should grant when exactly 3 entries have loggedAt >= 21:00 UTC', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue([
        { loggedAt: new Date('2026-03-19T21:00:00Z') },
        { loggedAt: new Date('2026-03-20T22:00:00Z') },
        { loggedAt: new Date('2026-03-21T23:00:00Z') },
      ]);
      const result = await service['checkNightOwl'](USER_ID);
      expect(result).toContain('NIGHT_OWL');
    });

    it('checkNightOwl: should not grant when only 2 entries have loggedAt >= 21:00 UTC', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue([
        { loggedAt: new Date('2026-03-19T21:00:00Z') },
        { loggedAt: new Date('2026-03-20T22:00:00Z') },
        { loggedAt: new Date('2026-03-21T19:00:00Z') }, // 19:00 UTC — does not qualify
      ]);
      const result = await service['checkNightOwl'](USER_ID);
      expect(result).not.toContain('NIGHT_OWL');
    });

    it('checkProteinPro: should not grant when groupBy returns empty array', async () => {
      mockPrisma.diaryEntry.groupBy.mockResolvedValue([]);
      const result = await service['checkProteinPro'](USER_ID);
      expect(result).not.toContain('PROTEIN_PRO');
    });

    it('checkStreaks: should return empty array when findMany returns empty', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue([]);
      const result = await service['checkStreaks'](USER_ID);
      expect(result).toEqual([]);
    });
  });

  // ─── evaluateAll: batch grant ────────────────────────────────────────────────

  describe('evaluateAll: multiple achievements granted at once', () => {
    it('should grant multiple achievements in a single createMany call', async () => {
      // Setup conditions that trigger both FIRST_LOG and PERFECT_WEEK
      mockPrisma.diaryEntry.count.mockResolvedValue(1);
      mockPrisma.diaryEntry.findMany.mockResolvedValue(makeDates('2026-03-19', 7));

      await service.evaluateAll(USER_ID);

      expect(mockPrisma.userAchievement.createMany).toHaveBeenCalledTimes(1);
      const data = mockPrisma.userAchievement.createMany.mock.calls[0][0].data;
      const keys = data.map((d) => d.achievementKey);
      expect(keys).toContain('FIRST_LOG');
      expect(keys).toContain('PERFECT_WEEK');
    });

    it('should include userId in every achievement record passed to createMany', async () => {
      mockPrisma.diaryEntry.count.mockResolvedValue(1);

      await service.evaluateAll(USER_ID);

      const data = mockPrisma.userAchievement.createMany.mock.calls[0][0].data;
      expect(data.every((d) => d.userId === USER_ID)).toBe(true);
    });

    it('should grant PERFECT_WEEK, STREAK_14 and STREAK_21 together for a 21-day streak', async () => {
      mockPrisma.diaryEntry.findMany.mockResolvedValue(makeDates('2026-03-19', 21));
      mockPrisma.diaryEntry.count.mockResolvedValue(21);

      await service.evaluateAll(USER_ID);

      const keys = mockPrisma.userAchievement.createMany.mock.calls[0][0].data
        .map((d) => d.achievementKey);

      expect(keys).toContain('FIRST_LOG');
      expect(keys).toContain('PERFECT_WEEK');
      expect(keys).toContain('STREAK_14');
      expect(keys).toContain('STREAK_21');
      expect(keys).not.toContain('MARATHON'); // 21 < 30
    });
  });

  // ─── getAchievements: result ordering and completeness ───────────────────────

  describe('getAchievements: result ordering and completeness', () => {
    it('should return achievements in the same order as ACHIEVEMENTS constant', async () => {
      const result = await service.getAchievements(USER_ID);
      const resultKeys = result.map((a) => a.key);
      const expectedKeys = ACHIEVEMENTS.map((a) => a.key);
      expect(resultKeys).toEqual(expectedKeys);
    });

    it('should mark only the earned achievement as earned when one is persisted', async () => {
      const earnedAt = new Date();
      mockPrisma.userAchievement.findMany.mockResolvedValue([
        { achievementKey: 'HYDRATION_HERO', earnedAt },
      ]);

      const result = await service.getAchievements(USER_ID);

      const earnedOnes = result.filter((a) => a.earned);
      expect(earnedOnes).toHaveLength(1);
      expect(earnedOnes[0].key).toBe('HYDRATION_HERO');
    });

    it('should correctly reflect multiple pre-earned achievements from DB', async () => {
      const earnedAt = new Date();
      mockPrisma.userAchievement.findMany.mockResolvedValue([
        { achievementKey: 'FIRST_LOG', earnedAt },
        { achievementKey: 'PERFECT_WEEK', earnedAt },
        { achievementKey: 'HYDRATION_HERO', earnedAt },
      ]);

      const result = await service.getAchievements(USER_ID);

      const earnedKeys = result.filter((a) => a.earned).map((a) => a.key);
      expect(earnedKeys).toContain('FIRST_LOG');
      expect(earnedKeys).toContain('PERFECT_WEEK');
      expect(earnedKeys).toContain('HYDRATION_HERO');
      expect(earnedKeys).not.toContain('STREAK_14');
    });

    it('should not have any extra or missing fields in each achievement DTO', async () => {
      const result = await service.getAchievements(USER_ID);

      for (const a of result) {
        const keys = Object.keys(a).sort();
        expect(keys).toEqual(['category', 'description', 'earned', 'earnedAt', 'icon', 'key', 'name']);
      }
    });

    it('should scope achievements to the correct userId (not bleed across users)', async () => {
      const otherUserEarned = [{ achievementKey: 'MARATHON', earnedAt: new Date() }];

      // First call for user-test-1 returns nothing earned
      mockPrisma.userAchievement.findMany.mockResolvedValue([]);

      const resultUser1 = await service.getAchievements(USER_ID);

      // Second call for a different user
      mockPrisma.userAchievement.findMany.mockResolvedValue(otherUserEarned);
      const resultUser2 = await service.getAchievements('user-test-2');

      const user1Marathon = resultUser1.find((a) => a.key === 'MARATHON');
      const user2Marathon = resultUser2.find((a) => a.key === 'MARATHON');

      expect(user1Marathon!.earned).toBe(false);
      expect(user2Marathon!.earned).toBe(true);
    });
  });
});
