import { Test, TestingModule } from '@nestjs/testing';
import { WeightService } from './weight.service';
import { PrismaService } from '../prisma/prisma.service';
import { TournamentScoringService } from '../tournaments/scoring/scoring.service';
import { WeightSource } from './weight.types';

describe('WeightService', () => {
  let service: WeightService;

  const mockPrisma = {
    weightLog: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockScoringService = {
    processScoringEvent: jest.fn().mockResolvedValue(undefined),
  };

  const makeEntry = (overrides = {}) => ({
    id: 'log-1',
    weightKg: 78.5,
    source: WeightSource.AppleHealth,
    loggedAt: new Date('2026-03-19T08:00:00.000Z'),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeightService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TournamentScoringService, useValue: mockScoringService },
      ],
    }).compile();

    service = module.get<WeightService>(WeightService);
    jest.clearAllMocks();
    mockScoringService.processScoringEvent.mockResolvedValue(undefined);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('logWeight', () => {
    it('should create a weight log and return it formatted', async () => {
      const loggedAt = new Date('2026-03-19T08:00:00.000Z');
      mockPrisma.weightLog.findFirst.mockResolvedValue(null);
      mockPrisma.weightLog.create.mockResolvedValue(makeEntry({ loggedAt }));

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
      mockPrisma.weightLog.findFirst.mockResolvedValue(null);
      mockPrisma.weightLog.create.mockResolvedValue(makeEntry({ id: 'log-2', weightKg: 80, source: WeightSource.Manual, loggedAt }));

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
      mockPrisma.weightLog.findFirst.mockResolvedValue(null);
      mockPrisma.weightLog.create.mockResolvedValue(makeEntry({ id: 'log-3', weightKg: 75, source: WeightSource.GoogleFit, loggedAt: now }));

      await service.logWeight('user-1', { weightKg: 75, source: WeightSource.GoogleFit });

      const callData = mockPrisma.weightLog.create.mock.calls[0][0].data;
      expect(callData).not.toHaveProperty('loggedAt');
    });

    it('should persist correct userId and source', async () => {
      const loggedAt = new Date();
      mockPrisma.weightLog.findFirst.mockResolvedValue(null);
      mockPrisma.weightLog.create.mockResolvedValue(makeEntry({ id: 'log-4', weightKg: 70, source: WeightSource.SamsungHealth, loggedAt }));

      await service.logWeight('user-abc', { weightKg: 70, source: WeightSource.SamsungHealth });

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
      mockPrisma.weightLog.findFirst.mockResolvedValue(null);
      mockPrisma.weightLog.create.mockResolvedValue(makeEntry({ id: 'log-5', weightKg: 77, source: WeightSource.Manual, loggedAt }));

      const result = await service.logWeight('user-1', { weightKg: 77, source: WeightSource.Manual });

      expect(typeof result.loggedAt).toBe('string');
      expect(result.loggedAt).toBe('2026-03-15T10:30:00.000Z');
    });

    // ─── Tournament WEIGHT_LOSS scoring ──────────────────────────────────────

    it('should NOT call processScoringEvent when there is no previous weight', async () => {
      mockPrisma.weightLog.findFirst.mockResolvedValue(null);
      mockPrisma.weightLog.create.mockResolvedValue(makeEntry());

      await service.logWeight('user-1', { weightKg: 78.5, source: WeightSource.Manual });

      expect(mockScoringService.processScoringEvent).not.toHaveBeenCalled();
    });

    it('should NOT call processScoringEvent when weight is the same as previous', async () => {
      mockPrisma.weightLog.findFirst.mockResolvedValue({ weightKg: 78.5 });
      mockPrisma.weightLog.create.mockResolvedValue(makeEntry());

      await service.logWeight('user-1', { weightKg: 78.5, source: WeightSource.Manual });

      expect(mockScoringService.processScoringEvent).not.toHaveBeenCalled();
    });

    it('should NOT call processScoringEvent when new weight is higher', async () => {
      mockPrisma.weightLog.findFirst.mockResolvedValue({ weightKg: 78.0 });
      mockPrisma.weightLog.create.mockResolvedValue(makeEntry({ weightKg: 79.0 }));

      await service.logWeight('user-1', { weightKg: 79.0, source: WeightSource.Manual });

      expect(mockScoringService.processScoringEvent).not.toHaveBeenCalled();
    });

    it('should call processScoringEvent with WEIGHT_LOSS when weight decreased', async () => {
      mockPrisma.weightLog.findFirst.mockResolvedValue({ weightKg: 80.0 });
      mockPrisma.weightLog.create.mockResolvedValue(makeEntry({ weightKg: 79.5, loggedAt: new Date('2026-03-20T08:00:00.000Z') }));

      await service.logWeight('user-1', { weightKg: 79.5, source: WeightSource.Manual });

      expect(mockScoringService.processScoringEvent).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          type: 'WEIGHT_LOSS',
          payload: expect.objectContaining({
            weightKg: 79.5,
            previousWeightKg: 80.0,
          }),
        }),
      );
    });
  });
});
