import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AppleLoginDto {
  @ApiProperty({
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6Ikp...',
    description: 'Apple identity token obtained from Sign in with Apple',
  })
  @IsString()
  identityToken: string;

  @ApiPropertyOptional({
    example: 'John Doe',
    description: 'User name provided by Apple on first sign-in (may be null on subsequent sign-ins)',
  })
  @IsString()
  @IsOptional()
  fullName?: string;
}
