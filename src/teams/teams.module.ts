import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TeamsController } from './controller/teams.controller';
import { TeamsService } from './services/teams.service';
import { NationalTeam, NationalTeamSchema } from './model/national-team.schema';
import { NationalTeamRepository } from './repository/national-team.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NationalTeam.name, schema: NationalTeamSchema },
    ]),
  ],
  controllers: [TeamsController],
  providers: [NationalTeamRepository, TeamsService],
  exports: [NationalTeamRepository, TeamsService],
})
export class TeamsModule {}
