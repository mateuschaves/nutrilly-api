import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { JoinTournamentDto } from './dto/join-tournament.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { TournamentStatus, DEFAULT_SCORING_RULES } from './tournaments.types';
import { TournamentScoringService } from './scoring/scoring.service';

function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = randomBytes(8);
  const part1 = Array.from({ length: 4 }, (_, i) => chars[bytes[i] % chars.length]).join('');
  const part2 = Array.from({ length: 4 }, (_, i) => chars[bytes[i + 4] % chars.length]).join('');
  return `${part1}-${part2}`;
}

function serializeTournament(tournament: any) {
  return {
    ...tournament,
    status: tournament.status?.toLowerCase(),
    members: tournament.members
      ? [...tournament.members]
          .sort((a: any, b: any) => a.position - b.position)
          .map((m: any) => ({ ...m, role: m.role?.toLowerCase() }))
      : undefined,
    activities: tournament.activities
      ? [...tournament.activities].sort(
          (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
      : undefined,
    scoringRules: tournament.scoringRules,
    scoreLimit: {
      enabled: tournament.scoreLimitEnabled,
      maxPoints: tournament.scoreLimitMaxPts,
      period: tournament.scoreLimitPeriod?.toLowerCase(),
    },
  };
}

@Injectable()
export class TournamentsService {
  constructor(
    private prisma: PrismaService,
    private scoringService: TournamentScoringService,
  ) {}

  async create(userId: string, dto: CreateTournamentDto) {
    let inviteCode = generateInviteCode();

    // Ensure uniqueness (extremely unlikely collision but safe)
    let existing = await this.prisma.tournament.findUnique({ where: { inviteCode } });
    while (existing) {
      inviteCode = generateInviteCode();
      existing = await this.prisma.tournament.findUnique({ where: { inviteCode } });
    }

    const tournament = await this.prisma.tournament.create({
      data: {
        title: dto.title,
        description: dto.description,
        bannerUri: dto.bannerUri ?? null,
        inviteCode,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        status: TournamentStatus.UPCOMING,
        members: {
          create: { userId, role: 'ADMIN', points: 0, position: 1 },
        },
        scoringRules: {
          create: DEFAULT_SCORING_RULES.map((r) => ({
            type: r.type,
            label: r.label,
            description: r.description,
            points: r.points,
            unit: r.unit ?? null,
            emoji: r.emoji,
            enabled: true,
          })),
        },
      },
      include: { members: true, scoringRules: true, activities: true },
    });

    return serializeTournament(tournament);
  }

  async findAll(userId: string) {
    const tournaments = await this.prisma.tournament.findMany({
      where: { members: { some: { userId } } },
      include: { members: true, scoringRules: true },
      orderBy: { createdAt: 'desc' },
    });

    return tournaments.map(serializeTournament);
  }

  async findActive(userId: string) {
    const tournaments = await this.prisma.tournament.findMany({
      where: { status: TournamentStatus.ACTIVE, members: { some: { userId } } },
      include: { members: true, scoringRules: true },
      orderBy: { createdAt: 'desc' },
    });

    return tournaments.map(serializeTournament);
  }

  async findById(userId: string, tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { members: true, activities: true, scoringRules: true },
    });

    if (!tournament) throw new NotFoundException('Tournament not found');

    const isMember = tournament.members.some((m) => m.userId === userId);
    if (!isMember) throw new ForbiddenException('Access denied');

    return serializeTournament(tournament);
  }

  async join(userId: string, dto: JoinTournamentDto) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { inviteCode: dto.inviteCode },
      include: { members: true },
    });

    if (!tournament) {
      throw new NotFoundException('Invalid invite code');
    }

    if (tournament.status === TournamentStatus.ENDED) {
      throw new BadRequestException('Tournament has already ended');
    }

    const alreadyMember = tournament.members.some((m) => m.userId === userId);
    if (alreadyMember) {
      throw new ConflictException('You are already a member of this tournament');
    }

    const memberCount = tournament.members.length;

    const member = await this.prisma.tournamentMember.create({
      data: {
        tournamentId: tournament.id,
        userId,
        role: 'MEMBER',
        points: 0,
        position: memberCount + 1,
      },
    });

    const result = await this.prisma.tournament.findUnique({
      where: { id: tournament.id },
      include: { members: true, scoringRules: true, activities: true },
    });

    return serializeTournament(result);
  }

  async update(userId: string, tournamentId: string, dto: UpdateTournamentDto) {
    await this.assertAdmin(userId, tournamentId);

    const updateData: any = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.bannerUri !== undefined) updateData.bannerUri = dto.bannerUri;
    if (dto.scoreLimitEnabled !== undefined) updateData.scoreLimitEnabled = dto.scoreLimitEnabled;
    if (dto.scoreLimitMaxPts !== undefined) updateData.scoreLimitMaxPts = dto.scoreLimitMaxPts;
    if (dto.scoreLimitPeriod !== undefined) updateData.scoreLimitPeriod = dto.scoreLimitPeriod;

    if (dto.scoringRules && dto.scoringRules.length > 0) {
      for (const rule of dto.scoringRules) {
        const updateFields: any = { enabled: rule.enabled };
        if (rule.points !== undefined) updateFields.points = rule.points;

        await this.prisma.tournamentScoringRule.updateMany({
          where: { tournamentId, type: rule.type },
          data: updateFields,
        });
      }
    }

    const tournament = await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: updateData,
      include: { members: true, scoringRules: true, activities: true },
    });

    return serializeTournament(tournament);
  }

  async leave(userId: string, tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { members: true },
    });

    if (!tournament) throw new NotFoundException('Tournament not found');

    const member = tournament.members.find((m) => m.userId === userId);
    if (!member) throw new ForbiddenException('You are not a member of this tournament');

    const admins = tournament.members.filter((m) => m.role === 'ADMIN');

    if (member.role === 'ADMIN' && admins.length === 1) {
      // Last admin — delete entire tournament
      await this.deleteTournamentCascade(tournamentId);
      return;
    }

    // Otherwise just remove this member
    await this.prisma.tournamentMember.delete({ where: { id: member.id } });
    await this.scoringService.recalculatePositions(tournamentId);
  }

  async removeMember(adminId: string, tournamentId: string, targetUserId: string) {
    await this.assertAdmin(adminId, tournamentId);

    if (adminId === targetUserId) {
      throw new BadRequestException('Use the leave endpoint to remove yourself');
    }

    const member = await this.prisma.tournamentMember.findFirst({
      where: { tournamentId, userId: targetUserId },
    });

    if (!member) throw new NotFoundException('Member not found');

    await this.prisma.tournamentMember.delete({ where: { id: member.id } });
    await this.scoringService.recalculatePositions(tournamentId);
  }

  async updateMemberRole(adminId: string, tournamentId: string, targetUserId: string, dto: UpdateMemberRoleDto) {
    await this.assertAdmin(adminId, tournamentId);

    const targetMember = await this.prisma.tournamentMember.findFirst({
      where: { tournamentId, userId: targetUserId },
    });

    if (!targetMember) throw new NotFoundException('Member not found');

    // Prevent demoting the last admin
    if (dto.role === 'MEMBER' && targetMember.role === 'ADMIN') {
      const adminCount = await this.prisma.tournamentMember.count({
        where: { tournamentId, role: 'ADMIN' },
      });

      if (adminCount <= 1) {
        throw new BadRequestException('Cannot demote the last admin');
      }
    }

    const updated = await this.prisma.tournamentMember.update({
      where: { id: targetMember.id },
      data: { role: dto.role },
    });

    return { ...updated, role: updated.role.toLowerCase() };
  }

  async removeActivity(adminId: string, tournamentId: string, activityId: string) {
    await this.assertAdmin(adminId, tournamentId);

    const activity = await this.prisma.tournamentActivity.findFirst({
      where: { id: activityId, tournamentId },
    });

    if (!activity) throw new NotFoundException('Activity not found');

    // Revert points
    await this.prisma.tournamentMember.updateMany({
      where: { tournamentId, userId: activity.userId },
      data: { points: { decrement: activity.points } },
    });

    await this.prisma.tournamentActivity.delete({ where: { id: activityId } });
    await this.scoringService.recalculatePositions(tournamentId);
  }

  private async assertAdmin(userId: string, tournamentId: string): Promise<void> {
    const member = await this.prisma.tournamentMember.findFirst({
      where: { tournamentId, userId },
    });

    if (!member) throw new ForbiddenException('You are not a member of this tournament');
    if (member.role !== 'ADMIN') throw new ForbiddenException('Admin access required');
  }

  private async deleteTournamentCascade(tournamentId: string): Promise<void> {
    await Promise.all([
      this.prisma.tournamentMember.deleteMany({ where: { tournamentId } }),
      this.prisma.tournamentScoringRule.deleteMany({ where: { tournamentId } }),
      this.prisma.tournamentActivity.deleteMany({ where: { tournamentId } }),
    ]);
    await this.prisma.tournament.delete({ where: { id: tournamentId } });
  }
}
