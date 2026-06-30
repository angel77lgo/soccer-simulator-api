import { Injectable, NotFoundException } from '@nestjs/common';
import { NationalTeamRepository } from '../repository/national-team.repository';
import { toObjectId } from '../../common/objectid.util';

@Injectable()
export class TeamsService {
  constructor(private readonly teamRepo: NationalTeamRepository) {}

  async findAll(skip = 0, limit = 211) {
    const teams = await this.teamRepo.find({ skip, take: limit });
    return teams.map((team) => {
      const teamObj = (team as any).toObject ? (team as any).toObject() : team;
      return {
        id: teamObj._id,
        name: teamObj.name,
        shortName: teamObj.shortName,
        fifaCode: teamObj.fifaCode,
        flagUrl: teamObj.flagUrl,
        fifaRanking: teamObj.fifaRanking,
        simulationRating: teamObj.simulationRating,
        matchesPlayed: teamObj.matchesPlayed,
        wins: teamObj.wins,
        draws: teamObj.draws,
        losses: teamObj.losses,
        goalsFor: teamObj.goalsFor,
        goalsAgainst: teamObj.goalsAgainst,
        internationalTitles: teamObj.internationalTitles,
        confederation: teamObj.confederation,
      };
    });
  }

  async findOne(id: string) {
    const team = await this.teamRepo.findById(id);
    if (!team) throw new NotFoundException('Team not found');
    return team;
  }
}
