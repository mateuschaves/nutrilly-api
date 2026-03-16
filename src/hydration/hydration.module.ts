import { Module } from '@nestjs/common';
import { HydrationService } from './hydration.service';
import { HydrationController } from './hydration.controller';
import { UnitsModule } from '../units/units.module';

@Module({
  imports: [UnitsModule],
  providers: [HydrationService],
  controllers: [HydrationController],
})
export class HydrationModule {}
