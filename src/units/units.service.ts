import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EnergyUnit, WaterUnit, WeightUnit, UserUnits } from './units.types';

const KCAL_TO_KJ = 4.184;
const LITERS_TO_FLOZ = 33.814;
const KG_TO_LBS = 2.20462;

@Injectable()
export class UnitsService {
  constructor(private prisma: PrismaService) {}

  async getUserUnits(userId: string): Promise<UserUnits> {
    const prefs = await this.prisma.userUnitPreferences.findUnique({
      where: { userId },
    });
    return {
      energy: (prefs?.energy ?? 'kcal') as UserUnits['energy'],
      water: (prefs?.water ?? 'l') as UserUnits['water'],
      weight: (prefs?.weight ?? 'kg') as UserUnits['weight'],
      height: (prefs?.height ?? 'cm') as UserUnits['height'],
    };
  }

  convertEnergy(kcal: number, unit: EnergyUnit): number {
    return unit === 'kj'
      ? Math.round(kcal * KCAL_TO_KJ)
      : Math.round(kcal);
  }

  convertWater(ml: number, unit: WaterUnit): number {
    const liters = ml / 1000;
    return unit === 'fl_oz'
      ? Math.round(liters * LITERS_TO_FLOZ * 100) / 100
      : Math.round(liters * 100) / 100;
  }

  convertWeight(kg: number, unit: WeightUnit): number {
    return unit === 'lbs'
      ? Math.round(kg * KG_TO_LBS * 10) / 10
      : Math.round(kg * 10) / 10;
  }
}
