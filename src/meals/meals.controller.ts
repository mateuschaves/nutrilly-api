import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MealsService } from './meals.service';
import { CreateMealDto } from './dto/create-meal.dto';

@ApiTags('meals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('meals')
export class MealsController {
  constructor(private mealsService: MealsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a meal with items' })
  async create(@Request() req, @Body() dto: CreateMealDto) {
    return this.mealsService.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all meals for current user' })
  async findAll(@Request() req) {
    return this.mealsService.findUserMeals(req.user.id);
  }
}
