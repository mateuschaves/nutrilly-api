import { Module } from '@nestjs/common';
import { DiaryService } from './diary.service';
import { DiaryController } from './diary.controller';
import { UnitsModule } from '../units/units.module';
import { AchievementsModule } from '../achievements/achievements.module';
import { TournamentsModule } from '../tournaments/tournaments.module';

@Module({
  imports: [UnitsModule, AchievementsModule, TournamentsModule],
  providers: [DiaryService],
  controllers: [DiaryController],
})
export class DiaryModule {}
