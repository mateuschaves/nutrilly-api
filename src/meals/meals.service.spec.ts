import { Test, TestingModule } from '@nestjs/testing';
import { MealsService } from './meals.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('MealsService', () => {
  let service: MealsService;

  const mockPrisma = {
    food: { findUnique: jest.fn(), create: jest.fn() },
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

  describe('createFromAI', () => {
    it('should create food records and meal from AI-inferred macros', async () => {
      const inferredMeal = {
        items: [
          {
            name: 'Grilled Chicken',
            grams: 200,
            calories_per_100g: 165,
            protein_per_100g: 31,
            carbs_per_100g: 0,
            fat_per_100g: 3.6,
          },
          {
            name: 'Brown Rice',
            grams: 150,
            calories_per_100g: 112,
            protein_per_100g: 2.6,
            carbs_per_100g: 23.5,
            fat_per_100g: 0.9,
          },
        ],
      };

      mockPrisma.food.create
        .mockResolvedValueOnce({ id: 'food-ai-1' })
        .mockResolvedValueOnce({ id: 'food-ai-2' });

      const mockMeal = {
        id: 'meal-ai-1',
        user_id: 'user-123',
        name: 'lunch',
        eaten_at: new Date(),
        items: [],
      };

      mockPrisma.meal.create.mockResolvedValue(mockMeal);
      mockPrisma.mealItem.aggregate.mockResolvedValue({
        _sum: { calories: 498, protein: 65.9, carbs: 35.25, fat: 8.55 },
      });
      mockPrisma.waterLog.aggregate.mockResolvedValue({ _sum: { amount_ml: 0 } });
      mockPrisma.dailySummary.upsert.mockResolvedValue({});

      await service.createFromAI('user-123', 'lunch', undefined, inferredMeal);

      expect(mockPrisma.food.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.food.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'Grilled Chicken' }),
      });
      expect(mockPrisma.food.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'Brown Rice' }),
      });

      expect(mockPrisma.meal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            user_id: 'user-123',
            name: 'lunch',
            items: {
              create: [
                expect.objectContaining({
                  food_id: 'food-ai-1',
                  grams: 200,
                  calories: 330,
                  protein: 62,
                  carbs: 0,
                  fat: 7.2,
                }),
                expect.objectContaining({
                  food_id: 'food-ai-2',
                  grams: 150,
                  calories: 168,
                  protein: 3.9000000000000004,
                  carbs: 35.25,
                  fat: 1.35,
                }),
              ],
            },
          }),
        }),
      );

      expect(mockPrisma.dailySummary.upsert).toHaveBeenCalled();
    });

    it('should use provided eaten_at date', async () => {
      const inferredMeal = {
        items: [
          {
            name: 'Salad',
            grams: 100,
            calories_per_100g: 20,
            protein_per_100g: 1.5,
            carbs_per_100g: 3,
            fat_per_100g: 0.3,
          },
        ],
      };

      mockPrisma.food.create.mockResolvedValue({ id: 'food-ai-3' });
      mockPrisma.meal.create.mockResolvedValue({
        eaten_at: new Date('2024-03-01T12:00:00Z'),
        items: [],
      });
      mockPrisma.mealItem.aggregate.mockResolvedValue({
        _sum: { calories: 20, protein: 1.5, carbs: 3, fat: 0.3 },
      });
      mockPrisma.waterLog.aggregate.mockResolvedValue({ _sum: { amount_ml: 0 } });
      mockPrisma.dailySummary.upsert.mockResolvedValue({});

      await service.createFromAI(
        'user-123',
        'dinner',
        '2024-03-01T12:00:00Z',
        inferredMeal,
      );

      expect(mockPrisma.meal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eaten_at: new Date('2024-03-01T12:00:00Z'),
          }),
        }),
      );
    });
  });
});
