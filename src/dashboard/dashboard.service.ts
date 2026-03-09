import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getTodayDashboard(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [goals, summary, waterAgg, lastMeal, streak] = await Promise.all([
      this.prisma.userGoal.findUnique({ where: { user_id: userId } }),
      this.prisma.dailySummary.findUnique({
        where: { user_id_date: { user_id: userId, date: today } },
      }),
      this.prisma.waterLog.aggregate({
        where: { user_id: userId, logged_at: { gte: today, lte: todayEnd } },
        _sum: { amount_ml: true },
      }),
      this.prisma.meal.findFirst({
        where: { user_id: userId },
        orderBy: { eaten_at: 'desc' },
        include: { items: { select: { calories: true } } },
      }),
      this.prisma.streak.findUnique({ where: { user_id: userId } }),
    ]);

    const caloriesConsumed = summary?.calories || 0;
    const caloriesGoal = goals?.calories_goal || 0;
    const caloriesRemaining = Math.max(0, caloriesGoal - caloriesConsumed);
    const caloriesProgress =
      caloriesGoal > 0 ? Math.min(100, (caloriesConsumed / caloriesGoal) * 100) : 0;

    const waterConsumed = waterAgg._sum.amount_ml || 0;
    const waterGoal = goals?.water_goal_ml || 0;
    const waterProgress = waterGoal > 0 ? Math.min(100, (waterConsumed / waterGoal) * 100) : 0;

    const lastMealCalories = lastMeal?.items.reduce((sum, i) => sum + i.calories, 0) || 0;

    const currentStreak = streak?.current_streak || 0;
    const bestStreak = streak?.best_streak || 0;
    const daysToRecord = Math.max(0, bestStreak - currentStreak);

    return {
      date: new Date().toISOString().split('T')[0],
      calories: {
        consumed: caloriesConsumed,
        goal: caloriesGoal,
        remaining: caloriesRemaining,
        progress_percent: Math.round(caloriesProgress * 10) / 10,
      },
      macros: {
        protein: {
          consumed: summary?.protein || 0,
          goal: goals?.protein_goal || 0,
        },
        carbs: {
          consumed: summary?.carbs || 0,
          goal: goals?.carbs_goal || 0,
        },
        fat: {
          consumed: summary?.fat || 0,
          goal: goals?.fat_goal || 0,
        },
      },
      hydration: {
        consumed_ml: waterConsumed,
        goal_ml: waterGoal,
        progress_percent: Math.round(waterProgress * 10) / 10,
      },
      last_meal: lastMeal
        ? {
            name: lastMeal.name,
            calories: Math.round(lastMealCalories * 10) / 10,
            eaten_at: lastMeal.eaten_at,
          }
        : null,
      streak: {
        current_streak: currentStreak,
        best_streak: bestStreak,
        days_to_record: daysToRecord,
      },
    };
  }
}
