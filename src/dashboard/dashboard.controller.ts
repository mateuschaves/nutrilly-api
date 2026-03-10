import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import { DashboardResponseDto } from './dto/dashboard-response.dto';

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
}
