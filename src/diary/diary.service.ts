import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UnitsService } from '../units/units.service';
import { CreateDiaryEntryDto } from './dto/create-diary-entry.dto';
import { EnergyUnit } from '../units/units.types';
import { EntryQuality } from './diary.types';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Classifies a diary entry based on macronutrient caloric distribution.
 *
 * Thresholds (% of macronutrient calories):
 *   good  — protein ≥ 25% AND fat ≤ 35%
 *   poor  — protein < 15% OR fat > 45%
 *   fair  — everything in between
 *   null  — entry has no calories (unclassifiable)
 */
function classifyEntry(
  kcal: number,
  proteinG: number,
  carbsG: number,
  fatG: number,
): EntryQuality | null {
  const macroCals = proteinG * 4 + carbsG * 4 + fatG * 9;
  if (kcal === 0 || macroCals === 0) return null;

  const proteinPct = (proteinG * 4 / macroCals) * 100;
  const fatPct     = (fatG * 9     / macroCals) * 100;

  if (proteinPct < 15 || fatPct > 45) return EntryQuality.Poor;
  if (proteinPct >= 25 && fatPct <= 35) return EntryQuality.Good;
  return EntryQuality.Fair;
}

function formatTime(date: Date): string {
  const h = date.getHours() % 12 || 12;
  const m = date.getMinutes().toString().padStart(2, '0');
  const ampm = date.getHours() >= 12 ? 'PM' : 'AM';
  return `${h}:${m} ${ampm}`;
}

@Injectable()
export class DiaryService {
  constructor(
    private prisma: PrismaService,
    private unitsService: UnitsService,
  ) {}

  async getByDate(userId: string, date: string) {
    if (!DATE_REGEX.test(date)) throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');

    const [meals, entries, units] = await Promise.all([
      this.prisma.meal.findMany({ where: { userId }, orderBy: { sortOrder: 'asc' } }),
      this.prisma.diaryEntry.findMany({
        where: { userId, date },
        orderBy: { loggedAt: 'asc' },
      }),
      this.unitsService.getUserUnits(userId),
    ]);

    const energyUnit = units.energy as EnergyUnit;
    const energyUnitLabel = energyUnit === 'kj' ? 'kJ' : 'kcal';

    return meals.map((meal) => {
      const mealEntries = entries.filter((e) => e.mealId === meal.id);
      const totalKcal = mealEntries.reduce((sum, e) => sum + e.kcal, 0);

      return {
        mealId: meal.id,
        mealName: meal.name,
        mealIcon: meal.icon,
        sortOrder: meal.sortOrder,
        totalCalories: this.unitsService.convertEnergy(totalKcal, energyUnit),
        energyUnit: energyUnitLabel,
        entries: mealEntries.map((e) => ({
          id: e.id,
          name: e.name,
          calories: this.unitsService.convertEnergy(e.kcal, energyUnit),
          energyUnit: energyUnitLabel,
          protein: e.proteinG,
          carbs: e.carbsG,
          fat: e.fatG,
          portion: e.portion,
          time: formatTime(e.loggedAt),
          photoUri: e.photoUri,
          quality: classifyEntry(e.kcal, e.proteinG, e.carbsG, e.fatG),
        })),
      };
    });
  }

  async addEntry(userId: string, date: string, mealId: string, dto: CreateDiaryEntryDto) {
    if (!DATE_REGEX.test(date)) throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');

    const meal = await this.prisma.meal.findFirst({ where: { id: mealId, userId } });
    if (!meal) throw new NotFoundException('Meal not found');

    const [entry, units] = await Promise.all([
      this.prisma.diaryEntry.create({
        data: {
          userId,
          mealId,
          date,
          name: dto.name,
          kcal: dto.kcal,
          proteinG: dto.proteinG,
          carbsG: dto.carbsG,
          fatG: dto.fatG,
          portion: dto.portion,
          photoUri: dto.photoUri ?? null,
        },
      }),
      this.unitsService.getUserUnits(userId),
    ]);

    const energyUnit = units.energy as EnergyUnit;
    const energyUnitLabel = energyUnit === 'kj' ? 'kJ' : 'kcal';

    return {
      id: entry.id,
      name: entry.name,
      calories: this.unitsService.convertEnergy(entry.kcal, energyUnit),
      energyUnit: energyUnitLabel,
      protein: entry.proteinG,
      carbs: entry.carbsG,
      fat: entry.fatG,
      portion: entry.portion,
      time: formatTime(entry.loggedAt),
      photoUri: entry.photoUri,
      quality: classifyEntry(entry.kcal, entry.proteinG, entry.carbsG, entry.fatG),
    };
  }

  async removeEntry(userId: string, date: string, mealId: string, entryId: string) {
    if (!DATE_REGEX.test(date)) throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');

    const entry = await this.prisma.diaryEntry.findFirst({
      where: { id: entryId, userId, mealId, date },
    });
    if (!entry) throw new NotFoundException('Diary entry not found');

    await this.prisma.diaryEntry.delete({ where: { id: entryId } });
  }
}
