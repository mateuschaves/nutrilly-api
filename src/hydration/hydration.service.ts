import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UnitsService } from '../units/units.service';
import { AchievementsService } from '../achievements/achievements.service';
import { CreateHydrationEntryDto } from './dto/create-hydration-entry.dto';
import { WaterUnit } from '../units/units.types';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class HydrationService {
  constructor(
    private prisma: PrismaService,
    private unitsService: UnitsService,
    private achievements: AchievementsService,
  ) {}

  async getByDate(userId: string, date: string) {
    if (!DATE_REGEX.test(date)) throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');

    const [entries, units, profile] = await Promise.all([
      this.prisma.hydrationEntry.findMany({
        where: { userId, date },
        orderBy: { loggedAt: 'asc' },
        select: { id: true, amountMl: true, loggedAt: true },
      }),
      this.unitsService.getUserUnits(userId),
      this.prisma.userProfile.findUnique({ where: { userId }, select: { waterGoalMl: true } }),
    ]);

    const waterUnit = units.water as WaterUnit;
    const totalMl = entries.reduce((sum, e) => sum + e.amountMl, 0);
    const waterGoalMl = profile?.waterGoalMl ?? 2600;

    return {
      entries,
      totalConsumed: this.unitsService.convertWater(totalMl, waterUnit),
      goal: this.unitsService.convertWater(waterGoalMl, waterUnit),
      unit: waterUnit,
    };
  }

  async addEntry(userId: string, date: string, dto: CreateHydrationEntryDto) {
    if (!DATE_REGEX.test(date)) throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');

    const entry = await this.prisma.hydrationEntry.create({
      data: { userId, date, amountMl: dto.amountMl },
      select: { id: true, amountMl: true, loggedAt: true },
    });

    const newAchievements = await this.achievements.evaluateForHydration(userId);

    return { ...entry, newAchievements };
  }

  async removeEntry(userId: string, date: string, entryId: string) {
    if (!DATE_REGEX.test(date)) throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');

    const entry = await this.prisma.hydrationEntry.findFirst({
      where: { id: entryId, userId, date },
    });
    if (!entry) throw new NotFoundException('Hydration entry not found');

    await this.prisma.hydrationEntry.delete({ where: { id: entryId } });
  }
}
