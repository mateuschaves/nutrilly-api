import { Test, TestingModule } from '@nestjs/testing';
import { MealsService } from './meals.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('MealsService', () => {
  let service: MealsService;

  const mockPrisma = {
    food: { findUnique: jest.fn() },
    meal: { create: jest.fn(), findMany: jest.fn() },
    mealItem: { aggregate: jest.fn() },
    waterLog: { aggregate: jest.fn() },
    dailySummary: { upsert: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MealsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MealsService>(MealsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw NotFoundException if food not found', async () => {
    mockPrisma.food.findUnique.mockResolvedValue(null);

    await expect(
      service.create('user-123', {
        name: 'lunch',
        items: [{ foodId: 'non-existent', grams: 100 }],
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should calculate nutritional values proportionally to grams', async () => {
    mockPrisma.food.findUnique.mockResolvedValue({
      id: 'food-1',
      calories_per_100g: 165,
      protein_per_100g: 31,
      carbs_per_100g: 0,
      fat_per_100g: 3.6,
    });

    const mockMeal = {
      id: 'meal-1',
      user_id: 'user-123',
      name: 'lunch',
      eaten_at: new Date(),
      items: [],
    };

    mockPrisma.meal.create.mockResolvedValue(mockMeal);
    mockPrisma.mealItem.aggregate.mockResolvedValue({
      _sum: { calories: 330, protein: 62, carbs: 0, fat: 7.2 },
    });
    mockPrisma.waterLog.aggregate.mockResolvedValue({ _sum: { amount_ml: 0 } });
    mockPrisma.dailySummary.upsert.mockResolvedValue({});

    await service.create('user-123', {
      name: 'lunch',
      items: [{ foodId: 'food-1', grams: 200 }],
    });

    expect(mockPrisma.meal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          items: {
            create: [
              expect.objectContaining({
                calories: 330, // 165 * 2
                protein: 62,  // 31 * 2
                carbs: 0,
                fat: 7.2,     // 3.6 * 2
              }),
            ],
          },
        }),
      }),
    );
  });

  it('should update daily summary after creating a meal', async () => {
    mockPrisma.food.findUnique.mockResolvedValue({
      id: 'food-1',
      calories_per_100g: 100,
      protein_per_100g: 10,
      carbs_per_100g: 20,
      fat_per_100g: 5,
    });
    mockPrisma.meal.create.mockResolvedValue({ eaten_at: new Date(), items: [] });
    mockPrisma.mealItem.aggregate.mockResolvedValue({
      _sum: { calories: 100, protein: 10, carbs: 20, fat: 5 },
    });
    mockPrisma.waterLog.aggregate.mockResolvedValue({ _sum: { amount_ml: 500 } });
    mockPrisma.dailySummary.upsert.mockResolvedValue({});

    await service.create('user-123', {
      name: 'breakfast',
      items: [{ foodId: 'food-1', grams: 100 }],
    });

    expect(mockPrisma.dailySummary.upsert).toHaveBeenCalled();
  });
});
