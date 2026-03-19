import { ApiProperty } from '@nestjs/swagger';
import { WeightSource } from '../weight.types';

export class WeightLogResponseDto {
  @ApiProperty({ example: 'clx1y2z3a0000abc123def456' })
  id: string;

  @ApiProperty({ example: 78.5, description: 'Weight stored in kg' })
  weightKg: number;

  @ApiProperty({
    enum: WeightSource,
    enumName: 'WeightSource',
    example: WeightSource.AppleHealth,
  })
  source: WeightSource;

  @ApiProperty({ example: '2026-03-19T08:00:00.000Z' })
  loggedAt: string;
}
