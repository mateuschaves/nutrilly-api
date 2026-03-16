import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UnitsService } from '../units/units.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUnitsDto } from './dto/update-units.dto';

@Injectable()
export class ProfileService {
  constructor(
    private prisma: PrismaService,
    private unitsService: UnitsService,
  ) {}

  async getProfile(userId: string) {
    const [user, profile, units] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.userProfile.findUnique({ where: { userId } }),
      this.unitsService.getUserUnits(userId),
    ]);

    const caloriesGoal = profile?.caloriesGoal ?? 2200;
    const waterGoalMl = profile?.waterGoalMl ?? 2600;

    return {
      name: user.name,
      email: user.email,
      birthdate: profile?.birthdate ?? null,
      sex: profile?.sex ?? null,
      weightKg: profile?.weightKg ?? null,
      heightCm: profile?.heightCm ?? null,
      goal: profile?.goal ?? null,
      activityLevel: profile?.activityLevel ?? null,
      dailyGoals: {
        calories: {
          value: this.unitsService.convertEnergy(caloriesGoal, units.energy),
          unit: units.energy,
        },
        proteinG: profile?.proteinGoalG ?? 150,
        carbsG: profile?.carbsGoalG ?? 250,
        fatG: profile?.fatGoalG ?? 70,
        water: {
          value: this.unitsService.convertWater(waterGoalMl, units.water),
          unit: units.water,
        },
      },
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const ops: Promise<unknown>[] = [];

    if (dto.name) {
      ops.push(this.prisma.user.update({ where: { id: userId }, data: { name: dto.name } }));
    }

    const profileData: Record<string, unknown> = {};
    if (dto.birthdate !== undefined) profileData.birthdate = dto.birthdate;
    if (dto.sex !== undefined) profileData.sex = dto.sex;
    if (dto.weightKg !== undefined) profileData.weightKg = dto.weightKg;
    if (dto.heightCm !== undefined) profileData.heightCm = dto.heightCm;
    if (dto.goal !== undefined) profileData.goal = dto.goal;
    if (dto.activityLevel !== undefined) profileData.activityLevel = dto.activityLevel;
    if (dto.dailyGoals?.calories !== undefined) profileData.caloriesGoal = dto.dailyGoals.calories;
    if (dto.dailyGoals?.waterMl !== undefined) profileData.waterGoalMl = dto.dailyGoals.waterMl;

    if (Object.keys(profileData).length > 0) {
      ops.push(
        this.prisma.userProfile.upsert({
          where: { userId },
          create: { userId, ...profileData },
          update: profileData,
        }),
      );
    }

    await Promise.all(ops);
    return this.getProfile(userId);
  }

  async getUnits(userId: string) {
    return this.unitsService.getUserUnits(userId);
  }

  async updateUnits(userId: string, dto: UpdateUnitsDto) {
    const data: Record<string, string> = {};
    if (dto.energy !== undefined) data.energy = dto.energy;
    if (dto.water !== undefined) data.water = dto.water;
    if (dto.weight !== undefined) data.weight = dto.weight;
    if (dto.height !== undefined) data.height = dto.height;

    await this.prisma.userUnitPreferences.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });

    return this.unitsService.getUserUnits(userId);
  }
}
