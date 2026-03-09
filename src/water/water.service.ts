import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWaterLogDto } from './dto/create-water-log.dto';
import { MealsService } from '../meals/meals.service';

@Injectable()
export class WaterService {
  constructor(
    private prisma: PrismaService,
    private mealsService: MealsService,
  ) {}

  async logWater(userId: string, dto: CreateWaterLogDto) {
    const log = await this.prisma.waterLog.create({
      data: { user_id: userId, amount_ml: dto.amount_ml },
    });

    await this.mealsService.updateDailySummary(userId, new Date());

    return log;
  }

  async getTodayTotal(userId: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const agg = await this.prisma.waterLog.aggregate({
      where: { user_id: userId, logged_at: { gte: start, lte: end } },
      _sum: { amount_ml: true },
    });

    return { total_ml: agg._sum.amount_ml || 0 };
  }
}
