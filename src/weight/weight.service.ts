import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LogWeightDto } from './dto/log-weight.dto';

@Injectable()
export class WeightService {
  constructor(private prisma: PrismaService) {}

  async logWeight(userId: string, dto: LogWeightDto) {
    const entry = await this.prisma.weightLog.create({
      data: {
        userId,
        weightKg: dto.weightKg,
        source: dto.source,
        ...(dto.loggedAt ? { loggedAt: new Date(dto.loggedAt) } : {}),
      },
    });

    return {
      id: entry.id,
      weightKg: entry.weightKg,
      source: entry.source,
      loggedAt: entry.loggedAt.toISOString(),
    };
  }
}
