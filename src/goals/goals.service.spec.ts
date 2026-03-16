import { Test, TestingModule } from '@nestjs/testing';
import { GoalsService } from './goals.service';
import { PrismaService } from '../prisma/prisma.service';

describe('GoalsService', () => {
  let service: GoalsService;

  const mockPrisma = {
    userGoal: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoalsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<GoalsService>(GoalsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('upsertGoals', () => {
    const dto = {
      calories_goal: 2000,
      protein_goal: 150,
      carbs_goal: 250,
      fat_goal: 65,
      water_goal_ml: 2000,
    };

    it('should create goals when none exist', async () => {
      const created = { id: 'goal-1', user_id: 'user-123', ...dto };
      mockPrisma.userGoal.upsert.mockResolvedValue(created);

      const result = await service.upsertGoals('user-123', dto);

      expect(mockPrisma.userGoal.upsert).toHaveBeenCalledWith({
        where: { user_id: 'user-123' },
        create: { user_id: 'user-123', ...dto },
        update: { ...dto },
      });
      expect(result).toEqual(created);
    });

    it('should update existing goals', async () => {
      const updatedDto = { ...dto, calories_goal: 2500 };
      const updated = { id: 'goal-1', user_id: 'user-123', ...updatedDto };
      mockPrisma.userGoal.upsert.mockResolvedValue(updated);

      const result = await service.upsertGoals('user-123', updatedDto);

      expect(result.calories_goal).toBe(2500);
    });
  });

  describe('getGoals', () => {
    it('should return goals for the user', async () => {
      const goals = { id: 'goal-1', user_id: 'user-123', calories_goal: 2000 };
      mockPrisma.userGoal.findUnique.mockResolvedValue(goals);

      const result = await service.getGoals('user-123');

      expect(mockPrisma.userGoal.findUnique).toHaveBeenCalledWith({ where: { user_id: 'user-123' } });
      expect(result).toEqual(goals);
    });

    it('should return null when no goals are set', async () => {
      mockPrisma.userGoal.findUnique.mockResolvedValue(null);

      const result = await service.getGoals('user-123');

      expect(result).toBeNull();
    });
  });
});
