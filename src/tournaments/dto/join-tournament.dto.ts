import { IsString, IsNotEmpty } from 'class-validator';

export class JoinTournamentDto {
  @IsString()
  @IsNotEmpty()
  inviteCode: string;
}
