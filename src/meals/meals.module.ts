import { Module } from '@nestjs/common';
import { MealsService } from './meals.service';
import { MealsController } from './meals.controller';
import { OpenAIModule } from '../openai/openai.module';

@Module({
  imports: [OpenAIModule],
  providers: [MealsService],
  controllers: [MealsController],
  exports: [MealsService],
})
export class MealsModule {}
