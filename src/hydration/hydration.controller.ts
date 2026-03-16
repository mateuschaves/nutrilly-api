import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { HydrationService } from './hydration.service';
import { CreateHydrationEntryDto } from './dto/create-hydration-entry.dto';

@UseGuards(JwtAuthGuard)
@Controller('hydration')
export class HydrationController {
  constructor(private hydrationService: HydrationService) {}

  @Get(':dateKey')
  getByDate(
    @CurrentUser() user: CurrentUserPayload,
    @Param('dateKey') dateKey: string,
  ) {
    return this.hydrationService.getByDate(user.id, dateKey);
  }

  @Post(':dateKey')
  addEntry(
    @CurrentUser() user: CurrentUserPayload,
    @Param('dateKey') dateKey: string,
    @Body() dto: CreateHydrationEntryDto,
  ) {
    return this.hydrationService.addEntry(user.id, dateKey, dto);
  }

  @Delete(':dateKey/:entryId')
  @HttpCode(204)
  removeEntry(
    @CurrentUser() user: CurrentUserPayload,
    @Param('dateKey') dateKey: string,
    @Param('entryId') entryId: string,
  ) {
    return this.hydrationService.removeEntry(user.id, dateKey, entryId);
  }
}
