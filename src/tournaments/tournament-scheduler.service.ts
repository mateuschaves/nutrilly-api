import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TournamentSchedulerService {
  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async updateTournamentStatuses(): Promise<void> {
    const now = new Date();

    await this.prisma.tournament.updateMany({
      where: { status: 'UPCOMING', startDate: { lte: now } },
      data: { status: 'ACTIVE' },
    });

    await this.prisma.tournament.updateMany({
      where: { status: 'ACTIVE', endDate: { lt: now }, NOT: { endDate: null } },
      data: { status: 'ENDED' },
    });
  }
}
