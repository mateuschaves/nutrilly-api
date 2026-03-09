import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GoalsService } from './goals.service';
import { UpsertGoalsDto } from './dto/upsert-goals.dto';

@ApiTags('goals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('goals')
export class GoalsController {
  constructor(private goalsService: GoalsService) {}

  @Put()
  @ApiOperation({ summary: 'Create or update user daily goals' })
  async upsert(@Request() req, @Body() dto: UpsertGoalsDto) {
    return this.goalsService.upsertGoals(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get user daily goals' })
  async get(@Request() req) {
    return this.goalsService.getGoals(req.user.id);
  }
}
