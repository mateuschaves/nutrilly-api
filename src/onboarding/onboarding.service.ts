import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';

@Injectable()
export class OnboardingService {
  constructor(private prisma: PrismaService) {}

  async completeOnboarding(userId: string, dto: CompleteOnboardingDto) {
    const waterGoalMl = Math.round(dto.dailyGoals.waterL * 1000);

    const profile = await this.prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        birthdate: dto.birthdate,
        sex: dto.sex,
        weightKg: dto.weightKg,
        heightCm: dto.heightCm,
        goal: dto.goal,
        activityLevel: dto.activityLevel,
        caloriesGoal: Math.round(dto.dailyGoals.calories),
        proteinGoalG: dto.dailyGoals.proteinG,
        carbsGoalG: dto.dailyGoals.carbsG,
        fatGoalG: dto.dailyGoals.fatG,
        waterGoalMl,
      },
      update: {
        birthdate: dto.birthdate,
        sex: dto.sex,
        weightKg: dto.weightKg,
        heightCm: dto.heightCm,
        goal: dto.goal,
        activityLevel: dto.activityLevel,
        caloriesGoal: Math.round(dto.dailyGoals.calories),
        proteinGoalG: dto.dailyGoals.proteinG,
        carbsGoalG: dto.dailyGoals.carbsG,
        fatGoalG: dto.dailyGoals.fatG,
        waterGoalMl,
      },
    });

    return {
      profile: {
        birthdate: profile.birthdate,
        sex: profile.sex,
        weightKg: profile.weightKg,
        heightCm: profile.heightCm,
        goal: profile.goal,
        activityLevel: profile.activityLevel,
        dailyGoals: {
          calories: profile.caloriesGoal,
          proteinG: profile.proteinGoalG,
          carbsG: profile.carbsGoalG,
          fatG: profile.fatGoalG,
          waterL: profile.waterGoalMl / 1000,
        },
      },
      onboardingCompleted: true,
    };
  }
}
