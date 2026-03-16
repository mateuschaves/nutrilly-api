import { IsInt, Min } from 'class-validator';

export class CreateHydrationEntryDto {
  @IsInt()
  @Min(1)
  amountMl: number;
}
