import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ACHIEVEMENTS, AchievementDefinition, AchievementKey } from './achievements.constants';
import { AchievementDto } from './dto/achievement-response.dto';
import { computeBestStreak } from '../dashboard/streak.utils';

function isGoodEntry(kcal: number, proteinG: number, carbsG: number, fatG: number): boolean {
  const macroCals = proteinG * 4 + carbsG * 4 + fatG * 9;
  if (kcal === 0 || macroCals === 0) return false;
  const proteinPct = (proteinG * 4 / macroCals) * 100;
  const fatPct = (fatG * 9 / macroCals) * 100;
  return proteinPct >= 25 && fatPct <= 35;
}

function toDto(def: AchievementDefinition, earnedAt: Date | null): AchievementDto {
  return {
    key: def.key,
    name: def.name,
    icon: def.icon,
    description: def.description,
    category: def.category,
    earned: earnedAt !== null,
    earnedAt: earnedAt ? earnedAt.toISOString() : null,
  };
}

@Injectable()
export class AchievementsService {
  constructor(private prisma: PrismaService) {}

  // ─── Public API ─────────────────────────────────────────────────────────────

  async getAchievements(userId: string, category?: string): Promise<AchievementDto[]> {
    await this.evaluateAll(userId);

    const earned = await this.prisma.userAchievement.findMany({ where: { userId } });
    const earnedMap = new Map(earned.map((a) => [a.achievementKey, a.earnedAt]));

    let definitions: AchievementDefinition[] = ACHIEVEMENTS;
    if (category) {
      definitions = ACHIEVEMENTS.filter((a) => a.category === category);
    }

    return definitions.map((def) => toDto(def, earnedMap.get(def.key) ?? null));
  }

  /**
   * Evaluates all checks, persists newly earned achievements and returns only
   * the achievements unlocked by this specific action (not previously earned).
   * Called after a diary entry is created.
   */
  async evaluateForDiary(userId: string): Promise<AchievementDto[]> {
    const [alreadyEarned, checks] = await Promise.all([
      this.prisma.userAchievement.findMany({
        where: { userId },
        select: { achievementKey: true },
      }),
      Promise.all([
        this.checkFirstLog(userId),
        this.checkStreaks(userId),
        this.checkProteinPro(userId),
        this.checkCalorieMaster(userId),
        this.checkTripleCrown(userId),
        this.checkQualityStreak(userId),
        this.checkEarlyBird(userId),
        this.checkPhotoFoodie(userId),
        this.checkNightOwl(userId),
        this.checkCenturion(userId),
        this.checkWeekComplete(userId),
      ]),
    ]);

    return this.persistAndReturn(userId, alreadyEarned, checks);
  }

  /**
   * Evaluates hydration-related checks, persists newly earned achievements and
   * returns only the achievements unlocked by this specific action.
   * Called after a hydration entry is created.
   */
  async evaluateForHydration(userId: string): Promise<AchievementDto[]> {
    const [alreadyEarned, checks] = await Promise.all([
      this.prisma.userAchievement.findMany({
        where: { userId },
        select: { achievementKey: true },
      }),
      Promise.all([
        this.checkHydrationHero(userId),
        this.checkWaterWeek(userId),
        this.checkTripleCrown(userId),
      ]),
    ]);

    return this.persistAndReturn(userId, alreadyEarned, checks);
  }

  /** Full evaluation used by GET /achievements (returns void — caller fetches all). */
  async evaluateAll(userId: string): Promise<void> {
    const [alreadyEarned, checks] = await Promise.all([
      this.prisma.userAchievement.findMany({
        where: { userId },
        select: { achievementKey: true },
      }),
      Promise.all([
        this.checkFirstLog(userId),
        this.checkStreaks(userId),
        this.checkHydrationHero(userId),
        this.checkWaterWeek(userId),
        this.checkProteinPro(userId),
        this.checkCalorieMaster(userId),
        this.checkTripleCrown(userId),
        this.checkQualityStreak(userId),
        this.checkEarlyBird(userId),
        this.checkPhotoFoodie(userId),
        this.checkNightOwl(userId),
        this.checkCenturion(userId),
        this.checkWeekComplete(userId),
      ]),
    ]);

    const alreadyEarnedSet = new Set(alreadyEarned.map((a) => a.achievementKey));
    const newKeys = checks.flat().filter((k): k is AchievementKey => k !== null && !alreadyEarnedSet.has(k));
    if (newKeys.length === 0) return;

    await this.prisma.userAchievement.createMany({
      data: newKeys.map((key) => ({ userId, achievementKey: key })),
    });
  }

