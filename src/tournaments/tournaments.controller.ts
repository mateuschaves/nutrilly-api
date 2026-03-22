import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { TournamentsService } from './tournaments.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { JoinTournamentDto } from './dto/join-tournament.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@ApiTags('tournaments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tournaments')
export class TournamentsController {
  constructor(private tournamentsService: TournamentsService) {}

  // ─── Listing ──────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'List all tournaments the user belongs to',
    description:
      'Returns every tournament where the authenticated user is a member, regardless of status (UPCOMING, ACTIVE, ENDED). ' +
      'Members are sorted by position (leaderboard order). Activities are sorted by createdAt DESC. ' +
      'Enum values are serialized in lowercase (e.g. `"active"`, `"admin"`).',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of tournaments (may be empty)',
  })
  findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.tournamentsService.findAll(user.id);
  }

  @Get('active')
  @ApiOperation({
    summary: 'List active tournaments the user belongs to',
    description:
      'Returns only ACTIVE tournaments for the authenticated user. ' +
      'Used by the frontend to populate the tournament selector on the meal-log screen. ' +
      'The user can then choose which of these tournaments should receive points for a given meal entry.',
  })
  @ApiResponse({ status: 200, description: 'Array of active tournaments (may be empty)' })
  findActive(@CurrentUser() user: CurrentUserPayload) {
    return this.tournamentsService.findActive(user.id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single tournament (members only)',
    description:
      'Returns full tournament detail including members (sorted by position), activities (sorted newest first), ' +
      'and scoring rules. Only accessible to members of the tournament.',
  })
  @ApiParam({ name: 'id', description: 'Tournament ID (CUID)' })
  @ApiResponse({ status: 200, description: 'Tournament detail' })
  @ApiResponse({ status: 403, description: 'You are not a member of this tournament' })
  @ApiResponse({ status: 404, description: 'Tournament not found' })
  findById(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.tournamentsService.findById(user.id, id);
  }

  // ─── Create / Join ────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({
    summary: 'Create a new tournament',
    description:
      'Creates a tournament and automatically: ' +
      '(1) adds the authenticated user as the first ADMIN member, ' +
      '(2) seeds all 7 default scoring rules (MEAL_LOGGED, HEALTHY_MEAL, UNHEALTHY_MEAL, DAILY_GOAL_MET, WATER_GOAL_MET, CALORIES_BURNED, WEIGHT_LOSS). ' +
      'The `startDate` is required. Omitting `endDate` creates an open-ended tournament. ' +
      'Status transitions (UPCOMING → ACTIVE → ENDED) are managed automatically by the hourly cron job.',
  })
  @ApiResponse({ status: 201, description: 'Tournament created with member + scoring rules' })
  @ApiResponse({ status: 400, description: 'Validation error (missing required fields, invalid date)' })
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateTournamentDto) {
    return this.tournamentsService.create(user.id, dto);
  }

  @Post('join')
  @ApiOperation({
    summary: 'Join a tournament via invite code',
    description:
      'Validates the invite code and adds the user as a MEMBER with 0 points. ' +
      'Validations: code must exist, tournament must not be ENDED, user must not already be a member. ' +
      'UPCOMING tournaments can be joined so the user is ready when the tournament becomes ACTIVE.',
  })
  @ApiResponse({ status: 201, description: 'Joined successfully — returns full tournament detail' })
  @ApiResponse({ status: 400, description: 'Tournament has already ended' })
  @ApiResponse({ status: 404, description: 'Invalid invite code' })
  @ApiResponse({ status: 409, description: 'You are already a member of this tournament' })
  join(@CurrentUser() user: CurrentUserPayload, @Body() dto: JoinTournamentDto) {
    return this.tournamentsService.join(user.id, dto);
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  @Patch(':id')
  @ApiOperation({
    summary: 'Update tournament metadata or scoring rules (admin only)',
    description:
      'Admins can update `title`, `description`, `bannerUri`, and any scoring rules. ' +
      'Pass `scoringRules` as an array of `{ type, enabled, points? }` objects — only provided rules are updated. ' +
      'Example: disable UNHEALTHY_MEAL penalty: `{ "scoringRules": [{ "type": "UNHEALTHY_MEAL", "enabled": false }] }`.',
  })
  @ApiParam({ name: 'id', description: 'Tournament ID' })
  @ApiResponse({ status: 200, description: 'Updated tournament' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 404, description: 'Tournament not found' })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTournamentDto,
  ) {
    return this.tournamentsService.update(user.id, id, dto);
  }

  // ─── Leave / Delete ───────────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Leave or delete a tournament',
    description:
      'Behaviour depends on the caller\'s role:\n' +
      '- **Last admin** → deletes the entire tournament (members, activities, scoring rules) via cascade.\n' +
      '- **Admin with other admins** → removes only the caller from the member list.\n' +
      '- **Regular member** → removes only the caller from the member list.\n\n' +
      'To hand over control before leaving, promote another member first via `PATCH /:id/members/:userId/role`.',
  })
  @ApiParam({ name: 'id', description: 'Tournament ID' })
  @ApiResponse({ status: 204, description: 'Left (or deleted) successfully' })
  @ApiResponse({ status: 403, description: 'You are not a member of this tournament' })
  @ApiResponse({ status: 404, description: 'Tournament not found' })
  leave(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.tournamentsService.leave(user.id, id);
  }

  // ─── Member management ────────────────────────────────────────────────────

  @Delete(':id/members/:userId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Remove a member from the tournament (admin only)',
    description:
      'An admin can kick any other member. Admins cannot kick themselves — use `DELETE /tournaments/:id` instead. ' +
      'Leaderboard positions are recalculated after removal.',
  })
  @ApiParam({ name: 'id', description: 'Tournament ID' })
  @ApiParam({ name: 'userId', description: 'User ID to remove' })
  @ApiResponse({ status: 204, description: 'Member removed' })
  @ApiResponse({ status: 400, description: 'Cannot remove yourself via this endpoint' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  removeMember(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.tournamentsService.removeMember(user.id, id, targetUserId);
  }

  @Patch(':id/members/:userId/role')
  @ApiOperation({
    summary: 'Promote or demote a member (admin only)',
    description:
      'An admin can change any member\'s role between `MEMBER` and `ADMIN`. ' +
      'Constraints:\n' +
      '- An admin cannot demote themselves if they are the **sole admin** — promote another member first.\n' +
      '- There is no limit to the number of admins in a tournament.',
  })
  @ApiParam({ name: 'id', description: 'Tournament ID' })
  @ApiParam({ name: 'userId', description: 'Target user ID' })
  @ApiResponse({ status: 200, description: 'Updated member (role serialized in lowercase)' })
  @ApiResponse({ status: 400, description: 'Cannot demote the last admin' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  updateMemberRole(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.tournamentsService.updateMemberRole(user.id, id, targetUserId, dto);
  }

  // ─── Activity management ──────────────────────────────────────────────────

  @Delete(':id/activities/:actId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Remove an activity and revert its points (admin only)',
    description:
      'Deletes the activity record and **decrements** the affected member\'s points by the activity\'s point value. ' +
      'Leaderboard positions are recalculated after deletion. ' +
      'Points can go negative — there is no floor at zero.',
  })
  @ApiParam({ name: 'id', description: 'Tournament ID' })
  @ApiParam({ name: 'actId', description: 'Activity ID to delete' })
  @ApiResponse({ status: 204, description: 'Activity deleted and points reverted' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 404, description: 'Activity not found' })
  removeActivity(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Param('actId') actId: string,
  ) {
    return this.tournamentsService.removeActivity(user.id, id, actId);
  }
}
