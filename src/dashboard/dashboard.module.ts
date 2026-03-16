import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { UnitsModule } from '../units/units.module';

@Module({
  imports: [UnitsModule],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
