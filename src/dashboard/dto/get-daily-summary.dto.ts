import { IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetDailySummaryDto {
  @ApiProperty({ example: '2025-03-15', description: 'Date in YYYY-MM-DD format' })
  @IsDateString()
  date: string;
}
