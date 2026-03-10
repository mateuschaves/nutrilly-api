import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WaterService } from './water.service';
import { CreateWaterLogDto } from './dto/create-water-log.dto';
import { WaterLogResponseDto, WaterTotalResponseDto } from './dto/water-response.dto';

@ApiTags('water')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('water')
export class WaterController {
  constructor(private waterService: WaterService) {}

  @Post()
  @ApiOperation({ summary: 'Log water intake' })
  @ApiResponse({ status: 201, description: 'Water intake logged successfully', type: WaterLogResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error – invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized – missing or invalid bearer token' })
  async logWater(@Request() req, @Body() dto: CreateWaterLogDto) {
    return this.waterService.logWater(req.user.id, dto);
  }

  @Get('today')
  @ApiOperation({ summary: "Get today's total water intake" })
  @ApiResponse({ status: 200, description: "Today's total water intake in milliliters", type: WaterTotalResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized – missing or invalid bearer token' })
  async getTodayTotal(@Request() req) {
    return this.waterService.getTodayTotal(req.user.id);
  }
}
