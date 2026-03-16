import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';
import { GetDailySummaryDto } from './dto/get-daily-summary.dto';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('summary')
  getDailySummary(@CurrentUser() user: CurrentUserPayload, @Query() query: GetDailySummaryDto) {
    return this.dashboardService.getDailySummary(user.id, query.date);
  }
}
