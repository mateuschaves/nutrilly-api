import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { PrismaService } from '../prisma/prisma.service';
import { TournamentScoringService } from './scoring/scoring.service';

const USER_ID = 'user-1';
const ADMIN_ID = 'admin-1';
const T_ID = 'tournament-1';

const makeRule = (type: string) => ({
  id: `rule-${type}`, tournamentId: T_ID, type, label: type, description: '', points: 10, enabled: true, unit: null, emoji: '🏆',
});

const makeMember = (userId: string, role: string, points = 0, overrides = {}) => ({
  id: `member-${userId}`,
  tournamentId: T_ID,
  userId,
  role,
  points,
  position: 1,
  joinedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

const makeTournament = (overrides: any = {}) => ({
  id: T_ID,
  title: 'Test Tournament',
  description: 'A test',
  bannerUri: null,
  inviteCode: 'ABCD-1234',
  startDate: new Date('2026-02-01'),
  endDate: null,
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
  members: [makeMember(ADMIN_ID, 'ADMIN')],
  activities: [],
  scoringRules: [],
  ...overrides,
});

describe('TournamentsService', () => {
  let service: TournamentsService;

  const mockPrisma = {
    tournament: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      updateMany: jest.fn(),
    },
    tournamentMember: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    tournamentScoringRule: {
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    tournamentActivity: {
      findFirst: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const mockScoring = {
    recalculatePositions: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TournamentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TournamentScoringService, useValue: mockScoring },
      ],
    }).compile();

    service = module.get<TournamentsService>(TournamentsService);
    jest.clearAllMocks();
    mockScoring.recalculatePositions.mockResolvedValue(undefined);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── findAll ─────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns all tournaments the user is a member of', async () => {
      mockPrisma.tournament.findMany.mockResolvedValue([makeTournament()]);

      const result = await service.findAll(USER_ID);

      expect(mockPrisma.tournament.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { members: { some: { userId: USER_ID } } },
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('serializes status to lowercase', async () => {
      mockPrisma.tournament.findMany.mockResolvedValue([makeTournament({ status: 'ACTIVE' })]);
      const result = await service.findAll(USER_ID);
      expect(result[0].status).toBe('active');
    });

    it('serializes member role to lowercase', async () => {
      mockPrisma.tournament.findMany.mockResolvedValue([
        makeTournament({ members: [makeMember(ADMIN_ID, 'ADMIN')] }),
      ]);
      const result = await service.findAll(USER_ID);
      expect(result[0].members[0].role).toBe('admin');
    });
  });

  // ─── findActive ──────────────────────────────────────────────────────────────

  describe('findActive', () => {
    it('queries only ACTIVE tournaments for the user', async () => {
      mockPrisma.tournament.findMany.mockResolvedValue([]);

      await service.findActive(USER_ID);

      expect(mockPrisma.tournament.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'ACTIVE', members: { some: { userId: USER_ID } } },
        }),
      );
    });
  });

  // ─── findById ────────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('throws NotFoundException when tournament does not exist', async () => {
      mockPrisma.tournament.findUnique.mockResolvedValue(null);

      await expect(service.findById(USER_ID, T_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user is not a member', async () => {
      mockPrisma.tournament.findUnique.mockResolvedValue(
        makeTournament({ members: [makeMember('other-user', 'MEMBER')] }),
      );

      await expect(service.findById(USER_ID, T_ID)).rejects.toThrow(ForbiddenException);
    });

    it('returns tournament when user is a member', async () => {
      mockPrisma.tournament.findUnique.mockResolvedValue(
        makeTournament({ members: [makeMember(USER_ID, 'MEMBER')] }),
      );

      const result = await service.findById(USER_ID, T_ID);

      expect(result.id).toBe(T_ID);
    });
  });

  // ─── join ────────────────────────────────────────────────────────────────────

  describe('join', () => {
    it('throws NotFoundException for an invalid invite code', async () => {
      mockPrisma.tournament.findUnique.mockResolvedValue(null);

      await expect(service.join(USER_ID, { inviteCode: 'XXXX-YYYY' })).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when tournament has ended', async () => {
      mockPrisma.tournament.findUnique.mockResolvedValue(makeTournament({ status: 'ENDED' }));

      await expect(service.join(USER_ID, { inviteCode: 'ABCD-1234' })).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException when user is already a member', async () => {
      mockPrisma.tournament.findUnique.mockResolvedValue(
        makeTournament({ members: [makeMember(USER_ID, 'MEMBER')] }),
      );

      await expect(service.join(USER_ID, { inviteCode: 'ABCD-1234' })).rejects.toThrow(ConflictException);
    });

    it('creates a member with MEMBER role and 0 points', async () => {
      mockPrisma.tournament.findUnique
        .mockResolvedValueOnce(makeTournament({ members: [makeMember(ADMIN_ID, 'ADMIN')] }))
        .mockResolvedValueOnce(makeTournament({ members: [makeMember(ADMIN_ID, 'ADMIN'), makeMember(USER_ID, 'MEMBER')] }));
      mockPrisma.tournamentMember.create.mockResolvedValue(makeMember(USER_ID, 'MEMBER'));

      await service.join(USER_ID, { inviteCode: 'ABCD-1234' });

      expect(mockPrisma.tournamentMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: USER_ID, role: 'MEMBER', points: 0 }),
        }),
      );
    });
  });

  // ─── leave ───────────────────────────────────────────────────────────────────

  describe('leave', () => {
    it('throws NotFoundException when tournament does not exist', async () => {
      mockPrisma.tournament.findUnique.mockResolvedValue(null);

      await expect(service.leave(USER_ID, T_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user is not a member', async () => {
      mockPrisma.tournament.findUnique.mockResolvedValue(makeTournament({ members: [] }));

      await expect(service.leave(USER_ID, T_ID)).rejects.toThrow(ForbiddenException);
    });

    it('deletes the entire tournament when the last admin leaves', async () => {
      const adminMember = makeMember(USER_ID, 'ADMIN');
      mockPrisma.tournament.findUnique.mockResolvedValue(
        makeTournament({ members: [adminMember] }), // only 1 admin
      );
      mockPrisma.tournamentMember.deleteMany.mockResolvedValue({});
      mockPrisma.tournamentScoringRule.deleteMany.mockResolvedValue({});
      mockPrisma.tournamentActivity.deleteMany.mockResolvedValue({});
      mockPrisma.tournament.delete.mockResolvedValue({});

      await service.leave(USER_ID, T_ID);

      expect(mockPrisma.tournament.delete).toHaveBeenCalledWith({ where: { id: T_ID } });
    });

    it('removes only the member when multiple admins exist', async () => {
      const admin1 = makeMember(USER_ID, 'ADMIN', 0, { id: 'member-admin1' });
      const admin2 = makeMember('admin-2', 'ADMIN', 0, { id: 'member-admin2' });
      mockPrisma.tournament.findUnique.mockResolvedValue(
        makeTournament({ members: [admin1, admin2] }),
      );
      mockPrisma.tournamentMember.delete.mockResolvedValue({});

      await service.leave(USER_ID, T_ID);

      expect(mockPrisma.tournamentMember.delete).toHaveBeenCalledWith({ where: { id: 'member-admin1' } });
      expect(mockPrisma.tournament.delete).not.toHaveBeenCalled();
    });

    it('removes only the member when a regular member leaves', async () => {
      const member = makeMember(USER_ID, 'MEMBER', 0, { id: 'member-user1' });
      const admin = makeMember(ADMIN_ID, 'ADMIN');
      mockPrisma.tournament.findUnique.mockResolvedValue(
        makeTournament({ members: [member, admin] }),
      );
      mockPrisma.tournamentMember.delete.mockResolvedValue({});

      await service.leave(USER_ID, T_ID);

      expect(mockPrisma.tournamentMember.delete).toHaveBeenCalledWith({ where: { id: 'member-user1' } });
      expect(mockPrisma.tournament.delete).not.toHaveBeenCalled();
    });
  });

  // ─── updateMemberRole ────────────────────────────────────────────────────────

  describe('updateMemberRole', () => {
    beforeEach(() => {
      // assertAdmin mock: admin is a member with ADMIN role
      mockPrisma.tournamentMember.findFirst.mockResolvedValue(makeMember(ADMIN_ID, 'ADMIN'));
    });

    it('throws ForbiddenException when caller is not an admin', async () => {
      mockPrisma.tournamentMember.findFirst.mockResolvedValue(makeMember(USER_ID, 'MEMBER'));

      await expect(
        service.updateMemberRole(USER_ID, T_ID, 'target-user', { role: 'ADMIN' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when target member does not exist', async () => {
      // First call: assertAdmin (success), second call: findFirst for target (null)
      mockPrisma.tournamentMember.findFirst
        .mockResolvedValueOnce(makeMember(ADMIN_ID, 'ADMIN'))
        .mockResolvedValueOnce(null);

      await expect(
        service.updateMemberRole(ADMIN_ID, T_ID, 'non-existent', { role: 'ADMIN' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when demoting the last admin', async () => {
      const targetAdmin = makeMember('target-admin', 'ADMIN', 0, { id: 'member-target-admin' });
      mockPrisma.tournamentMember.findFirst
        .mockResolvedValueOnce(makeMember(ADMIN_ID, 'ADMIN')) // assertAdmin
        .mockResolvedValueOnce(targetAdmin); // findFirst for target
      mockPrisma.tournamentMember.count.mockResolvedValue(1); // only 1 admin left

      await expect(
        service.updateMemberRole(ADMIN_ID, T_ID, 'target-admin', { role: 'MEMBER' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('promotes MEMBER to ADMIN', async () => {
      const targetMember = makeMember('target-user', 'MEMBER', 0, { id: 'member-target' });
      mockPrisma.tournamentMember.findFirst
        .mockResolvedValueOnce(makeMember(ADMIN_ID, 'ADMIN'))
        .mockResolvedValueOnce(targetMember);
      mockPrisma.tournamentMember.update.mockResolvedValue({ ...targetMember, role: 'ADMIN' });

      await service.updateMemberRole(ADMIN_ID, T_ID, 'target-user', { role: 'ADMIN' });

      expect(mockPrisma.tournamentMember.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { role: 'ADMIN' } }),
      );
    });

    it('demotes ADMIN to MEMBER when multiple admins exist', async () => {
      const targetAdmin = makeMember('target-admin', 'ADMIN', 0, { id: 'member-target-admin' });
      mockPrisma.tournamentMember.findFirst
        .mockResolvedValueOnce(makeMember(ADMIN_ID, 'ADMIN'))
        .mockResolvedValueOnce(targetAdmin);
      mockPrisma.tournamentMember.count.mockResolvedValue(2); // 2 admins → safe to demote
      mockPrisma.tournamentMember.update.mockResolvedValue({ ...targetAdmin, role: 'MEMBER' });

      await service.updateMemberRole(ADMIN_ID, T_ID, 'target-admin', { role: 'MEMBER' });

      expect(mockPrisma.tournamentMember.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { role: 'MEMBER' } }),
      );
    });
  });

  // ─── removeActivity ──────────────────────────────────────────────────────────

  describe('removeActivity', () => {
    it('throws ForbiddenException when caller is not an admin', async () => {
      mockPrisma.tournamentMember.findFirst.mockResolvedValue(makeMember(USER_ID, 'MEMBER'));

      await expect(service.removeActivity(USER_ID, T_ID, 'activity-1')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when activity does not exist', async () => {
      mockPrisma.tournamentMember.findFirst.mockResolvedValue(makeMember(ADMIN_ID, 'ADMIN'));
      mockPrisma.tournamentActivity.findFirst.mockResolvedValue(null);

      await expect(service.removeActivity(ADMIN_ID, T_ID, 'non-existent')).rejects.toThrow(NotFoundException);
    });

    it('reverts points before deleting activity', async () => {
      mockPrisma.tournamentMember.findFirst.mockResolvedValue(makeMember(ADMIN_ID, 'ADMIN'));
      mockPrisma.tournamentActivity.findFirst.mockResolvedValue({
        id: 'activity-1',
        tournamentId: T_ID,
        userId: USER_ID,
        points: 25,
      });
      mockPrisma.tournamentMember.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.tournamentActivity.delete.mockResolvedValue({});

      await service.removeActivity(ADMIN_ID, T_ID, 'activity-1');

      expect(mockPrisma.tournamentMember.updateMany).toHaveBeenCalledWith({
        where: { tournamentId: T_ID, userId: USER_ID },
        data: { points: { decrement: 25 } },
      });
      expect(mockPrisma.tournamentActivity.delete).toHaveBeenCalledWith({ where: { id: 'activity-1' } });
    });

    it('recalculates positions after deleting activity', async () => {
      mockPrisma.tournamentMember.findFirst.mockResolvedValue(makeMember(ADMIN_ID, 'ADMIN'));
      mockPrisma.tournamentActivity.findFirst.mockResolvedValue({
        id: 'activity-1',
        tournamentId: T_ID,
        userId: USER_ID,
        points: 10,
      });
      mockPrisma.tournamentMember.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.tournamentActivity.delete.mockResolvedValue({});

      await service.removeActivity(ADMIN_ID, T_ID, 'activity-1');

      expect(mockScoring.recalculatePositions).toHaveBeenCalledWith(T_ID);
    });
  });

  // ─── removeMember ────────────────────────────────────────────────────────────

  describe('removeMember', () => {
    it('throws BadRequestException when admin tries to remove themselves', async () => {
      mockPrisma.tournamentMember.findFirst.mockResolvedValue(makeMember(ADMIN_ID, 'ADMIN'));

      await expect(service.removeMember(ADMIN_ID, T_ID, ADMIN_ID)).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when target member does not exist', async () => {
      mockPrisma.tournamentMember.findFirst
        .mockResolvedValueOnce(makeMember(ADMIN_ID, 'ADMIN'))
        .mockResolvedValueOnce(null);

      await expect(service.removeMember(ADMIN_ID, T_ID, 'non-existent')).rejects.toThrow(NotFoundException);
    });

    it('deletes the target member', async () => {
      const targetMember = makeMember(USER_ID, 'MEMBER', 0, { id: 'member-user' });
      mockPrisma.tournamentMember.findFirst
        .mockResolvedValueOnce(makeMember(ADMIN_ID, 'ADMIN'))
        .mockResolvedValueOnce(targetMember);
      mockPrisma.tournamentMember.delete.mockResolvedValue({});

      await service.removeMember(ADMIN_ID, T_ID, USER_ID);

      expect(mockPrisma.tournamentMember.delete).toHaveBeenCalledWith({ where: { id: 'member-user' } });
    });
  });
});
