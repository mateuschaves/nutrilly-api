import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StreaksService } from './streaks.service';
import { StreakResponseDto } from './dto/streak-response.dto';

@ApiTags('streaks')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('streaks')
export class StreaksController {
  constructor(private streaksService: StreaksService) {}

  @Get()
  @ApiOperation({
    summary: 'Get current streak for user',
    description: "Returns the user's current and best consecutive-day streak. A streak day is counted when the user meets at least 90% of their daily calorie goal.",
  })
  @ApiResponse({ status: 200, description: "User's streak data retrieved successfully", type: StreakResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized – missing or invalid bearer token' })
  async getStreak(@Request() req) {
    return this.streaksService.getStreak(req.user.id);
  }
}
