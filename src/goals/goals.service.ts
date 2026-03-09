import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertGoalsDto } from './dto/upsert-goals.dto';

@Injectable()
export class GoalsService {
  constructor(private prisma: PrismaService) {}

  async upsertGoals(userId: string, dto: UpsertGoalsDto) {
    return this.prisma.userGoal.upsert({
      where: { user_id: userId },
      create: { user_id: userId, ...dto },
      update: { ...dto },
    });
  }

  async getGoals(userId: string) {
    return this.prisma.userGoal.findUnique({ where: { user_id: userId } });
  }
}
