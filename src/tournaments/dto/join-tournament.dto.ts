import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class JoinTournamentDto {
  @ApiProperty({
    example: 'KBCD-4827',
    description: 'Invite code in format XXXX-YYYY (uppercase letters and digits)',
  })
  @IsString()
  @IsNotEmpty()
  inviteCode: string;
}
