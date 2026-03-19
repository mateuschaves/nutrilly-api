import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUnitsDto } from './dto/update-units.dto';
import { ProfileScreenResponseDto } from './dto/profile-screen-response.dto';

@ApiTags('profile')
@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private profileService: ProfileService) {}

  @Get()
  @ApiOperation({ summary: 'Get full profile screen data' })
  @ApiResponse({
    status: 200,
    type: ProfileScreenResponseDto,
    description:
      'Returns all data needed to populate the profile screen: user info, body stats, ' +
      "weight progress chart, and today's daily goal progress. " +
      "All values are converted to the user's preferred units.",
  })
  getProfile(@CurrentUser() user: CurrentUserPayload) {
    return this.profileService.getProfileScreen(user.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Update profile data' })
  updateProfile(@CurrentUser() user: CurrentUserPayload, @Body() dto: UpdateProfileDto) {
    return this.profileService.updateProfile(user.id, dto);
  }

  @Get('units')
  @ApiOperation({ summary: 'Get user unit preferences' })
  getUnits(@CurrentUser() user: CurrentUserPayload) {
    return this.profileService.getUnits(user.id);
  }

  @Patch('units')
  @ApiOperation({ summary: 'Update user unit preferences' })
  updateUnits(@CurrentUser() user: CurrentUserPayload, @Body() dto: UpdateUnitsDto) {
    return this.profileService.updateUnits(user.id, dto);
  }
}
