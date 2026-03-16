import { Test, TestingModule } from '@nestjs/testing';
import { WaterService } from './water.service';
import { PrismaService } from '../prisma/prisma.service';
import { MealsService } from '../meals/meals.service';

describe('WaterService', () => {
  let service: WaterService;

  const mockPrisma = {
    waterLog: {
      create: jest.fn(),
      aggregate: jest.fn(),
    },
  };

  const mockMealsService = {
    updateDailySummary: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaterService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MealsService, useValue: mockMealsService },
      ],
    }).compile();

    service = module.get<WaterService>(WaterService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('logWater', () => {
    it('should create a water log and trigger daily summary update', async () => {
      const log = { id: 'log-1', user_id: 'user-123', amount_ml: 500 };
      mockPrisma.waterLog.create.mockResolvedValue(log);
      mockMealsService.updateDailySummary.mockResolvedValue(undefined);

      const result = await service.logWater('user-123', { amount_ml: 500 });

      expect(mockPrisma.waterLog.create).toHaveBeenCalledWith({
        data: { user_id: 'user-123', amount_ml: 500 },
      });
      expect(mockMealsService.updateDailySummary).toHaveBeenCalledWith('user-123', expect.any(Date));
      expect(result).toEqual(log);
    });
  });

  describe('getTodayTotal', () => {
    it('should return aggregated water total for today', async () => {
      mockPrisma.waterLog.aggregate.mockResolvedValue({ _sum: { amount_ml: 1500 } });

      const result = await service.getTodayTotal('user-123');

      expect(result).toEqual({ total_ml: 1500 });
    });

    it('should return 0 when no water logged today', async () => {
      mockPrisma.waterLog.aggregate.mockResolvedValue({ _sum: { amount_ml: null } });

      const result = await service.getTodayTotal('user-123');

      expect(result).toEqual({ total_ml: 0 });
    });
  });
});
