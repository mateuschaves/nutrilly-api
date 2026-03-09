import { IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWaterLogDto {
  @ApiProperty({ example: 250, description: 'Amount of water in milliliters' })
  @IsNumber()
  @Min(1)
  amount_ml: number;
}
