import { ApiProperty } from '@nestjs/swagger';

export class WaterLogResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  user_id: string;

  @ApiProperty({ example: 250, description: 'Amount of water logged in milliliters' })
  amount_ml: number;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  logged_at: string;
}

export class WaterTotalResponseDto {
  @ApiProperty({ example: 1500, description: "Total water consumed today in milliliters" })
  total_ml: number;
}
