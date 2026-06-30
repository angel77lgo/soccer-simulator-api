import { Injectable, NotFoundException } from '@nestjs/common';
import { NationalTeamRepository } from '../../teams/repository/national-team.repository';
import { toObjectId } from '../../common/objectid.util';

@Injectable()
export class SimulationService {
  constructor(private readonly teamRepo: NationalTeamRepository) {}

  private calculateGoals(
    ratingDiff: number,
    baseAdvantage = 0.5,
  ): [number, number] {
    const expectedHome = Math.max(0.1, 1.2 + ratingDiff * 0.05 + baseAdvantage);
    const expectedAway = Math.max(0.1, 1.2 - ratingDiff * 0.05);

    const poisson = (lambda: number): number => {
      let goals = 0;
      const L = Math.exp(-lambda);
      let p = 1;
      while (p > L) {
        p *= Math.random();
        goals++;
      }
      return Math.max(0, goals - 1);
    };

    return [poisson(expectedHome), poisson(expectedAway)];
  }

  async simulate(homeId: string, awayId: string) {
    const homeTeam = await this.teamRepo.findOne({
      where: { _id: toObjectId(homeId) },
    });
    const awayTeam = await this.teamRepo.findOne({
      where: { _id: toObjectId(awayId) },
    });

    if (!homeTeam || !awayTeam) {
      throw new NotFoundException('Team not found');
    }

    const ratingDiff = homeTeam.simulationRating - awayTeam.simulationRating;
    const [homeGoals, awayGoals] = this.calculateGoals(ratingDiff, 0.2);

    let winnerId: string | null = null;
    if (homeGoals > awayGoals) {
      winnerId = homeId;
      homeTeam.wins += 1;
      awayTeam.losses += 1;
    } else if (awayGoals > homeGoals) {
      winnerId = awayId;
      awayTeam.wins += 1;
      homeTeam.losses += 1;
    } else {
      homeTeam.draws += 1;
      awayTeam.draws += 1;
    }

    homeTeam.matchesPlayed += 1;
    awayTeam.matchesPlayed += 1;
    homeTeam.goalsFor += homeGoals;
    homeTeam.goalsAgainst += awayGoals;
    awayTeam.goalsFor += awayGoals;
    awayTeam.goalsAgainst += homeGoals;

    await this.teamRepo.save(homeTeam);
    await this.teamRepo.save(awayTeam);

    // Note: Standard simulation mode no longer logs a standalone Match collection document
    // since we do not keep a global collection for individual matches outside Tournaments.
    // If needed, match history could be logged to another entity or tournament if required.

    const ratingAdvantage = ratingDiff * 0.5;
    return {
      homeTeamId: homeId,
      awayTeamId: awayId,
      score: `${homeGoals}-${awayGoals}`,
      homeGoals,
      awayGoals,
      winnerId,
      events: [],
      statistics: {
        possession: `${50 + ratingAdvantage}% - ${50 - ratingAdvantage}%`,
      },
    };
  }
}
