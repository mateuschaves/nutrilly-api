import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { HydrationService } from './hydration.service';
import { CreateHydrationEntryDto } from './dto/create-hydration-entry.dto';
import { AddHydrationEntryResponseDto, HydrationByDateResponseDto } from './dto/hydration-response.dto';

@ApiTags('hydration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hydration')
export class HydrationController {
  constructor(private hydrationService: HydrationService) {}

  @Get(':dateKey')
  @ApiOperation({ summary: 'Get hydration entries for a given date' })
  @ApiResponse({ status: 200, type: HydrationByDateResponseDto, description: 'Hydration summary with entries, totalConsumed, goal, and unit in the user\'s preferred water unit' })
  @ApiResponse({ status: 400, description: 'Invalid date format' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getByDate(
    @CurrentUser() user: CurrentUserPayload,
    @Param('dateKey') dateKey: string,
  ) {
    return this.hydrationService.getByDate(user.id, dateKey);
  }

  @Post(':dateKey')
  @ApiOperation({
    summary: 'Add a hydration entry',
    description: 'Logs a water intake entry. The response includes a `newAchievements` array with any achievements unlocked by this action — the frontend should use this to display a congratulations animation.',
  })
  @ApiResponse({
    status: 201,
    type: AddHydrationEntryResponseDto,
    description: 'Entry created. `newAchievements` is empty when no achievements were unlocked.',
  })
  @ApiResponse({ status: 400, description: 'Invalid date format or missing fields' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  addEntry(
    @CurrentUser() user: CurrentUserPayload,
    @Param('dateKey') dateKey: string,
    @Body() dto: CreateHydrationEntryDto,
  ) {
    return this.hydrationService.addEntry(user.id, dateKey, dto);
  }

  @Delete(':dateKey/:entryId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a hydration entry' })
  @ApiResponse({ status: 204, description: 'Entry deleted' })
  @ApiResponse({ status: 400, description: 'Invalid date format' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Entry not found' })
  removeEntry(
    @CurrentUser() user: CurrentUserPayload,
    @Param('dateKey') dateKey: string,
    @Param('entryId') entryId: string,
  ) {
    return this.hydrationService.removeEntry(user.id, dateKey, entryId);
  }
}
