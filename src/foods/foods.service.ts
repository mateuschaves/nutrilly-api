import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFoodDto } from './dto/create-food.dto';

@Injectable()
export class FoodsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateFoodDto) {
    return this.prisma.food.create({ data: dto });
  }

  async findAll(search?: string) {
    return this.prisma.food.findMany({
      where: search ? { name: { contains: search, mode: 'insensitive' } } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const food = await this.prisma.food.findUnique({ where: { id } });
    if (!food) throw new NotFoundException('Food not found');
    return food;
  }
}
