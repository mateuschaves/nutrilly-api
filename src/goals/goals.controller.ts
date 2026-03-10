import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GoalsService } from './goals.service';
import { UpsertGoalsDto } from './dto/upsert-goals.dto';
import { GoalsResponseDto } from './dto/goals-response.dto';

@ApiTags('goals')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('goals')
export class GoalsController {
  constructor(private goalsService: GoalsService) {}

  @Put()
  @ApiOperation({ summary: 'Create or update user daily goals' })
  @ApiResponse({ status: 200, description: 'Daily goals saved successfully', type: GoalsResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error – invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized – missing or invalid bearer token' })
  async upsert(@Request() req, @Body() dto: UpsertGoalsDto) {
    return this.goalsService.upsertGoals(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get user daily goals' })
  @ApiResponse({ status: 200, description: "User's daily goals", type: GoalsResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized – missing or invalid bearer token' })
  async get(@Request() req) {
    return this.goalsService.getGoals(req.user.id);
  }
}
