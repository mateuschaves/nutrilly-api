import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMealDto } from './dto/create-meal.dto';
import { UpdateMealDto } from './dto/update-meal.dto';

@Injectable()
export class MealsService {
  constructor(private prisma: PrismaService) {}

  async seedDefaultMeals(userId: string) {
    const defaults = [
      { name: 'Breakfast', icon: '🌅', sortOrder: 0 },
      { name: 'Lunch',     icon: '☀️',  sortOrder: 1 },
      { name: 'Dinner',    icon: '🌙',  sortOrder: 2 },
      { name: 'Snacks',    icon: '🍎',  sortOrder: 3 },
    ];
    await this.prisma.meal.createMany({
      data: defaults.map((m) => ({ ...m, userId })),
    });
  }

  async findAll(userId: string) {
    return this.prisma.meal.findMany({
      where: { userId },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, icon: true, sortOrder: true },
    });
  }

  async create(userId: string, dto: CreateMealDto) {
    return this.prisma.meal.create({
      data: { userId, name: dto.name, icon: dto.icon, sortOrder: dto.sortOrder },
      select: { id: true, name: true, icon: true, sortOrder: true },
    });
  }

  async update(userId: string, mealId: string, dto: UpdateMealDto) {
    await this.assertOwnership(userId, mealId);
    return this.prisma.meal.update({
      where: { id: mealId },
      data: dto,
      select: { id: true, name: true, icon: true, sortOrder: true },
    });
  }

  async remove(userId: string, mealId: string) {
    await this.assertOwnership(userId, mealId);
    await this.prisma.meal.delete({ where: { id: mealId } });
  }

  private async assertOwnership(userId: string, mealId: string) {
    const meal = await this.prisma.meal.findFirst({ where: { id: mealId, userId } });
    if (!meal) throw new NotFoundException('Meal not found');
  }
}
