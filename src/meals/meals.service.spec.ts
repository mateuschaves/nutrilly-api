import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MealsService } from './meals.service';
import { PrismaService } from '../prisma/prisma.service';

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

  // ── seedDefaultMeals ───────────────────────────────────────────

  describe('seedDefaultMeals', () => {
    it('should create 4 default meals for the user', async () => {
      mockPrisma.meal.createMany.mockResolvedValue({ count: 4 });

      await service.seedDefaultMeals('user-1');

      expect(mockPrisma.meal.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ userId: 'user-1', name: 'Breakfast' }),
          expect.objectContaining({ userId: 'user-1', name: 'Lunch' }),
          expect.objectContaining({ userId: 'user-1', name: 'Dinner' }),
          expect.objectContaining({ userId: 'user-1', name: 'Snacks' }),
        ]),
      });
    });

    it('should seed meals in correct sortOrder', async () => {
      mockPrisma.meal.createMany.mockResolvedValue({ count: 4 });

      await service.seedDefaultMeals('user-1');

      const { data } = mockPrisma.meal.createMany.mock.calls[0][0];
      expect(data[0].sortOrder).toBe(0);
      expect(data[1].sortOrder).toBe(1);
      expect(data[2].sortOrder).toBe(2);
      expect(data[3].sortOrder).toBe(3);
    });
  });

  // ── findAll ────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return all meals ordered by sortOrder', async () => {
      const meals = [
        { id: 'm1', name: 'Breakfast', icon: '🌅', sortOrder: 0 },
        { id: 'm2', name: 'Lunch', icon: '☀️', sortOrder: 1 },
      ];
      mockPrisma.meal.findMany.mockResolvedValue(meals);

      const result = await service.findAll('user-1');

      expect(result).toEqual(meals);
      expect(mockPrisma.meal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { sortOrder: 'asc' } }),
      );
    });

    it('should filter by userId', async () => {
      mockPrisma.meal.findMany.mockResolvedValue([]);
      await service.findAll('user-abc');
      expect(mockPrisma.meal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-abc' } }),
      );
    });
  });

  // ── create ─────────────────────────────────────────────────────

  describe('create', () => {
    it('should create a meal and return it', async () => {
      const created = { id: 'm-new', name: 'Pre-Workout', icon: '💪', sortOrder: 4 };
      mockPrisma.meal.create.mockResolvedValue(created);

      const result = await service.create('user-1', { name: 'Pre-Workout', icon: '💪', sortOrder: 4 });

      expect(result).toEqual(created);
      expect(mockPrisma.meal.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', name: 'Pre-Workout', icon: '💪', sortOrder: 4 },
        select: { id: true, name: true, icon: true, sortOrder: true },
      });
    });
  });

  // ── update ─────────────────────────────────────────────────────

  describe('update', () => {
    it('should throw NotFoundException when meal does not belong to user', async () => {
      mockPrisma.meal.findFirst.mockResolvedValue(null);

      await expect(service.update('user-1', 'bad-meal', { name: 'New Name' })).rejects.toThrow(NotFoundException);
      expect(mockPrisma.meal.update).not.toHaveBeenCalled();
    });

    it('should update and return the meal when ownership is confirmed', async () => {
      mockPrisma.meal.findFirst.mockResolvedValue({ id: 'm1', userId: 'user-1' });
      const updated = { id: 'm1', name: 'Updated Breakfast', icon: '🌅', sortOrder: 0 };
      mockPrisma.meal.update.mockResolvedValue(updated);

      const result = await service.update('user-1', 'm1', { name: 'Updated Breakfast' });

      expect(result).toEqual(updated);
      expect(mockPrisma.meal.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { name: 'Updated Breakfast' },
        select: { id: true, name: true, icon: true, sortOrder: true },
      });
    });
  });

  // ── remove ─────────────────────────────────────────────────────

  describe('remove', () => {
    it('should throw NotFoundException when meal does not belong to user', async () => {
      mockPrisma.meal.findFirst.mockResolvedValue(null);

      await expect(service.remove('user-1', 'ghost-meal')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.meal.delete).not.toHaveBeenCalled();
    });

    it('should delete meal when ownership is confirmed', async () => {
      mockPrisma.meal.findFirst.mockResolvedValue({ id: 'm1' });
      mockPrisma.meal.delete.mockResolvedValue({});

      await expect(service.remove('user-1', 'm1')).resolves.not.toThrow();
      expect(mockPrisma.meal.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
    });
  });
});
