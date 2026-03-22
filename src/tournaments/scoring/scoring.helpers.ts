import { TournamentScoringRule } from '@prisma/client';
import { MealScoringPayload, DailyGoalPayload, CaloriesBurnedPayload, WeightLossPayload, ScoreLimitPeriod } from '../tournaments.types';

export function getPeriodWindow(period: string): { start: Date; end: Date } {
  const now = new Date();

  if (period === ScoreLimitPeriod.DAY) {
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setUTCHours(23, 59, 59, 999);
    return { start, end };
  }

  if (period === ScoreLimitPeriod.WEEK) {
    // Week starts on Monday (ISO 8601)
    const day = now.getUTCDay(); // 0 = Sunday
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const start = new Date(now);
    start.setUTCDate(now.getUTCDate() + diffToMonday);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    end.setUTCHours(23, 59, 59, 999);
    return { start, end };
  }

  // MONTH
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { start, end };
}

export function getCurrentTime(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

export function getCurrentDate(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

export function calculatePoints(
  rule: TournamentScoringRule,
  payload: MealScoringPayload | DailyGoalPayload | CaloriesBurnedPayload | WeightLossPayload,
): number {
  switch (rule.type) {
    case 'CALORIES_BURNED': {
      const p = payload as CaloriesBurnedPayload;
      const units = Math.floor(p.caloriesBurned / 100);
      return units * rule.points;
    }
    case 'WEIGHT_LOSS': {
      const p = payload as WeightLossPayload;
      const lostKg = p.previousWeightKg - p.weightKg;
      if (lostKg <= 0) return 0;
      // Use integer math (×100 then round) to avoid floating-point drift.
      // e.g. 80 - 79.9 = 0.09999... → ×100 = 9.999... → round = 10 → ÷10 = 1 unit
      const units = Math.floor(Math.round(lostKg * 100) / 10);
      return units * rule.points;
    }
    default:
      return rule.points;
  }
}

/**
 * Detect if a meal qualifies as healthy (< 600kcal and macro balanced)
 * matching the same logic as diary entry quality classification.
 */
export function isHealthyMeal(kcal: number, proteinG: number, carbsG: number, fatG: number): boolean {
  if (kcal >= 600) return false;
  const macroCals = proteinG * 4 + carbsG * 4 + fatG * 9;
  if (macroCals === 0) return false;
  const proteinPct = (proteinG * 4 / macroCals) * 100;
  const fatPct = (fatG * 9 / macroCals) * 100;
  return proteinPct >= 25 && fatPct <= 35;
}
