import { Controller, Get, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import { DashboardResponseDto } from './dto/dashboard-response.dto';
import { GetDailySummaryDto } from './dto/get-daily-summary.dto';
import { DailySummaryResponseDto } from './dto/daily-summary-response.dto';

@ApiTags('dashboard')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('today')
  @ApiOperation({
    summary: "Get today's dashboard data",
    description: "Returns a complete summary of the user's nutrition and hydration progress for today, including calories, macros, water intake, last meal, and streak information.",
  })
  @ApiResponse({ status: 200, description: "Today's dashboard data retrieved successfully", type: DashboardResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized – missing or invalid bearer token' })
  async getToday(@Request() req) {
    return this.dashboardService.getTodayDashboard(req.user.id);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Get daily nutrition summary',
    description: "Returns the user's calorie progress, macronutrients, hydration, last meal, and streak for the given date. Values are already converted to the user's preferred units (kcal/kj for energy, l/fl_oz for water).",
  })
  @ApiQuery({ name: 'date', required: true, type: String, example: '2025-03-15', description: 'Date in YYYY-MM-DD format' })
  @ApiResponse({ status: 200, description: 'Daily summary retrieved successfully', type: DailySummaryResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid date format' })
  @ApiResponse({ status: 401, description: 'Unauthorized – missing or invalid bearer token' })
  async getDailySummary(@Request() req, @Query() query: GetDailySummaryDto) {
    return this.dashboardService.getDailySummary(req.user.id, query.date);
  }
}
