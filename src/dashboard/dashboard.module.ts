import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { UnitsModule } from '../units/units.module';
import { TournamentsModule } from '../tournaments/tournaments.module';

@Module({
  imports: [UnitsModule, TournamentsModule],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
