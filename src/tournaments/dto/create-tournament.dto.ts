import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTournamentDto {
  @ApiProperty({ example: 'Desafio Janeiro Saudável' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Quem acumular mais pontos no mês vence!' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/banner.jpg',
    description: 'Banner image URL',
  })
  @IsOptional()
  @IsString()
  bannerUri?: string;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Tournament start date (ISO-8601). Status transitions to ACTIVE automatically when this date is reached.',
  })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({
    example: '2024-01-31T23:59:59.000Z',
    description: 'Tournament end date (ISO-8601). Omit to create an open-ended tournament.',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
