import { Test, TestingModule } from '@nestjs/testing';
import { TournamentScoringService } from './scoring.service';
import { PrismaService } from '../../prisma/prisma.service';

const USER_ID = 'user-1';
const T_ID = 'tournament-1';
const DATE = '2026-01-15';

const makeRule = (type: string, points: number, enabled = true) => ({
  id: `rule-${type}`,
  tournamentId: T_ID,
  type,
  points,
  enabled,
  label: type,
  description: '',
  unit: null,
  emoji: '🏆',
});

const makeTournament = (scoringRules: any[], scoreLimit?: { enabled: boolean; maxPts: number; period: string }) => ({
  id: T_ID,
  scoringRules,
  scoreLimitEnabled: scoreLimit?.enabled ?? false,
  scoreLimitMaxPts: scoreLimit?.maxPts ?? 200,
  scoreLimitPeriod: scoreLimit?.period ?? 'DAY',
  members: [{ id: 'm-1', userId: USER_ID, tournamentId: T_ID, points: 0, joinedAt: new Date() }],
});

describe('TournamentScoringService', () => {
  let service: TournamentScoringService;

  const mockPrisma = {
    tournament: { findMany: jest.fn() },
    tournamentActivity: {
      create: jest.fn(),
      findFirst: jest.fn(),
      aggregate: jest.fn(),
    },
    tournamentMember: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TournamentScoringService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TournamentScoringService>(TournamentScoringService);
    jest.clearAllMocks();

    mockPrisma.tournamentActivity.create.mockResolvedValue({});
    mockPrisma.tournamentActivity.aggregate.mockResolvedValue({ _sum: { points: 0 } });
    mockPrisma.tournamentMember.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.tournamentMember.update.mockResolvedValue({});
    mockPrisma.tournamentMember.findMany.mockResolvedValue([]);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── processMealScoringEvent ─────────────────────────────────────────────────

  describe('processMealScoringEvent', () => {
    const mealPayload = {
      kcal: 300, proteinG: 25, carbsG: 30, fatG: 8,
      mealName: 'Chicken Bowl', date: DATE, time: '12:30',
    };

    it('does nothing when tournamentIds is empty', async () => {
      await service.processMealScoringEvent(USER_ID, { type: 'MEAL_LOGGED', payload: mealPayload }, []);
      expect(mockPrisma.tournament.findMany).not.toHaveBeenCalled();
    });

    it('creates an activity and updates member points', async () => {
      mockPrisma.tournament.findMany.mockResolvedValue([makeTournament([makeRule('MEAL_LOGGED', 10)])]);

      await service.processMealScoringEvent(USER_ID, { type: 'MEAL_LOGGED', payload: mealPayload }, [T_ID]);

      expect(mockPrisma.tournamentActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tournamentId: T_ID, userId: USER_ID, type: 'MEAL_LOGGED', points: 10 }),
        }),
      );
      expect(mockPrisma.tournamentMember.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tournamentId: T_ID, userId: USER_ID },
          data: { points: { increment: 10 } },
        }),
      );
    });

    it('skips tournament when the rule type is not found', async () => {
      mockPrisma.tournament.findMany.mockResolvedValue([makeTournament([makeRule('WATER_GOAL_MET', 30)])]);

      await service.processMealScoringEvent(USER_ID, { type: 'MEAL_LOGGED', payload: mealPayload }, [T_ID]);

      expect(mockPrisma.tournamentActivity.create).not.toHaveBeenCalled();
    });

    it('skips tournament when the rule is disabled', async () => {
      mockPrisma.tournament.findMany.mockResolvedValue([makeTournament([makeRule('MEAL_LOGGED', 10, false)])]);

      await service.processMealScoringEvent(USER_ID, { type: 'MEAL_LOGGED', payload: mealPayload }, [T_ID]);

      expect(mockPrisma.tournamentActivity.create).not.toHaveBeenCalled();
    });

    it('stores meal metadata in the activity', async () => {
      mockPrisma.tournament.findMany.mockResolvedValue([makeTournament([makeRule('MEAL_LOGGED', 10)])]);

      await service.processMealScoringEvent(USER_ID, { type: 'MEAL_LOGGED', payload: mealPayload }, [T_ID]);

      expect(mockPrisma.tournamentActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            mealName: 'Chicken Bowl',
            calories: 300,
            protein: 25,
            carbs: 30,
            fat: 8,
            date: DATE,
            time: '12:30',
          }),
        }),
      );
    });
  });

  // ─── processScoringEvent ────────────────────────────────────────────────────

  describe('processScoringEvent', () => {
    it('creates DAILY_GOAL_MET activity for all active tournaments', async () => {
      mockPrisma.tournament.findMany.mockResolvedValue([makeTournament([makeRule('DAILY_GOAL_MET', 50)])]);
      mockPrisma.tournamentActivity.findFirst.mockResolvedValue(null);

      await service.processScoringEvent(USER_ID, { type: 'DAILY_GOAL_MET', payload: { date: DATE } });

      expect(mockPrisma.tournamentActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'DAILY_GOAL_MET', points: 50 }),
        }),
      );
    });

    it('skips DAILY_GOAL_MET if already scored today', async () => {
      mockPrisma.tournament.findMany.mockResolvedValue([makeTournament([makeRule('DAILY_GOAL_MET', 50)])]);
      mockPrisma.tournamentActivity.findFirst.mockResolvedValue({ id: 'existing' });

      await service.processScoringEvent(USER_ID, { type: 'DAILY_GOAL_MET', payload: { date: DATE } });

      expect(mockPrisma.tournamentActivity.create).not.toHaveBeenCalled();
    });

    it('skips WATER_GOAL_MET if already scored today', async () => {
      mockPrisma.tournament.findMany.mockResolvedValue([makeTournament([makeRule('WATER_GOAL_MET', 30)])]);
      mockPrisma.tournamentActivity.findFirst.mockResolvedValue({ id: 'existing' });

      await service.processScoringEvent(USER_ID, { type: 'WATER_GOAL_MET', payload: { date: DATE } });

      expect(mockPrisma.tournamentActivity.create).not.toHaveBeenCalled();
    });

    it('creates WEIGHT_LOSS activity and stores weightKg', async () => {
      mockPrisma.tournament.findMany.mockResolvedValue([makeTournament([makeRule('WEIGHT_LOSS', 100)])]);

      await service.processScoringEvent(USER_ID, {
        type: 'WEIGHT_LOSS',
        payload: { weightKg: 79.5, previousWeightKg: 80.0, date: DATE },
      });

      expect(mockPrisma.tournamentActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'WEIGHT_LOSS', points: 500, weightKg: 79.5 }),
        }),
      );
    });

    it('skips WEIGHT_LOSS when points would be 0 (loss < 0.1kg)', async () => {
      mockPrisma.tournament.findMany.mockResolvedValue([makeTournament([makeRule('WEIGHT_LOSS', 100)])]);

      await service.processScoringEvent(USER_ID, {
        type: 'WEIGHT_LOSS',
        payload: { weightKg: 79.99, previousWeightKg: 80.0, date: DATE },
      });

      expect(mockPrisma.tournamentActivity.create).not.toHaveBeenCalled();
    });

    it('creates CALORIES_BURNED activity and stores caloriesBurned', async () => {
      mockPrisma.tournament.findMany.mockResolvedValue([makeTournament([makeRule('CALORIES_BURNED', 5)])]);

      await service.processScoringEvent(USER_ID, {
        type: 'CALORIES_BURNED',
        payload: { caloriesBurned: 350, date: DATE },
      });

      expect(mockPrisma.tournamentActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'CALORIES_BURNED', points: 15, caloriesBurned: 350 }),
        }),
      );
    });

    it('does nothing when user has no active tournaments', async () => {
      mockPrisma.tournament.findMany.mockResolvedValue([]);

      await service.processScoringEvent(USER_ID, { type: 'DAILY_GOAL_MET', payload: { date: DATE } });

      expect(mockPrisma.tournamentActivity.create).not.toHaveBeenCalled();
    });
  });

  // ─── score limit ────────────────────────────────────────────────────────────

  describe('score limit (processMealScoringEvent)', () => {
    const mealPayload = {
      kcal: 300, proteinG: 25, carbsG: 30, fatG: 8,
      mealName: 'Chicken Bowl', date: DATE, time: '12:30',
    };

    it('awards points normally when limit is disabled', async () => {
      mockPrisma.tournament.findMany.mockResolvedValue([
        makeTournament([makeRule('MEAL_LOGGED', 10)], { enabled: false, maxPts: 50, period: 'DAY' }),
      ]);

      const results = await service.processMealScoringEvent(USER_ID, { type: 'MEAL_LOGGED', payload: mealPayload }, [T_ID]);

      expect(results).toEqual([{ tournamentId: T_ID, points: 10, limitReached: false }]);
      expect(mockPrisma.tournamentActivity.create).toHaveBeenCalled();
    });

    it('awards points when limit is enabled but not yet reached', async () => {
      mockPrisma.tournament.findMany.mockResolvedValue([
        makeTournament([makeRule('MEAL_LOGGED', 10)], { enabled: true, maxPts: 100, period: 'DAY' }),
      ]);
      mockPrisma.tournamentActivity.aggregate.mockResolvedValue({ _sum: { points: 50 } });

      const results = await service.processMealScoringEvent(USER_ID, { type: 'MEAL_LOGGED', payload: mealPayload }, [T_ID]);

      expect(results).toEqual([{ tournamentId: T_ID, points: 10, limitReached: false }]);
      expect(mockPrisma.tournamentActivity.create).toHaveBeenCalled();
    });

    it('blocks points and returns limitReached when limit is reached', async () => {
      mockPrisma.tournament.findMany.mockResolvedValue([
        makeTournament([makeRule('MEAL_LOGGED', 10)], { enabled: true, maxPts: 50, period: 'DAY' }),
      ]);
      mockPrisma.tournamentActivity.aggregate.mockResolvedValue({ _sum: { points: 50 } });

      const results = await service.processMealScoringEvent(USER_ID, { type: 'MEAL_LOGGED', payload: mealPayload }, [T_ID]);

      expect(results).toEqual([{ tournamentId: T_ID, points: 0, limitReached: true }]);
      expect(mockPrisma.tournamentActivity.create).not.toHaveBeenCalled();
      expect(mockPrisma.tournamentMember.updateMany).not.toHaveBeenCalled();
    });

    it('does not block negative points (UNHEALTHY_MEAL) when limit is enabled', async () => {
      mockPrisma.tournament.findMany.mockResolvedValue([
        makeTournament([makeRule('UNHEALTHY_MEAL', -10)], { enabled: true, maxPts: 50, period: 'DAY' }),
      ]);
      mockPrisma.tournamentActivity.aggregate.mockResolvedValue({ _sum: { points: 50 } });

      const results = await service.processMealScoringEvent(USER_ID, { type: 'UNHEALTHY_MEAL', payload: mealPayload }, [T_ID]);

      // Negative points bypass limit check (pointsToAdd <= 0 skips limit)
      expect(results).toEqual([{ tournamentId: T_ID, points: -10, limitReached: false }]);
      expect(mockPrisma.tournamentActivity.create).toHaveBeenCalled();
    });

    it('returns empty array when tournamentIds is empty', async () => {
      const results = await service.processMealScoringEvent(USER_ID, { type: 'MEAL_LOGGED', payload: mealPayload }, []);
      expect(results).toEqual([]);
    });
  });

  describe('score limit (processScoringEvent)', () => {
    it('blocks DAILY_GOAL_MET when limit is reached', async () => {
      mockPrisma.tournament.findMany.mockResolvedValue([
        makeTournament([makeRule('DAILY_GOAL_MET', 50)], { enabled: true, maxPts: 100, period: 'DAY' }),
      ]);
      mockPrisma.tournamentActivity.findFirst.mockResolvedValue(null);
      mockPrisma.tournamentActivity.aggregate.mockResolvedValue({ _sum: { points: 100 } });

      const results = await service.processScoringEvent(USER_ID, { type: 'DAILY_GOAL_MET', payload: { date: DATE } });

      expect(results).toEqual([{ tournamentId: T_ID, points: 0, limitReached: true }]);
      expect(mockPrisma.tournamentActivity.create).not.toHaveBeenCalled();
    });

    it('returns scoring results for processScoringEvent', async () => {
      mockPrisma.tournament.findMany.mockResolvedValue([
        makeTournament([makeRule('DAILY_GOAL_MET', 50)]),
      ]);
      mockPrisma.tournamentActivity.findFirst.mockResolvedValue(null);

      const results = await service.processScoringEvent(USER_ID, { type: 'DAILY_GOAL_MET', payload: { date: DATE } });

      expect(results).toEqual([{ tournamentId: T_ID, points: 50, limitReached: false }]);
    });

    it('returns empty array when user has no active tournaments', async () => {
      mockPrisma.tournament.findMany.mockResolvedValue([]);

      const results = await service.processScoringEvent(USER_ID, { type: 'DAILY_GOAL_MET', payload: { date: DATE } });

      expect(results).toEqual([]);
    });
  });

  // ─── recalculatePositions ────────────────────────────────────────────────────

  describe('recalculatePositions', () => {
    it('assigns positions ordered by points desc, joinedAt asc on tie', async () => {
      const t0 = new Date('2026-01-01T00:00:00Z');
      const t1 = new Date('2026-01-02T00:00:00Z');
      const t2 = new Date('2026-01-03T00:00:00Z');

      mockPrisma.tournamentMember.findMany.mockResolvedValue([
        { id: 'm-3', points: 100, joinedAt: t2 }, // highest points → 1st
        { id: 'm-1', points: 50, joinedAt: t0 },  // tie breaker: earlier → 2nd
        { id: 'm-2', points: 50, joinedAt: t1 },  // tie breaker: later → 3rd
      ]);

      await service.recalculatePositions(T_ID);

      expect(mockPrisma.tournamentMember.update).toHaveBeenCalledWith({ where: { id: 'm-3' }, data: { position: 1 } });
      expect(mockPrisma.tournamentMember.update).toHaveBeenCalledWith({ where: { id: 'm-1' }, data: { position: 2 } });
      expect(mockPrisma.tournamentMember.update).toHaveBeenCalledWith({ where: { id: 'm-2' }, data: { position: 3 } });
    });

    it('assigns position 1 when there is only one member', async () => {
      mockPrisma.tournamentMember.findMany.mockResolvedValue([
        { id: 'm-1', points: 200, joinedAt: new Date() },
      ]);

      await service.recalculatePositions(T_ID);

      expect(mockPrisma.tournamentMember.update).toHaveBeenCalledWith({ where: { id: 'm-1' }, data: { position: 1 } });
    });

    it('does nothing when tournament has no members', async () => {
      mockPrisma.tournamentMember.findMany.mockResolvedValue([]);

      await service.recalculatePositions(T_ID);

      expect(mockPrisma.tournamentMember.update).not.toHaveBeenCalled();
    });
  });
});
