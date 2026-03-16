import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { MealsService } from './meals.service';
import { CreateMealDto } from './dto/create-meal.dto';
import { UpdateMealDto } from './dto/update-meal.dto';

@UseGuards(JwtAuthGuard)
@Controller('meals')
export class MealsController {
  constructor(private mealsService: MealsService) {}

  @Get()
  findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.mealsService.findAll(user.id);
  }

  @Post()
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateMealDto) {
    return this.mealsService.create(user.id, dto);
  }

  @Patch(':mealId')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('mealId') mealId: string,
    @Body() dto: UpdateMealDto,
  ) {
    return this.mealsService.update(user.id, mealId, dto);
  }

  @Delete(':mealId')
  @HttpCode(204)
  remove(@CurrentUser() user: CurrentUserPayload, @Param('mealId') mealId: string) {
    return this.mealsService.remove(user.id, mealId);
  }
}
