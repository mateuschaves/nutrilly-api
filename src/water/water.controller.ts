import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WaterService } from './water.service';
import { CreateWaterLogDto } from './dto/create-water-log.dto';

@ApiTags('water')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('water')
export class WaterController {
  constructor(private waterService: WaterService) {}

  @Post()
  @ApiOperation({ summary: 'Log water intake' })
  async logWater(@Request() req, @Body() dto: CreateWaterLogDto) {
    return this.waterService.logWater(req.user.id, dto);
  }

  @Get('today')
  @ApiOperation({ summary: "Get today's water total" })
  async getTodayTotal(@Request() req) {
    return this.waterService.getTodayTotal(req.user.id);
  }
}
