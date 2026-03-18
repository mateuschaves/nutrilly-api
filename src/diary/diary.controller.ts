import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { DiaryService } from './diary.service';
import { CreateDiaryEntryDto } from './dto/create-diary-entry.dto';
import { DiaryEntryResponseDto, MealSectionResponseDto } from './dto/diary-response.dto';

@ApiTags('diary')
@UseGuards(JwtAuthGuard)
@Controller('diary')
export class DiaryController {
  constructor(private diaryService: DiaryService) {}

  @Get(':dateKey')
  @ApiOperation({ summary: 'Get diary for a given date' })
  @ApiResponse({ status: 200, type: [MealSectionResponseDto] })
  getByDate(
    @CurrentUser() user: CurrentUserPayload,
    @Param('dateKey') dateKey: string,
  ) {
    return this.diaryService.getByDate(user.id, dateKey);
  }

  @Post(':dateKey/:mealId')
  @ApiOperation({ summary: 'Add a diary entry to a meal' })
  @ApiResponse({ status: 201, type: DiaryEntryResponseDto })
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
  @ApiOperation({ summary: 'Remove a diary entry' })
  @ApiResponse({ status: 204, description: 'Entry deleted' })
  removeEntry(
    @CurrentUser() user: CurrentUserPayload,
    @Param('dateKey') dateKey: string,
    @Param('mealId') mealId: string,
    @Param('entryId') entryId: string,
  ) {
    return this.diaryService.removeEntry(user.id, dateKey, mealId, entryId);
  }
}