  // ─── Internal helpers ────────────────────────────────────────────────────────

  private async persistAndReturn(
    userId: string,
    alreadyEarned: { achievementKey: string }[],
    checks: AchievementKey[][],
  ): Promise<AchievementDto[]> {
    const alreadyEarnedSet = new Set(alreadyEarned.map((a) => a.achievementKey));
    const unlocked = checks.flat().filter((k): k is AchievementKey => k !== null);
    const newKeys = unlocked.filter((k) => !alreadyEarnedSet.has(k));

    if (newKeys.length === 0) return [];

    const earnedAt = new Date();

    await this.prisma.userAchievement.createMany({
      data: newKeys.map((key) => ({ userId, achievementKey: key })),
    });

    return ACHIEVEMENTS
      .filter((def) => newKeys.includes(def.key))
      .map((def) => toDto(def, earnedAt));
  }

  // ─── Individual Checks ─────────────────────────────────────────────────────

  private async checkFirstLog(userId: string): Promise<AchievementKey[]> {
    const count = await this.prisma.diaryEntry.count({ where: { userId } });
    return count >= 1 ? [AchievementKey.FIRST_LOG] : [];
  }

  private async checkStreaks(userId: string): Promise<AchievementKey[]> {
    const rows = await this.prisma.diaryEntry.findMany({
      where: { userId },
      select: { date: true },
      distinct: ['date'],
      orderBy: { date: 'desc' },
    });

    const dates = rows.map((r) => r.date);
    const best = computeBestStreak(dates);

    const keys: AchievementKey[] = [];
    if (best >= 7) keys.push(AchievementKey.PERFECT_WEEK);
    if (best >= 14) keys.push(AchievementKey.STREAK_14);
    if (best >= 21) keys.push(AchievementKey.STREAK_21);
    if (best >= 30) keys.push(AchievementKey.MARATHON);
    return keys;
  }

