import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { DevicesService } from './devices.service';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';

@ApiTags('devices')
@UseGuards(JwtAuthGuard)
@Controller('devices')
export class DevicesController {
  constructor(private devicesService: DevicesService) {}

  @Post('push-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Register device push token',
    description:
      'Registers or updates the Expo push notification token for the authenticated user\'s device. ' +
      'Performs an upsert — the same token is never duplicated.',
  })
  @ApiResponse({ status: 200, description: 'Token registered successfully' })
  registerPushToken(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: RegisterPushTokenDto,
  ) {
    return this.devicesService.registerPushToken(user.id, dto);
  }
}
