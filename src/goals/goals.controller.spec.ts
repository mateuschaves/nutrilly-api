import { Test, TestingModule } from '@nestjs/testing';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';

describe('GoalsController', () => {
  let controller: GoalsController;

  const mockGoalsService = {
    upsertGoals: jest.fn(),
    getGoals: jest.fn(),
  };

  const mockReq = { user: { id: 'user-123' } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GoalsController],
      providers: [{ provide: GoalsService, useValue: mockGoalsService }],
    }).compile();

    controller = module.get<GoalsController>(GoalsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('upsert() should call goalsService.upsertGoals with userId and dto', async () => {
    const dto = { calories_goal: 2000, protein_goal: 150, carbs_goal: 250, fat_goal: 65, water_goal_ml: 2000 };
    const saved = { id: 'goal-1', user_id: 'user-123', ...dto };
    mockGoalsService.upsertGoals.mockResolvedValue(saved);

    const result = await controller.upsert(mockReq, dto);

    expect(mockGoalsService.upsertGoals).toHaveBeenCalledWith('user-123', dto);
    expect(result).toEqual(saved);
  });

  it('get() should call goalsService.getGoals with userId', async () => {
    const goals = { id: 'goal-1', user_id: 'user-123', calories_goal: 2000 };
    mockGoalsService.getGoals.mockResolvedValue(goals);

    const result = await controller.get(mockReq);

    expect(mockGoalsService.getGoals).toHaveBeenCalledWith('user-123');
    expect(result).toEqual(goals);
  });
});
