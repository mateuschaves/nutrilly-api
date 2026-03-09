import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FoodsService } from './foods.service';
import { CreateFoodDto } from './dto/create-food.dto';

@ApiTags('foods')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('foods')
export class FoodsController {
  constructor(private foodsService: FoodsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a food item in the catalog' })
  async create(@Body() dto: CreateFoodDto) {
    return this.foodsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all foods (optionally filter by name)' })
  @ApiQuery({ name: 'search', required: false })
  async findAll(@Query('search') search?: string) {
    return this.foodsService.findAll(search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a food by ID' })
  async findOne(@Param('id') id: string) {
    return this.foodsService.findById(id);
  }
}
