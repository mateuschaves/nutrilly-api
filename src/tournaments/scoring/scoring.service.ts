import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  MealScoringEvent,
  ScoringEvent,
  MealScoringPayload,
  DailyGoalPayload,
  WeightLossPayload,
  CaloriesBurnedPayload,
  ScoringResult,
} from '../tournaments.types';
import { calculatePoints, getCurrentTime, getPeriodWindow } from './scoring.helpers';

@Injectable()
export class TournamentScoringService {
  constructor(private prisma: PrismaService) {}

  private async getPointsInPeriod(
    tournamentId: string,
    userId: string,
    period: string,
  ): Promise<number> {
    const { start, end } = getPeriodWindow(period);

    const result = await this.prisma.tournamentActivity.aggregate({
      where: {
        tournamentId,
        userId,
        points: { gt: 0 },
        createdAt: { gte: start, lte: end },
      },
      _sum: { points: true },
    });

    return result._sum.points ?? 0;
  }

  private async checkScoreLimit(
    tournament: any,
    userId: string,
    pointsToAdd: number,
  ): Promise<{ allowed: boolean; effectivePoints: number }> {
    if (!tournament.scoreLimitEnabled || pointsToAdd <= 0) {
      return { allowed: true, effectivePoints: pointsToAdd };
    }

    const accumulated = await this.getPointsInPeriod(tournament.id, userId, tournament.scoreLimitPeriod);

    if (accumulated >= tournament.scoreLimitMaxPts) {
      return { allowed: false, effectivePoints: 0 };
    }

    return { allowed: true, effectivePoints: pointsToAdd };
  }

  /**
   * Process a meal-related scoring event only for the tournaments the user
   * explicitly selected when logging the meal.
   */
  async processMealScoringEvent(
    userId: string,
    event: MealScoringEvent,
    tournamentIds: string[],
  ): Promise<ScoringResult[]> {
    if (!tournamentIds.length) return [];

    const tournaments = await this.prisma.tournament.findMany({
      where: {
        id: { in: tournamentIds },
        status: 'ACTIVE',
        members: { some: { userId } },
      },
      include: { scoringRules: true },
    });

    const results: ScoringResult[] = [];

    for (const tournament of tournaments) {
      const rule = tournament.scoringRules.find((r) => r.type === event.type && r.enabled);
      if (!rule) continue;

      const points = calculatePoints(rule, event.payload);
      const { allowed, effectivePoints } = await this.checkScoreLimit(tournament, userId, points);

      if (!allowed) {
        results.push({ tournamentId: tournament.id, points: 0, limitReached: true });
        continue;
      }

      const payload = event.payload as MealScoringPayload;

      await this.prisma.tournamentActivity.create({
        data: {
          tournamentId: tournament.id,
          userId,
          type: event.type,
          label: rule.label,
          points: effectivePoints,
          emoji: rule.emoji,
          date: payload.date,
          time: payload.time,
          calories: payload.kcal,
          mealName: payload.mealName,
          protein: payload.proteinG,
          carbs: payload.carbsG,
          fat: payload.fatG,
        },
      });

      await this.prisma.tournamentMember.updateMany({
        where: { tournamentId: tournament.id, userId },
        data: { points: { increment: effectivePoints } },
      });

      await this.recalculatePositions(tournament.id);
      results.push({ tournamentId: tournament.id, points: effectivePoints, limitReached: false });
    }

    return results;
  }

  /**
   * Process an automatic scoring event (daily goals, water, weight, calories burned)
   * for all active tournaments the user belongs to.
   */
  async processScoringEvent(userId: string, event: ScoringEvent): Promise<ScoringResult[]> {
    const tournaments = await this.prisma.tournament.findMany({
      where: { status: 'ACTIVE', members: { some: { userId } } },
      include: { scoringRules: true },
    });

    const results: ScoringResult[] = [];

    for (const tournament of tournaments) {
      const rule = tournament.scoringRules.find((r) => r.type === event.type && r.enabled);
      if (!rule) continue;

      const date =
        event.type === 'WEIGHT_LOSS' || event.type === 'CALORIES_BURNED'
          ? (event.payload as WeightLossPayload | CaloriesBurnedPayload).date
          : (event.payload as DailyGoalPayload).date;

      // Avoid double-scoring idempotent events on the same day
      if (event.type === 'DAILY_GOAL_MET' || event.type === 'WATER_GOAL_MET') {
        const existing = await this.prisma.tournamentActivity.findFirst({
          where: { tournamentId: tournament.id, userId, type: event.type, date },
        });
        if (existing) continue;
      }

      const points = calculatePoints(rule, event.payload);
      if (points === 0) continue;

      const { allowed, effectivePoints } = await this.checkScoreLimit(tournament, userId, points);

      if (!allowed) {
        results.push({ tournamentId: tournament.id, points: 0, limitReached: true });
        continue;
      }

      const time = getCurrentTime();

      const activityData: any = {
        tournamentId: tournament.id,
        userId,
        type: event.type,
        label: rule.label,
        points: effectivePoints,
        emoji: rule.emoji,
        date,
        time,
      };

      if (event.type === 'WEIGHT_LOSS') {
        const p = event.payload as WeightLossPayload;
        activityData.weightKg = p.weightKg;
      } else if (event.type === 'CALORIES_BURNED') {
        const p = event.payload as CaloriesBurnedPayload;
        activityData.caloriesBurned = p.caloriesBurned;
      }

      await this.prisma.tournamentActivity.create({ data: activityData });

      await this.prisma.tournamentMember.updateMany({
        where: { tournamentId: tournament.id, userId },
        data: { points: { increment: effectivePoints } },
      });

      await this.recalculatePositions(tournament.id);
      results.push({ tournamentId: tournament.id, points: effectivePoints, limitReached: false });
    }

    return results;
  }

  async recalculatePositions(tournamentId: string): Promise<void> {
    const members = await this.prisma.tournamentMember.findMany({
      where: { tournamentId },
      orderBy: [{ points: 'desc' }, { joinedAt: 'asc' }],
    });

    await Promise.all(
      members.map((m, index) =>
        this.prisma.tournamentMember.update({
          where: { id: m.id },
          data: { position: index + 1 },
        }),
      ),
    );
  }
}
