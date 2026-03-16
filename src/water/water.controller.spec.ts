import { Test, TestingModule } from '@nestjs/testing';
import { WaterController } from './water.controller';
import { WaterService } from './water.service';

describe('WaterController', () => {
  let controller: WaterController;

  const mockWaterService = {
    logWater: jest.fn(),
    getTodayTotal: jest.fn(),
  };

  const mockReq = { user: { id: 'user-123' } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WaterController],
      providers: [{ provide: WaterService, useValue: mockWaterService }],
    }).compile();

    controller = module.get<WaterController>(WaterController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('logWater() should call waterService.logWater with userId and dto', async () => {
    const dto = { amount_ml: 500 };
    const log = { id: 'log-1', user_id: 'user-123', amount_ml: 500 };
    mockWaterService.logWater.mockResolvedValue(log);

    const result = await controller.logWater(mockReq, dto);

    expect(mockWaterService.logWater).toHaveBeenCalledWith('user-123', dto);
    expect(result).toEqual(log);
  });

  it('getTodayTotal() should call waterService.getTodayTotal with userId', async () => {
    mockWaterService.getTodayTotal.mockResolvedValue({ total_ml: 1500 });

    const result = await controller.getTodayTotal(mockReq);

    expect(mockWaterService.getTodayTotal).toHaveBeenCalledWith('user-123');
    expect(result).toEqual({ total_ml: 1500 });
  });
});
