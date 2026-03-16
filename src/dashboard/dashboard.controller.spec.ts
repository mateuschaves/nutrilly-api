import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

describe('DashboardController', () => {
  let controller: DashboardController;

  const mockDashboardService = {
    getTodayDashboard: jest.fn(),
    getDailySummary: jest.fn(),
  };

  const mockReq = { user: { id: 'user-123' } };

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

  it('getToday() should call dashboardService.getTodayDashboard with userId', async () => {
    const dashboard = { date: '2025-03-15', calories: { consumed: 1500, goal: 2000 } };
    mockDashboardService.getTodayDashboard.mockResolvedValue(dashboard);

    const result = await controller.getToday(mockReq);

    expect(mockDashboardService.getTodayDashboard).toHaveBeenCalledWith('user-123');
    expect(result).toEqual(dashboard);
  });

  it('getDailySummary() should call dashboardService.getDailySummary with userId and date', async () => {
    const summary = { calories: { consumed: 1840, goal: 2200, unit: 'kcal' }, streak: 14 };
    mockDashboardService.getDailySummary.mockResolvedValue(summary);

    const result = await controller.getDailySummary(mockReq, { date: '2025-03-15' });

    expect(mockDashboardService.getDailySummary).toHaveBeenCalledWith('user-123', '2025-03-15');
    expect(result).toEqual(summary);
  });
});
