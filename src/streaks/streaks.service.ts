import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StreaksService {
  private readonly logger = new Logger(StreaksService.name);

  constructor(private prisma: PrismaService) {}

  async getStreak(userId: string) {
    return this.prisma.streak.findUnique({ where: { user_id: userId } });
  }

  async checkAndUpdateStreak(userId: string) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const [goals, summary, streak] = await Promise.all([
      this.prisma.userGoal.findUnique({ where: { user_id: userId } }),
      this.prisma.dailySummary.findUnique({
        where: { user_id_date: { user_id: userId, date: yesterday } },
      }),
      this.prisma.streak.findUnique({ where: { user_id: userId } }),
    ]);

    if (!goals || !streak) return;

    if (summary && summary.calories >= goals.calories_goal * 0.9) {
      const newStreak = streak.current_streak + 1;
      const bestStreak = Math.max(newStreak, streak.best_streak);
      await this.prisma.streak.update({
        where: { user_id: userId },
        data: {
          current_streak: newStreak,
          best_streak: bestStreak,
          last_goal_hit_date: yesterday,
        },
      });
    } else {
      await this.prisma.streak.update({
        where: { user_id: userId },
        data: { current_streak: 0 },
      });
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async runDailyStreakCheck() {
    const batchSize = 100;
    let skip = 0;

    while (true) {
      const users = await this.prisma.user.findMany({
        select: { id: true },
        skip,
        take: batchSize,
      });

      if (users.length === 0) break;

      await Promise.all(
        users.map(async (u) => {
          try {
            await this.checkAndUpdateStreak(u.id);
          } catch (error) {
            this.logger.error(`Failed to update streak for user ${u.id}`, error);
          }
        }),
      );

      if (users.length < batchSize) break;
      skip += batchSize;
    }
  }
}
