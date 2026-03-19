import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { WeightService } from './weight.service';
import { LogWeightDto } from './dto/log-weight.dto';
import { WeightLogResponseDto } from './dto/weight-log-response.dto';

@ApiTags('weight')
@UseGuards(JwtAuthGuard)
@Controller('weight')
export class WeightController {
  constructor(private weightService: WeightService) {}

  @Post()
  @ApiOperation({
    summary: 'Log a weight measurement',
    description:
      'Records a weight entry from any supported source (Apple Health, Samsung Health, Google Fit, or manual input). ' +
      'Provide loggedAt to backfill historical data from a health provider.',
  })
  @ApiResponse({ status: 201, type: WeightLogResponseDto })
  logWeight(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: LogWeightDto,
  ) {
    return this.weightService.logWeight(user.id, dto);
  }
}
