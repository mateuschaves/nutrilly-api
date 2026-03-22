import { TournamentScoringRule } from '@prisma/client';
import { MealScoringPayload, DailyGoalPayload, CaloriesBurnedPayload, WeightLossPayload } from '../tournaments.types';

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
      const units = Math.floor(lostKg / 0.1);
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
