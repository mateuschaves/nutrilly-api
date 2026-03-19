import { Test, TestingModule } from '@nestjs/testing';
import { WeightService } from './weight.service';
import { PrismaService } from '../prisma/prisma.service';
import { WeightSource } from './weight.types';

describe('WeightService', () => {
  let service: WeightService;

  const mockPrisma = {
    weightLog: { create: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeightService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<WeightService>(WeightService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('logWeight', () => {
    it('should create a weight log and return it formatted', async () => {
      const loggedAt = new Date('2026-03-19T08:00:00.000Z');
      mockPrisma.weightLog.create.mockResolvedValue({
        id: 'log-1',
        weightKg: 78.5,
        source: WeightSource.AppleHealth,
        loggedAt,
      });

      const result = await service.logWeight('user-1', {
        weightKg: 78.5,
        source: WeightSource.AppleHealth,
        loggedAt: '2026-03-19T08:00:00.000Z',
      });

      expect(result).toEqual({
        id: 'log-1',
        weightKg: 78.5,
        source: WeightSource.AppleHealth,
        loggedAt: '2026-03-19T08:00:00.000Z',
      });
    });

    it('should pass loggedAt as Date when provided', async () => {
      const loggedAt = new Date('2026-01-01T06:00:00.000Z');
      mockPrisma.weightLog.create.mockResolvedValue({
        id: 'log-2',
        weightKg: 80,
        source: WeightSource.Manual,
        loggedAt,
      });

      await service.logWeight('user-1', {
        weightKg: 80,
        source: WeightSource.Manual,
        loggedAt: '2026-01-01T06:00:00.000Z',
      });

      expect(mockPrisma.weightLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          loggedAt: new Date('2026-01-01T06:00:00.000Z'),
        }),
      });
    });

    it('should omit loggedAt from data when not provided (uses DB default)', async () => {
      const now = new Date();
      mockPrisma.weightLog.create.mockResolvedValue({
        id: 'log-3',
        weightKg: 75,
        source: WeightSource.GoogleFit,
        loggedAt: now,
      });

      await service.logWeight('user-1', {
        weightKg: 75,
        source: WeightSource.GoogleFit,
      });

      const callData = mockPrisma.weightLog.create.mock.calls[0][0].data;
      expect(callData).not.toHaveProperty('loggedAt');
    });

    it('should persist correct userId and source', async () => {
      const loggedAt = new Date();
      mockPrisma.weightLog.create.mockResolvedValue({
        id: 'log-4',
        weightKg: 70,
        source: WeightSource.SamsungHealth,
        loggedAt,
      });

      await service.logWeight('user-abc', {
        weightKg: 70,
        source: WeightSource.SamsungHealth,
      });

      expect(mockPrisma.weightLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-abc',
          source: 'SAMSUNG_HEALTH',
          weightKg: 70,
        }),
      });
    });

    it('should return loggedAt as ISO string', async () => {
      const loggedAt = new Date('2026-03-15T10:30:00.000Z');
      mockPrisma.weightLog.create.mockResolvedValue({
        id: 'log-5',
        weightKg: 77,
        source: WeightSource.Manual,
        loggedAt,
      });

      const result = await service.logWeight('user-1', {
        weightKg: 77,
        source: WeightSource.Manual,
      });

      expect(typeof result.loggedAt).toBe('string');
      expect(result.loggedAt).toBe('2026-03-15T10:30:00.000Z');
    });
  });
});
