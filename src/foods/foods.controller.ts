import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiParam, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FoodsService } from './foods.service';
import { CreateFoodDto } from './dto/create-food.dto';
import { FoodResponseDto } from './dto/food-response.dto';

@ApiTags('foods')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('foods')
export class FoodsController {
  constructor(private foodsService: FoodsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a food item in the catalog' })
  @ApiResponse({ status: 201, description: 'Food item created successfully', type: FoodResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error – invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized – missing or invalid bearer token' })
  async create(@Body() dto: CreateFoodDto) {
    return this.foodsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all foods (optionally filter by name)' })
  @ApiQuery({ name: 'search', required: false, description: 'Filter foods by name (case-insensitive, partial match)' })
  @ApiResponse({ status: 200, description: 'List of food items', type: [FoodResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized – missing or invalid bearer token' })
  async findAll(@Query('search') search?: string) {
    return this.foodsService.findAll(search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a food item by ID' })
  @ApiParam({ name: 'id', description: 'UUID of the food item', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @ApiResponse({ status: 200, description: 'Food item retrieved successfully', type: FoodResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized – missing or invalid bearer token' })
  @ApiResponse({ status: 404, description: 'Food item not found' })
  async findOne(@Param('id') id: string) {
    return this.foodsService.findById(id);
  }
}
