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
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MealsService } from './meals.service';
import { OpenAIService } from '../openai/openai.service';
import { S3Service } from '../s3/s3.service';
import { CreateMealDto } from './dto/create-meal.dto';
import { CreateMealFromPhotoDto } from './dto/create-meal-from-photo.dto';
import { CreateMealFromDescriptionDto } from './dto/create-meal-from-description.dto';
import { MealResponseDto } from './dto/meal-response.dto';

@ApiTags('meals')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('meals')
export class MealsController {
  constructor(
    private mealsService: MealsService,
    private openAIService: OpenAIService,
    private s3Service: S3Service,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a meal with items' })
  @ApiResponse({ status: 201, description: 'Meal created successfully', type: MealResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error – invalid request body or food not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized – missing or invalid bearer token' })
  async create(@Request() req, @Body() dto: CreateMealDto) {
    return this.mealsService.create(req.user.id, dto);
  }

  @Post('from-photo')
  @ApiOperation({
    summary: 'Create a meal by uploading a photo (AI infers macros)',
    description: 'Upload a food photo and let AI automatically identify the food items and calculate nutritional macros. The photo is moderated before processing.',
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
          format: 'date-time',
          description: 'ISO 8601 date-time string for when the meal was eaten (defaults to now)',
          example: '2024-01-15T12:30:00.000Z',
        },
        photo: { type: 'string', format: 'binary', description: 'Food photo file (JPEG or PNG)' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Meal created successfully from photo', type: MealResponseDto })
  @ApiResponse({ status: 400, description: 'Photo file is missing or invalid' })
  @ApiResponse({ status: 401, description: 'Unauthorized – missing or invalid bearer token' })
  @ApiResponse({ status: 403, description: 'Photo flagged as inappropriate and rejected' })
  @UseInterceptors(FileInterceptor('photo'))
  async createFromPhoto(
    @Request() req,
    @Body() dto: CreateMealFromPhotoDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'Photo file is required. Please upload an image file (e.g., JPEG, PNG)',
      );
    }

    const moderation = await this.openAIService.moderatePhoto(
      file.buffer,
      file.mimetype,
    );

    if (moderation.flagged) {
      await this.mealsService.flagSuspiciousPhoto(req.user.id, moderation);
      throw new ForbiddenException(
        'The uploaded photo was flagged as inappropriate and has been logged for review.',
      );
    }

    const inferredMeal = await this.openAIService.inferMacrosFromPhoto(
      file.buffer,
      file.mimetype,
    );

    const photoUrl = await this.s3Service.uploadMealPhoto(
      req.user.id,
      file.buffer,
      file.mimetype,
    );

    return this.mealsService.createFromAI(
      req.user.id,
      dto.name,
      dto.eaten_at,
      inferredMeal,
      photoUrl,
    );
  }

  @Post('from-description')
  @ApiOperation({
    summary: 'Create a meal from a text description (AI infers macros)',
    description: 'Describe the food you ate in natural language and let AI automatically calculate nutritional macros.',
  })
  @ApiResponse({ status: 201, description: 'Meal created successfully from description', type: MealResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error – invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized – missing or invalid bearer token' })
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
  @ApiOperation({ summary: 'Get all meals for current user', description: 'Returns all meals logged by the authenticated user, ordered by most recent first.' })
  @ApiResponse({ status: 200, description: 'List of meals retrieved successfully', type: [MealResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized – missing or invalid bearer token' })
  async findAll(@Request() req) {
    return this.mealsService.findUserMeals(req.user.id);
  }
}
