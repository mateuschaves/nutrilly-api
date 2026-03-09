import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMealDto } from './dto/create-meal.dto';
import { InferredMeal, ModerationResult } from '../openai/openai.service';

@Injectable()
export class MealsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateMealDto) {
    const mealItems = await Promise.all(
      dto.items.map(async (item) => {
        const food = await this.prisma.food.findUnique({ where: { id: item.foodId } });
        if (!food) throw new NotFoundException(`Food ${item.foodId} not found`);
        const factor = item.grams / 100;
        return {
          food_id: item.foodId,
          grams: item.grams,
          calories: food.calories_per_100g * factor,
          protein: food.protein_per_100g * factor,
          carbs: food.carbs_per_100g * factor,
          fat: food.fat_per_100g * factor,
        };
      }),
    );

    const meal = await this.prisma.meal.create({
      data: {
        user_id: userId,
        name: dto.name,
        eaten_at: dto.eaten_at ? new Date(dto.eaten_at) : new Date(),
        items: { create: mealItems },
      },
      include: { items: { include: { food: true } } },
    });

    await this.updateDailySummary(userId, meal.eaten_at);

    return meal;
  }

  async createFromAI(
    userId: string,
    mealName: string,
    eatenAt: string | undefined,
    inferredMeal: InferredMeal,
  ) {
    const eatenDate = eatenAt ? new Date(eatenAt) : new Date();

    const foodRecords = await Promise.all(
      inferredMeal.items.map((item) =>
        this.prisma.food.create({
          data: {
            name: item.name,
            calories_per_100g: item.calories_per_100g,
            protein_per_100g: item.protein_per_100g,
            carbs_per_100g: item.carbs_per_100g,
            fat_per_100g: item.fat_per_100g,
          },
        }),
      ),
    );

    const mealItems = inferredMeal.items.map((item, index) => {
      const factor = item.grams / 100;
      return {
        food_id: foodRecords[index].id,
        grams: item.grams,
        calories: item.calories_per_100g * factor,
        protein: item.protein_per_100g * factor,
        carbs: item.carbs_per_100g * factor,
        fat: item.fat_per_100g * factor,
      };
    });

    const meal = await this.prisma.meal.create({
      data: {
        user_id: userId,
        name: mealName,
        eaten_at: eatenDate,
        items: { create: mealItems },
      },
      include: { items: { include: { food: true } } },
    });

    await this.updateDailySummary(userId, meal.eaten_at);

    return meal;
  }

  async findUserMeals(userId: string) {
    return this.prisma.meal.findMany({
      where: { user_id: userId },
      include: { items: { include: { food: true } } },
      orderBy: { eaten_at: 'desc' },
    });
  }

  async updateDailySummary(userId: string, date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const [mealAgg, waterAgg] = await Promise.all([
      this.prisma.mealItem.aggregate({
        where: {
          meal: {
            user_id: userId,
            eaten_at: { gte: start, lte: end },
          },
        },
        _sum: { calories: true, protein: true, carbs: true, fat: true },
      }),
      this.prisma.waterLog.aggregate({
        where: {
          user_id: userId,
          logged_at: { gte: start, lte: end },
        },
        _sum: { amount_ml: true },
      }),
    ]);

    const dateOnly = new Date(start);

    await this.prisma.dailySummary.upsert({
      where: { user_id_date: { user_id: userId, date: dateOnly } },
      create: {
        user_id: userId,
        date: dateOnly,
        calories: mealAgg._sum.calories || 0,
        protein: mealAgg._sum.protein || 0,
        carbs: mealAgg._sum.carbs || 0,
        fat: mealAgg._sum.fat || 0,
        water_ml: waterAgg._sum.amount_ml || 0,
      },
      update: {
        calories: mealAgg._sum.calories || 0,
        protein: mealAgg._sum.protein || 0,
        carbs: mealAgg._sum.carbs || 0,
        fat: mealAgg._sum.fat || 0,
        water_ml: waterAgg._sum.amount_ml || 0,
      },
    });
  }

  async flagSuspiciousPhoto(
    userId: string,
    moderation: ModerationResult,
  ) {
    return this.prisma.suspiciousPhoto.create({
      data: {
        user_id: userId,
        reason: moderation.reason,
        categories: moderation.categories.join(', '),
      },
    });
  }
}
