import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StreaksService } from './streaks.service';

@ApiTags('streaks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('streaks')
export class StreaksController {
  constructor(private streaksService: StreaksService) {}

  @Get()
  @ApiOperation({ summary: 'Get current streak for user' })
  async getStreak(@Request() req) {
    return this.streaksService.getStreak(req.user.id);
  }
}
