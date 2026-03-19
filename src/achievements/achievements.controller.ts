import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AchievementsService } from './achievements.service';
import { AchievementDto } from './dto/achievement-response.dto';

@ApiTags('Achievements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('achievements')
export class AchievementsController {
  constructor(private readonly achievementsService: AchievementsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all achievements with earned status' })
  @ApiQuery({ name: 'category', required: false, enum: ['consistency', 'hydration', 'nutrition', 'behavior', 'milestone'] })
  getAchievements(
    @CurrentUser('id') userId: string,
    @Query('category') category?: string,
  ): Promise<AchievementDto[]> {
    return this.achievementsService.getAchievements(userId, category);
  }
}
