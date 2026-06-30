import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TournamentsController } from './controller/tournaments.controller';
import { TournamentsService } from './services/tournaments.service';
import { TournamentSimulationService } from './services/tournament-simulation.service';
import { Tournament, TournamentSchema } from './model/tournament.schema';
import { TeamsModule } from '../teams/teams.module';
import { TournamentRepository } from './repository/tournament.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tournament.name, schema: TournamentSchema },
    ]),
    TeamsModule,
  ],
  controllers: [TournamentsController],
  providers: [
    TournamentRepository,
    TournamentsService,
    TournamentSimulationService,
  ],
  exports: [
    TournamentRepository,
    TournamentsService,
    TournamentSimulationService,
  ],
})
export class TournamentsModule {}
