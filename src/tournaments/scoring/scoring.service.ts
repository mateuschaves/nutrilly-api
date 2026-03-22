import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  MealScoringEvent,
  ScoringEvent,
  MealScoringPayload,
  DailyGoalPayload,
  WeightLossPayload,
  CaloriesBurnedPayload,
} from '../tournaments.types';
import { calculatePoints, getCurrentTime } from './scoring.helpers';

@Injectable()
export class TournamentScoringService {
  constructor(private prisma: PrismaService) {}

  /**
   * Process a meal-related scoring event only for the tournaments the user
   * explicitly selected when logging the meal.
   */
  async processMealScoringEvent(
    userId: string,
    event: MealScoringEvent,
    tournamentIds: string[],
  ): Promise<void> {
    if (!tournamentIds.length) return;

    const tournaments = await this.prisma.tournament.findMany({
      where: {
        id: { in: tournamentIds },
        status: 'ACTIVE',
        members: { some: { userId } },
      },
      include: { scoringRules: true },
    });

    for (const tournament of tournaments) {
      const rule = tournament.scoringRules.find((r) => r.type === event.type && r.enabled);
      if (!rule) continue;

      const points = calculatePoints(rule, event.payload);
      const payload = event.payload as MealScoringPayload;

      await this.prisma.tournamentActivity.create({
        data: {
          tournamentId: tournament.id,
          userId,
          type: event.type,
          label: rule.label,
          points,
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
        data: { points: { increment: points } },
      });

      await this.recalculatePositions(tournament.id);
    }
  }

  /**
   * Process an automatic scoring event (daily goals, water, weight, calories burned)
   * for all active tournaments the user belongs to.
   */
  async processScoringEvent(userId: string, event: ScoringEvent): Promise<void> {
    const tournaments = await this.prisma.tournament.findMany({
      where: { status: 'ACTIVE', members: { some: { userId } } },
      include: { scoringRules: true },
    });

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

      const time = getCurrentTime();

      const activityData: any = {
        tournamentId: tournament.id,
        userId,
        type: event.type,
        label: rule.label,
        points,
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
        data: { points: { increment: points } },
      });

      await this.recalculatePositions(tournament.id);
    }
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