  private async checkHydrationHero(userId: string): Promise<AchievementKey[]> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { waterGoalMl: true },
    });
    const goalMl = profile?.waterGoalMl ?? 2600;

    const groups = await this.prisma.hydrationEntry.groupBy({
      by: ['date'],
      where: { userId },
      _sum: { amountMl: true },
      having: { amountMl: { _sum: { gte: goalMl } } },
    });

    return groups.length >= 1 ? [AchievementKey.HYDRATION_HERO] : [];
  }

  private async checkWaterWeek(userId: string): Promise<AchievementKey[]> {
    const [profile, groups] = await Promise.all([
      this.prisma.userProfile.findUnique({
        where: { userId },
        select: { waterGoalMl: true },
      }),
      this.prisma.hydrationEntry.groupBy({
        by: ['date'],
        where: { userId },
        _sum: { amountMl: true },
        orderBy: { date: 'asc' },
      }),
    ]);

    const goalMl = profile?.waterGoalMl ?? 2600;
    const qualifyingDates = groups
      .filter((g) => (g._sum.amountMl ?? 0) >= goalMl)
      .map((g) => g.date);

    if (qualifyingDates.length < 7) return [];

    let streak = 1;
    for (let i = 1; i < qualifyingDates.length; i++) {
      const prev = new Date(qualifyingDates[i - 1]).getTime();
      const curr = new Date(qualifyingDates[i]).getTime();
      if (Math.round((curr - prev) / 86_400_000) === 1) {
        streak++;
        if (streak >= 7) return [AchievementKey.WATER_WEEK];
      } else {
        streak = 1;
      }
    }
    return [];
  }

  private async checkProteinPro(userId: string): Promise<AchievementKey[]> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { proteinGoalG: true },
    });
    const goalG = profile?.proteinGoalG ?? 150;

    const groups = await this.prisma.diaryEntry.groupBy({
      by: ['date'],
      where: { userId },
      _sum: { proteinG: true },
      having: { proteinG: { _sum: { gte: goalG } } },
    });

    return groups.length >= 1 ? [AchievementKey.PROTEIN_PRO] : [];
  }

  private async checkCalorieMaster(userId: string): Promise<AchievementKey[]> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { caloriesGoal: true },
    });
    const goal = profile?.caloriesGoal ?? 2200;

    const groups = await this.prisma.diaryEntry.groupBy({
      by: ['date'],
      where: { userId },
      _sum: { kcal: true },
    });

    const qualifying = groups.filter((g) => {
      const kcal = g._sum.kcal ?? 0;
      return Math.abs(kcal - goal) / goal <= 0.1;
    });

    return qualifying.length >= 3 ? [AchievementKey.CALORIE_MASTER] : [];
  }

  private async checkTripleCrown(userId: string): Promise<AchievementKey[]> {
    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    if (!profile) return [];

    const [diaryGroups, hydrationGroups] = await Promise.all([
      this.prisma.diaryEntry.groupBy({
        by: ['date'],
        where: { userId },
        _sum: { kcal: true, proteinG: true },
      }),
      this.prisma.hydrationEntry.groupBy({
        by: ['date'],
        where: { userId },
        _sum: { amountMl: true },
      }),
    ]);

    const hydrationByDate = new Map(
      hydrationGroups.map((g) => [g.date, g._sum.amountMl ?? 0]),
    );

    for (const group of diaryGroups) {
      const kcal = group._sum.kcal ?? 0;
      const protein = group._sum.proteinG ?? 0;
      const water = hydrationByDate.get(group.date) ?? 0;

      const calorieMet = Math.abs(kcal - profile.caloriesGoal) / profile.caloriesGoal <= 0.1;
      const proteinMet = protein >= profile.proteinGoalG;
      const waterMet = water >= profile.waterGoalMl;

      if (calorieMet && proteinMet && waterMet) return [AchievementKey.TRIPLE_CROWN];
    }
    return [];
  }

  private async checkQualityStreak(userId: string): Promise<AchievementKey[]> {
    const entries = await this.prisma.diaryEntry.findMany({
      where: { userId },
      select: { date: true, kcal: true, proteinG: true, carbsG: true, fatG: true },
    });

    const goodByDate = new Map<string, number>();
    for (const e of entries) {
      if (isGoodEntry(e.kcal, e.proteinG, e.carbsG, e.fatG)) {
        goodByDate.set(e.date, (goodByDate.get(e.date) ?? 0) + 1);
      }
    }

    return [...goodByDate.values()].some((count) => count >= 5) ? [AchievementKey.QUALITY_STREAK] : [];
  }

  private async checkEarlyBird(userId: string): Promise<AchievementKey[]> {
    const entries = await this.prisma.diaryEntry.findMany({
      where: { userId },
      select: { loggedAt: true },
    });
    const hasEarly = entries.some((e) => e.loggedAt.getUTCHours() < 8);
    return hasEarly ? [AchievementKey.EARLY_BIRD] : [];
  }

  private async checkPhotoFoodie(userId: string): Promise<AchievementKey[]> {
    const count = await this.prisma.diaryEntry.count({
      where: { userId, photoUri: { not: null } },
    });
    return count >= 5 ? [AchievementKey.PHOTO_FOODIE] : [];
  }

  private async checkNightOwl(userId: string): Promise<AchievementKey[]> {
    const entries = await this.prisma.diaryEntry.findMany({
      where: { userId },
      select: { loggedAt: true },
    });
    const count = entries.filter((e) => e.loggedAt.getUTCHours() >= 21).length;
    return count >= 3 ? [AchievementKey.NIGHT_OWL] : [];
  }

  private async checkCenturion(userId: string): Promise<AchievementKey[]> {
    const count = await this.prisma.diaryEntry.count({ where: { userId } });
    return count >= 100 ? [AchievementKey.CENTURION] : [];
  }

  private async checkWeekComplete(userId: string): Promise<AchievementKey[]> {
    const rows = await this.prisma.diaryEntry.findMany({
      where: { userId },
      select: { date: true },
      distinct: ['date'],
    });

    const dateSet = new Set(rows.map((r) => r.date));

    for (const dateStr of dateSet) {
      const date = new Date(dateStr);
      const dayOfWeek = date.getUTCDay();
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(date);
      monday.setUTCDate(date.getUTCDate() - daysFromMonday);

      let complete = true;
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setUTCDate(monday.getUTCDate() + i);
        if (!dateSet.has(d.toISOString().split('T')[0])) {
          complete = false;
          break;
        }
      }
      if (complete) return [AchievementKey.WEEK_COMPLETE];
    }
    return [];
  }
}
