import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GoogleLoginDto {
  @ApiProperty({
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6Ikp...',
    description: 'Google ID token obtained from Google Sign-In',
  })
  @IsString()
  idToken: string;
}
