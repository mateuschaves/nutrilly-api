import { Module } from '@nestjs/common';
import { HydrationService } from './hydration.service';
import { HydrationController } from './hydration.controller';
import { UnitsModule } from '../units/units.module';
import { AchievementsModule } from '../achievements/achievements.module';

@Module({
  imports: [UnitsModule, AchievementsModule],
  providers: [HydrationService],
  controllers: [HydrationController],
})
export class HydrationModule {}
