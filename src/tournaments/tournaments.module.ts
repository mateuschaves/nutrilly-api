import { Module } from '@nestjs/common';
import { TournamentsController } from './tournaments.controller';
import { TournamentsService } from './tournaments.service';
import { TournamentScoringService } from './scoring/scoring.service';
import { TournamentSchedulerService } from './tournament-scheduler.service';

@Module({
  controllers: [TournamentsController],
  providers: [TournamentsService, TournamentScoringService, TournamentSchedulerService],
  exports: [TournamentScoringService],
})
export class TournamentsModule {}
