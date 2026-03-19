import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UnitsService } from '../units/units.service';
import { EnergyUnit, WaterUnit } from '../units/units.types';
import { computeStreak } from './streak.utils';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private unitsService: UnitsService,
  ) {}

  async getDailySummary(userId: string, date: string) {
    if (!DATE_REGEX.test(date)) throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');

    const [units, profile, diaryAgg, hydrationAgg, lastEntry] = await Promise.all([
      this.unitsService.getUserUnits(userId),
      this.prisma.userProfile.findUnique({ where: { userId } }),
      this.prisma.diaryEntry.aggregate({
        where: { userId, date },
        _sum: { kcal: true, proteinG: true, carbsG: true, fatG: true },
      }),
      this.prisma.hydrationEntry.aggregate({
        where: { userId, date },
        _sum: { amountMl: true },
      }),
      this.prisma.diaryEntry.findFirst({
        where: { userId, date },
        orderBy: { loggedAt: 'desc' },
      }),
    ]);

    const energyUnit = units.energy as EnergyUnit;
    const waterUnit = units.water as WaterUnit;

    const totalKcal = diaryAgg._sum.kcal ?? 0;
    const totalProtein = diaryAgg._sum.proteinG ?? 0;
    const totalCarbs = diaryAgg._sum.carbsG ?? 0;
    const totalFat = diaryAgg._sum.fatG ?? 0;
    const totalWaterMl = hydrationAgg._sum.amountMl ?? 0;

    const caloriesGoal = profile?.caloriesGoal ?? 0;
    const waterGoalMl = profile?.waterGoalMl ?? 0;

    const hoursAgo = lastEntry
      ? Math.floor((Date.now() - lastEntry.loggedAt.getTime()) / 3_600_000)
      : 0;

    const streak = await this.computeStreak(userId, date);

    return {
      calories: {
        consumed: this.unitsService.convertEnergy(totalKcal, energyUnit),
        goal: this.unitsService.convertEnergy(caloriesGoal, energyUnit),
        unit: energyUnit,
      },
      macros: [
        { label: 'Protein', value: Math.round(totalProtein), unit: 'g', type: 'protein' },
        { label: 'Carbs',   value: Math.round(totalCarbs),   unit: 'g', type: 'carbs'   },
        { label: 'Fat',     value: Math.round(totalFat),     unit: 'g', type: 'fat'     },
      ],
      water: {
        consumed: this.unitsService.convertWater(totalWaterMl, waterUnit),
        goal: this.unitsService.convertWater(waterGoalMl, waterUnit),
        unit: waterUnit,
      },
      lastMeal: lastEntry
        ? {
            name: lastEntry.name,
            calories: this.unitsService.convertEnergy(lastEntry.kcal, energyUnit),
            unit: energyUnit,
            hoursAgo,
          }
        : null,
      streak,
    };
  }

  async computeStreak(userId: string, referenceDate: string): Promise<number> {
    const rows = await this.prisma.diaryEntry.findMany({
      where: { userId },
      select: { date: true },
      distinct: ['date'],
      orderBy: { date: 'desc' },
    });

    return computeStreak(
      rows.map((r) => r.date),
      referenceDate,
    );
  }
}
