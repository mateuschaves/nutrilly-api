import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MealsService } from './meals.service';
import { OpenAIService } from '../openai/openai.service';
import { CreateMealDto } from './dto/create-meal.dto';
import { CreateMealFromPhotoDto } from './dto/create-meal-from-photo.dto';
import { CreateMealFromDescriptionDto } from './dto/create-meal-from-description.dto';

@ApiTags('meals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('meals')
export class MealsController {
  constructor(
    private mealsService: MealsService,
    private openAIService: OpenAIService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a meal with items' })
  async create(@Request() req, @Body() dto: CreateMealDto) {
    return this.mealsService.create(req.user.id, dto);
  }

  @Post('from-photo')
  @ApiOperation({
    summary: 'Create a meal by uploading a photo (AI infers macros)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'photo'],
      properties: {
        name: {
          type: 'string',
          enum: ['breakfast', 'lunch', 'dinner', 'snack'],
          example: 'lunch',
        },
        eaten_at: {
          type: 'string',
          description: 'ISO date string for when the meal was eaten',
        },
        photo: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('photo'))
  async createFromPhoto(
    @Request() req,
    @Body() dto: CreateMealFromPhotoDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Photo file is required');
    }

    const inferredMeal = await this.openAIService.inferMacrosFromPhoto(
      file.buffer,
      file.mimetype,
    );

    return this.mealsService.createFromAI(
      req.user.id,
      dto.name,
      dto.eaten_at,
      inferredMeal,
    );
  }

  @Post('from-description')
  @ApiOperation({
    summary: 'Create a meal from a text description (AI infers macros)',
  })
  async createFromDescription(
    @Request() req,
    @Body() dto: CreateMealFromDescriptionDto,
  ) {
    const inferredMeal = await this.openAIService.inferMacrosFromDescription(
      dto.description,
    );

    return this.mealsService.createFromAI(
      req.user.id,
      dto.name,
      dto.eaten_at,
      inferredMeal,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all meals for current user' })
  async findAll(@Request() req) {
    return this.mealsService.findUserMeals(req.user.id);
  }
}
