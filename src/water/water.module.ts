import { Module } from '@nestjs/common';
import { WaterService } from './water.service';
import { WaterController } from './water.controller';
import { MealsModule } from '../meals/meals.module';

@Module({
  imports: [MealsModule],
  providers: [WaterService],
  controllers: [WaterController],
  exports: [WaterService],
})
export class WaterModule {}
