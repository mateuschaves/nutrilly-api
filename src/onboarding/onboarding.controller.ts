import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { OnboardingService } from './onboarding.service';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';

@ApiTags('onboarding')
@UseGuards(JwtAuthGuard)
@Controller('onboarding')
export class OnboardingController {
  constructor(private onboardingService: OnboardingService) {}

  @Post('complete')
  @ApiOperation({ summary: 'Complete user onboarding and save all profile data' })
  @ApiResponse({
    status: 201,
    description:
      'Saves all onboarding data (goal, body info, activity level, daily goals) to the user profile. ' +
      'Idempotent — calling again overwrites previous data.',
  })
  completeOnboarding(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CompleteOnboardingDto,
  ) {
    return this.onboardingService.completeOnboarding(user.id, dto);
  }
}
