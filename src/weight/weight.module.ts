import { Module } from '@nestjs/common';
import { WeightController } from './weight.controller';
import { WeightService } from './weight.service';
import { TournamentsModule } from '../tournaments/tournaments.module';

@Module({
  imports: [TournamentsModule],
  controllers: [WeightController],
  providers: [WeightService],
})
export class WeightModule {}
