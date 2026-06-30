import { Module } from '@nestjs/common';
import { SimulationController } from './controller/simulation.controller';
import { SimulationService } from './services/simulation.service';
import { TeamsModule } from '../teams/teams.module';
import { TournamentsModule } from '../tournaments/tournaments.module';

@Module({
  imports: [TeamsModule, TournamentsModule],
  controllers: [SimulationController],
  providers: [SimulationService],
})
export class SimulationModule {}
