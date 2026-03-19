import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsNumber, IsOptional, IsPositive } from 'class-validator';
import { WeightSource } from '../weight.types';

export class LogWeightDto {
  @ApiProperty({
    example: 78.5,
    description: 'Weight in kilograms (always stored internally in kg)',
  })
  @IsNumber()
  @IsPositive()
  weightKg: number;

  @ApiProperty({
    enum: WeightSource,
    enumName: 'WeightSource',
    example: WeightSource.AppleHealth,
    description:
      'Origin of the weight measurement. ' +
      'APPLE_HEALTH: synced from Apple Health. ' +
      'SAMSUNG_HEALTH: synced from Samsung Health. ' +
      'GOOGLE_FIT: synced from Google Fit. ' +
      'MANUAL: entered manually by the user.',
  })
  @IsEnum(WeightSource)
  source: WeightSource;

  @ApiPropertyOptional({
    example: '2026-03-19T08:00:00.000Z',
    description:
      'ISO-8601 datetime of the measurement. Defaults to the current server time if omitted. ' +
      'Use this field when syncing historical data from a health provider.',
  })
  @IsOptional()
  @IsISO8601()
  loggedAt?: string;
}
