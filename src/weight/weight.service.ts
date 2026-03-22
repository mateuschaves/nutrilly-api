import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TournamentScoringService } from '../tournaments/scoring/scoring.service';
import { LogWeightDto } from './dto/log-weight.dto';

@Injectable()
export class WeightService {
  constructor(
    private prisma: PrismaService,
    private scoring: TournamentScoringService,
  ) {}

  async logWeight(userId: string, dto: LogWeightDto) {
    const previous = await this.prisma.weightLog.findFirst({
      where: { userId },
      orderBy: { loggedAt: 'desc' },
      select: { weightKg: true },
    });

    const entry = await this.prisma.weightLog.create({
      data: {
        userId,
        weightKg: dto.weightKg,
        source: dto.source,
        ...(dto.loggedAt ? { loggedAt: new Date(dto.loggedAt) } : {}),
      },
    });

    // Fire WEIGHT_LOSS scoring if weight decreased
    if (previous && dto.weightKg < previous.weightKg) {
      const date = entry.loggedAt.toISOString().split('T')[0];
      await this.scoring.processScoringEvent(userId, {
        type: 'WEIGHT_LOSS',
        payload: { weightKg: dto.weightKg, previousWeightKg: previous.weightKg, date },
      });
    }

    return {
      id: entry.id,
      weightKg: entry.weightKg,
      source: entry.source,
      loggedAt: entry.loggedAt.toISOString(),
    };
  }
}
