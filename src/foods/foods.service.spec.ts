import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FoodsService } from './foods.service';
import { PrismaService } from '../prisma/prisma.service';

describe('FoodsService', () => {
  let service: FoodsService;

  const mockPrisma = {
    food: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FoodsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<FoodsService>(FoodsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and return a food item', async () => {
      const dto = {
        name: 'Chicken Breast',
        calories_per_100g: 165,
        protein_per_100g: 31,
        carbs_per_100g: 0,
        fat_per_100g: 3.6,
      };
      const created = { id: 'food-1', ...dto };
      mockPrisma.food.create.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(mockPrisma.food.create).toHaveBeenCalledWith({ data: dto });
      expect(result).toEqual(created);
    });
  });

  describe('findAll', () => {
    it('should return all foods without filter', async () => {
      const foods = [{ id: 'food-1', name: 'Apple' }, { id: 'food-2', name: 'Banana' }];
      mockPrisma.food.findMany.mockResolvedValue(foods);

      const result = await service.findAll();

      expect(mockPrisma.food.findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual(foods);
    });

    it('should filter foods by search term (case-insensitive)', async () => {
      const foods = [{ id: 'food-1', name: 'Chicken Breast' }];
      mockPrisma.food.findMany.mockResolvedValue(foods);

      const result = await service.findAll('chicken');

      expect(mockPrisma.food.findMany).toHaveBeenCalledWith({
        where: { name: { contains: 'chicken', mode: 'insensitive' } },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual(foods);
    });
  });

  describe('findById', () => {
    it('should return the food when found', async () => {
      const food = { id: 'food-1', name: 'Apple' };
      mockPrisma.food.findUnique.mockResolvedValue(food);

      const result = await service.findById('food-1');

      expect(mockPrisma.food.findUnique).toHaveBeenCalledWith({ where: { id: 'food-1' } });
      expect(result).toEqual(food);
    });

    it('should throw NotFoundException when food is not found', async () => {
      mockPrisma.food.findUnique.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
