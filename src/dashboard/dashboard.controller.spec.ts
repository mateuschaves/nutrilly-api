import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

describe('DashboardController', () => {
  let controller: DashboardController;

  const mockDashboardService = {
    getDailySummary: jest.fn(),
  };

  const mockUser = { id: 'user-123', email: 'test@example.com', name: 'Test' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useValue: mockDashboardService }],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getDailySummary() should call dashboardService.getDailySummary with userId and date', async () => {
    const summary = { calories: { consumed: 1840, goal: 2200, unit: 'kcal' }, streak: 14 };
    mockDashboardService.getDailySummary.mockResolvedValue(summary);

    const result = await controller.getDailySummary(mockUser, { date: '2025-03-15' });

    expect(mockDashboardService.getDailySummary).toHaveBeenCalledWith('user-123', '2025-03-15');
    expect(result).toEqual(summary);
  });
});
