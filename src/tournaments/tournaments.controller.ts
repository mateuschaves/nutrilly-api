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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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

  @Get()
  @ApiOperation({ summary: 'List all tournaments the user is a member of' })
  @ApiResponse({ status: 200 })
  findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.tournamentsService.findAll(user.id);
  }

  @Get('active')
  @ApiOperation({ summary: 'List active tournaments the user belongs to (for meal log selector)' })
  @ApiResponse({ status: 200 })
  findActive(@CurrentUser() user: CurrentUserPayload) {
    return this.tournamentsService.findActive(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a tournament by id (members only)' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403, description: 'Not a member' })
  @ApiResponse({ status: 404, description: 'Tournament not found' })
  findById(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.tournamentsService.findById(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new tournament' })
  @ApiResponse({ status: 201 })
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateTournamentDto) {
    return this.tournamentsService.create(user.id, dto);
  }

  @Post('join')
  @ApiOperation({ summary: 'Join a tournament using an invite code' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 400, description: 'Tournament ended' })
  @ApiResponse({ status: 404, description: 'Invalid invite code' })
  @ApiResponse({ status: 409, description: 'Already a member' })
  join(@CurrentUser() user: CurrentUserPayload, @Body() dto: JoinTournamentDto) {
    return this.tournamentsService.join(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update tournament title, description, banner, or scoring rules (admin)' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTournamentDto,
  ) {
    return this.tournamentsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Leave or delete a tournament. Last admin deletes it entirely.' })
  @ApiResponse({ status: 204 })
  leave(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.tournamentsService.leave(user.id, id);
  }

  @Delete(':id/members/:userId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a member from the tournament (admin only)' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  removeMember(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.tournamentsService.removeMember(user.id, id, targetUserId);
  }

  @Patch(':id/members/:userId/role')
  @ApiOperation({ summary: 'Promote or demote a member (admin only)' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 400, description: 'Cannot demote last admin' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  updateMemberRole(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.tournamentsService.updateMemberRole(user.id, id, targetUserId, dto);
  }

  @Delete(':id/activities/:actId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an activity and revert its points (admin only)' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  removeActivity(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Param('actId') actId: string,
  ) {
    return this.tournamentsService.removeActivity(user.id, id, actId);
  }
}
