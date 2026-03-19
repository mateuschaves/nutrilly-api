import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { DiaryService } from './diary.service';
import { CreateDiaryEntryDto } from './dto/create-diary-entry.dto';
import { AddDiaryEntryResponseDto, MealSectionResponseDto } from './dto/diary-response.dto';

@ApiTags('diary')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('diary')
export class DiaryController {
  constructor(private diaryService: DiaryService) {}

  @Get(':dateKey')
  @ApiOperation({ summary: 'Get diary for a given date' })
  @ApiResponse({ status: 200, type: [MealSectionResponseDto] })
  @ApiResponse({ status: 400, description: 'Invalid date format' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getByDate(
    @CurrentUser() user: CurrentUserPayload,
    @Param('dateKey') dateKey: string,
  ) {
    return this.diaryService.getByDate(user.id, dateKey);
  }

  @Post(':dateKey/:mealId')
  @ApiOperation({
    summary: 'Add a diary entry to a meal',
    description: 'Creates a new food entry in the specified meal. The response includes a `newAchievements` array with any achievements unlocked by this action — the frontend should use this to display a congratulations animation.',
  })
  @ApiResponse({
    status: 201,
    type: AddDiaryEntryResponseDto,
    description: 'Entry created. `newAchievements` is empty when no achievements were unlocked.',
  })
  @ApiResponse({ status: 400, description: 'Invalid date format or missing fields' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Meal not found' })
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
  @ApiResponse({ status: 400, description: 'Invalid date format' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Entry not found' })
  removeEntry(
    @CurrentUser() user: CurrentUserPayload,
    @Param('dateKey') dateKey: string,
    @Param('mealId') mealId: string,
    @Param('entryId') entryId: string,
  ) {
    return this.diaryService.removeEntry(user.id, dateKey, mealId, entryId);
  }
}
