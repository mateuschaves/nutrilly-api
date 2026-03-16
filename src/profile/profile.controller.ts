import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUnitsDto } from './dto/update-units.dto';

@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private profileService: ProfileService) {}

  @Get()
  getProfile(@CurrentUser() user: CurrentUserPayload) {
    return this.profileService.getProfile(user.id);
  }

  @Patch()
  updateProfile(@CurrentUser() user: CurrentUserPayload, @Body() dto: UpdateProfileDto) {
    return this.profileService.updateProfile(user.id, dto);
  }

  @Get('units')
  getUnits(@CurrentUser() user: CurrentUserPayload) {
    return this.profileService.getUnits(user.id);
  }

  @Patch('units')
  updateUnits(@CurrentUser() user: CurrentUserPayload, @Body() dto: UpdateUnitsDto) {
    return this.profileService.updateUnits(user.id, dto);
  }
}
