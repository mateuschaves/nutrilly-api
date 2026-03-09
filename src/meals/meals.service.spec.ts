import { Test, TestingModule } from '@nestjs/testing';
import { MealsService } from './meals.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { NotFoundException } from '@nestjs/common';

describe('MealsService', () => {
  let service: MealsService;

  const mockPrisma = {
    food: { findUnique: jest.fn(), create: jest.fn() },
    meal: { create: jest.fn(), findMany: jest.fn() },
    mealItem: { aggregate: jest.fn() },
    waterLog: { aggregate: jest.fn() },
    dailySummary: { upsert: jest.fn() },
    suspiciousPhoto: { create: jest.fn() },
  };

  const mockS3Service = {
    getSignedPhotoUrl: jest.fn().mockResolvedValue('https://signed-url.example.com/photo.jpeg'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MealsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: S3Service, useValue: mockS3Service },
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
            photo_url: undefined,
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

    it('should store photo_url key and return presigned URL', async () => {
      const inferredMeal = {
        items: [
          {
            name: 'Pasta',
            grams: 200,
            calories_per_100g: 131,
            protein_per_100g: 5,
            carbs_per_100g: 25,
            fat_per_100g: 1.1,
          },
        ],
      };

      mockPrisma.food.create.mockResolvedValue({ id: 'food-ai-4' });
      mockPrisma.meal.create.mockResolvedValue({
        id: 'meal-photo-1',
        eaten_at: new Date(),
        photo_url: 'meals/user-123/photo.jpeg',
        items: [],
      });
      mockPrisma.mealItem.aggregate.mockResolvedValue({
        _sum: { calories: 262, protein: 10, carbs: 50, fat: 2.2 },
      });
      mockPrisma.waterLog.aggregate.mockResolvedValue({ _sum: { amount_ml: 0 } });
      mockPrisma.dailySummary.upsert.mockResolvedValue({});

      const photoKey = 'meals/user-123/photo.jpeg';
      const result = await service.createFromAI('user-123', 'lunch', undefined, inferredMeal, photoKey);

      expect(mockPrisma.meal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            photo_url: photoKey,
          }),
        }),
      );

      expect(mockS3Service.getSignedPhotoUrl).toHaveBeenCalledWith(photoKey);
      expect(result.photo_url).toBe('https://signed-url.example.com/photo.jpeg');
    });
  });

  describe('findUserMeals', () => {
    it('should resolve photo_url keys to presigned URLs', async () => {
      mockPrisma.meal.findMany.mockResolvedValue([
        {
          id: 'meal-1',
          user_id: 'user-123',
          name: 'lunch',
          photo_url: 'meals/user-123/photo.jpeg',
          eaten_at: new Date(),
          items: [],
        },
        {
          id: 'meal-2',
          user_id: 'user-123',
          name: 'dinner',
          photo_url: null,
          eaten_at: new Date(),
          items: [],
        },
      ]);

      const meals = await service.findUserMeals('user-123');

      expect(mockS3Service.getSignedPhotoUrl).toHaveBeenCalledTimes(1);
      expect(mockS3Service.getSignedPhotoUrl).toHaveBeenCalledWith('meals/user-123/photo.jpeg');
      expect(meals[0].photo_url).toBe('https://signed-url.example.com/photo.jpeg');
      expect(meals[1].photo_url).toBeNull();
    });
  });

  describe('flagSuspiciousPhoto', () => {
    it('should create a suspicious photo record', async () => {
      const moderation = {
        flagged: true,
        reason: 'Content flagged for: sexual, violence',
        categories: ['sexual', 'violence'],
      };

      mockPrisma.suspiciousPhoto.create.mockResolvedValue({
        id: 'flag-1',
        user_id: 'user-123',
        reason: moderation.reason,
        categories: 'sexual, violence',
        flagged_at: new Date(),
      });

      const result = await service.flagSuspiciousPhoto('user-123', moderation);

      expect(mockPrisma.suspiciousPhoto.create).toHaveBeenCalledWith({
        data: {
          user_id: 'user-123',
          reason: 'Content flagged for: sexual, violence',
          categories: 'sexual, violence',
        },
      });
      expect(result.user_id).toBe('user-123');
      expect(result.reason).toBe('Content flagged for: sexual, violence');
    });
  });
});
