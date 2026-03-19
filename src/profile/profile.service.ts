import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UnitsService } from '../units/units.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUnitsDto } from './dto/update-units.dto';
import { WeightUnit, HeightUnit } from '../units/units.types';

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

  async getProfileScreen(userId: string) {
    const today = new Date().toISOString().slice(0, 10);

    const [user, profile, units, weightLogs, diaryEntries, hydrationEntries] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.userProfile.findUnique({ where: { userId } }),
      this.unitsService.getUserUnits(userId),
      this.prisma.weightLog.findMany({
        where: { userId },
        orderBy: { loggedAt: 'asc' },
      }),
      this.prisma.diaryEntry.findMany({ where: { userId, date: today } }),
      this.prisma.hydrationEntry.findMany({ where: { userId, date: today } }),
    ]);

    const caloriesGoal = profile?.caloriesGoal ?? 2200;
    const waterGoalMl = profile?.waterGoalMl ?? 2600;
    const proteinGoal = profile?.proteinGoalG ?? 150;

    // ── Body stats ───────────────────────────────────────────────
    const weightConverted = profile?.weightKg != null
      ? { value: this.unitsService.convertWeight(profile.weightKg, units.weight), unit: units.weight }
      : null;

    const heightFormatted = profile?.heightCm != null
      ? this.formatHeight(profile.heightCm, units.height)
      : null;

    const age = profile?.birthdate ? this.calcAge(profile.birthdate) : null;

    const bmi =
      profile?.weightKg != null && profile?.heightCm != null
        ? Math.round((profile.weightKg / Math.pow(profile.heightCm / 100, 2)) * 10) / 10
        : null;

    // ── Weight progress ──────────────────────────────────────────
    const weightProgressEntries = weightLogs.map((log) => ({
      date: log.loggedAt.toISOString().slice(0, 10),
      value: this.unitsService.convertWeight(log.weightKg, units.weight),
      unit: units.weight,
    }));

    const weightProgressStats = this.calcWeightStats(weightLogs.map((l) => l.weightKg), units.weight);

    // ── Today's consumption ──────────────────────────────────────
    const caloriesConsumed = diaryEntries.reduce((sum, e) => sum + e.kcal, 0);
    const proteinConsumed = Math.round(diaryEntries.reduce((sum, e) => sum + e.proteinG, 0));
    const waterConsumedMl = hydrationEntries.reduce((sum, e) => sum + e.amountMl, 0);

    return {
      name: user.name,
      email: user.email,
      initials: this.buildInitials(user.name),
      goal: profile?.goal ?? null,
      bodyStats: {
        weight: weightConverted,
        height: heightFormatted,
        age,
        bmi,
      },
      weightProgress: {
        entries: weightProgressEntries,
        totalEntries: weightLogs.length,
        ...weightProgressStats,
      },
      dailyGoals: {
        calories: {
          consumed: this.unitsService.convertEnergy(caloriesConsumed, units.energy),
          goal: this.unitsService.convertEnergy(caloriesGoal, units.energy),
          unit: units.energy,
        },
        protein: {
          consumed: proteinConsumed,
          goal: Math.round(proteinGoal),
        },
        water: {
          consumed: this.unitsService.convertWater(waterConsumedMl, units.water),
          goal: this.unitsService.convertWater(waterGoalMl, units.water),
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

  // ── Private helpers ────────────────────────────────────────────

  private buildInitials(name: string): string {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');
  }

  private calcAge(birthdate: string): number {
    const birth = new Date(birthdate);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const notYet =
      now.getMonth() < birth.getMonth() ||
      (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
    if (notYet) age--;
    return age;
  }

  private formatHeight(cm: number, unit: HeightUnit) {
    if (unit === 'ft_in') {
      const totalInches = cm / 2.54;
      const feet = Math.floor(totalInches / 12);
      const inches = Math.round(totalInches % 12);
      return { cm: null, feet, inches, unit };
    }
    return { cm: Math.round(cm), feet: null, inches: null, unit };
  }

  private calcWeightStats(kgValues: number[], weightUnit: WeightUnit) {
    if (kgValues.length === 0) {
      return { min: null, max: null, change: null };
    }

    const converted = kgValues.map((kg) => this.unitsService.convertWeight(kg, weightUnit));
    const min = { value: Math.min(...converted), unit: weightUnit };
    const max = { value: Math.max(...converted), unit: weightUnit };

    const first = converted[0];
    const last = converted[converted.length - 1];
    const diff = Math.round(Math.abs(last - first) * 10) / 10;
    const direction: 'up' | 'down' | 'stable' = last > first ? 'up' : last < first ? 'down' : 'stable';
    const change = { value: diff, unit: weightUnit, direction };

    return { min, max, change };
  }
}
