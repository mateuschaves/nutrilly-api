import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MealsService } from './meals.service';
import { PrismaService } from '../prisma/prisma.service';

const USER_ID = 'user-1';
const MEAL_ID = 'meal-1';

describe('MealsService', () => {
  let service: MealsService;

  const mockPrisma = {
    meal: {
      createMany: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
    },
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

  // ─── seedDefaultMeals ────────────────────────────────────────────────────────

  describe('seedDefaultMeals', () => {
    it('should create 4 default meals for the user', async () => {
      mockPrisma.meal.createMany.mockResolvedValue({ count: 4 });

      await service.seedDefaultMeals(USER_ID);

      expect(mockPrisma.meal.createMany).toHaveBeenCalledTimes(1);
      const callArg = mockPrisma.meal.createMany.mock.calls[0][0];
      expect(callArg.data).toHaveLength(4);
      expect(callArg.data.every((m: { userId: string }) => m.userId === USER_ID)).toBe(true);
    });

    it('should seed Breakfast, Lunch, Dinner and Snacks in order', async () => {
      mockPrisma.meal.createMany.mockResolvedValue({ count: 4 });

      await service.seedDefaultMeals(USER_ID);

      const data = mockPrisma.meal.createMany.mock.calls[0][0].data;
      expect(data.map((m: { name: string }) => m.name)).toEqual(['Breakfast', 'Lunch', 'Dinner', 'Snacks']);
      expect(data.map((m: { sortOrder: number }) => m.sortOrder)).toEqual([0, 1, 2, 3]);
    });
  });

  // ─── findAll ─────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return meals ordered by sortOrder', async () => {
      const meals = [
        { id: 'meal-1', name: 'Breakfast', icon: '🌅', sortOrder: 0 },
        { id: 'meal-2', name: 'Lunch', icon: '☀️', sortOrder: 1 },
      ];
      mockPrisma.meal.findMany.mockResolvedValue(meals);

      const result = await service.findAll(USER_ID);

      expect(result).toEqual(meals);
      expect(mockPrisma.meal.findMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true, icon: true, sortOrder: true },
      });
    });

    it('should return empty array when user has no meals', async () => {
      mockPrisma.meal.findMany.mockResolvedValue([]);

      const result = await service.findAll(USER_ID);

      expect(result).toEqual([]);
    });
  });

  // ─── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = { name: 'Pre-Workout', icon: '💪', sortOrder: 4 };

    it('should create a meal and return it', async () => {
      const created = { id: MEAL_ID, ...dto };
      mockPrisma.meal.create.mockResolvedValue(created);

      const result = await service.create(USER_ID, dto);

      expect(result).toEqual(created);
      expect(mockPrisma.meal.create).toHaveBeenCalledWith({
        data: { userId: USER_ID, name: dto.name, icon: dto.icon, sortOrder: dto.sortOrder },
        select: { id: true, name: true, icon: true, sortOrder: true },
      });
    });
  });

  // ─── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should throw NotFoundException when meal does not belong to user', async () => {
      mockPrisma.meal.findFirst.mockResolvedValue(null);

      await expect(
        service.update(USER_ID, 'bad-meal', { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update and return meal when ownership confirmed', async () => {
      mockPrisma.meal.findFirst.mockResolvedValue({ id: MEAL_ID, userId: USER_ID });
      const updated = { id: MEAL_ID, name: 'Updated', icon: '🌅', sortOrder: 0 };
      mockPrisma.meal.update.mockResolvedValue(updated);

      const result = await service.update(USER_ID, MEAL_ID, { name: 'Updated' });

      expect(result).toEqual(updated);
      expect(mockPrisma.meal.update).toHaveBeenCalledWith({
        where: { id: MEAL_ID },
        data: { name: 'Updated' },
        select: { id: true, name: true, icon: true, sortOrder: true },
      });
    });

    it('should verify ownership using userId+mealId scoping', async () => {
      mockPrisma.meal.findFirst.mockResolvedValue({ id: MEAL_ID });
      mockPrisma.meal.update.mockResolvedValue({ id: MEAL_ID, name: 'X', icon: '🍎', sortOrder: 0 });

      await service.update(USER_ID, MEAL_ID, { name: 'X' });

      expect(mockPrisma.meal.findFirst).toHaveBeenCalledWith({
        where: { id: MEAL_ID, userId: USER_ID },
      });
    });
  });

  // ─── remove ──────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should throw NotFoundException when meal does not belong to user', async () => {
      mockPrisma.meal.findFirst.mockResolvedValue(null);

      await expect(service.remove(USER_ID, 'bad-meal')).rejects.toThrow(NotFoundException);
    });

    it('should delete the meal when ownership is confirmed', async () => {
      mockPrisma.meal.findFirst.mockResolvedValue({ id: MEAL_ID });
      mockPrisma.meal.delete.mockResolvedValue({});

      await service.remove(USER_ID, MEAL_ID);

      expect(mockPrisma.meal.delete).toHaveBeenCalledWith({ where: { id: MEAL_ID } });
    });

    it('should NOT call delete when ownership check fails', async () => {
      mockPrisma.meal.findFirst.mockResolvedValue(null);

      await expect(service.remove(USER_ID, 'bad-meal')).rejects.toThrow();
      expect(mockPrisma.meal.delete).not.toHaveBeenCalled();
    });
  });
});
