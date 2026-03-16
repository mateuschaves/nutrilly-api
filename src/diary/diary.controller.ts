import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { DiaryService } from './diary.service';
import { CreateDiaryEntryDto } from './dto/create-diary-entry.dto';

@UseGuards(JwtAuthGuard)
@Controller('diary')
export class DiaryController {
  constructor(private diaryService: DiaryService) {}

  @Get(':dateKey')
  getByDate(
    @CurrentUser() user: CurrentUserPayload,
    @Param('dateKey') dateKey: string,
  ) {
    return this.diaryService.getByDate(user.id, dateKey);
  }

  @Post(':dateKey/:mealId')
  addEntry(
    @CurrentUser() user: CurrentUserPayload,
    @Param('dateKey') dateKey: string,
    @Param('mealId') mealId: string,
    @Body() dto: CreateDiaryEntryDto,
  ) {
    return this.diaryService.addEntry(user.id, dateKey, mealId, dto);
  }

  @Delete(':dateKey/:mealId/:entryId')
  @HttpCode(204)
  removeEntry(
    @CurrentUser() user: CurrentUserPayload,
    @Param('dateKey') dateKey: string,
    @Param('mealId') mealId: string,
    @Param('entryId') entryId: string,
  ) {
    return this.diaryService.removeEntry(user.id, dateKey, mealId, entryId);
  }
}
