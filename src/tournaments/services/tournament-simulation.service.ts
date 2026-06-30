import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TournamentRepository } from '../repository/tournament.repository';
import { NationalTeamRepository } from '../../teams/repository/national-team.repository';
import { Match, MatchPhase } from '../model/tournament.schema';
import { toObjectId, toObjectIds } from '../../common/objectid.util';
import { LoggerService } from 'src/core/logger/logger.service';
import { Types } from 'mongoose';

interface PairAction {
  type:
    | 'winner_vs_third_or_runner'
    | 'winner_vs_runner'
    | 'runner_vs_runner'
    | 'simple_pair';
  winnerIdx?: number;
  thirdIdx?: number;
  fallbackRunnerIdx?: number;
  runnerIdx?: number;
  runnerAIdx?: number;
  runnerBIdx?: number;
}

const BRACKET_CONFIGS: Record<number, PairAction[]> = {
  12: [
    {
      type: 'winner_vs_third_or_runner',
      winnerIdx: 0,
      thirdIdx: 3,
      fallbackRunnerIdx: 0,
    },
    {
      type: 'winner_vs_third_or_runner',
      winnerIdx: 5,
      thirdIdx: 7,
      fallbackRunnerIdx: 1,
    },
    {
      type: 'winner_vs_third_or_runner',
      winnerIdx: 2,
      thirdIdx: 0,
      fallbackRunnerIdx: 2,
    },
    {
      type: 'winner_vs_third_or_runner',
      winnerIdx: 7,
      thirdIdx: 4,
      fallbackRunnerIdx: 3,
    },
    {
      type: 'winner_vs_third_or_runner',
      winnerIdx: 6,
      thirdIdx: 2,
      fallbackRunnerIdx: 4,
    },
    {
      type: 'winner_vs_third_or_runner',
      winnerIdx: 1,
      thirdIdx: 6,
      fallbackRunnerIdx: 5,
    },
    {
      type: 'winner_vs_third_or_runner',
      winnerIdx: 3,
      thirdIdx: 5,
      fallbackRunnerIdx: 6,
    },
    {
      type: 'winner_vs_third_or_runner',
      winnerIdx: 4,
      thirdIdx: 1,
      fallbackRunnerIdx: 7,
    },
    { type: 'winner_vs_runner', winnerIdx: 8, runnerIdx: 8 },
    { type: 'winner_vs_runner', winnerIdx: 9, runnerIdx: 9 },
    { type: 'winner_vs_runner', winnerIdx: 10, runnerIdx: 10 },
    { type: 'winner_vs_runner', winnerIdx: 11, runnerIdx: 11 },
    { type: 'runner_vs_runner', runnerAIdx: 0, runnerBIdx: 4 },
    { type: 'runner_vs_runner', runnerAIdx: 1, runnerBIdx: 5 },
    { type: 'runner_vs_runner', runnerAIdx: 2, runnerBIdx: 6 },
    { type: 'runner_vs_runner', runnerAIdx: 3, runnerBIdx: 7 },
  ],
  8: [
    { type: 'simple_pair', winnerIdx: 0, runnerIdx: 1 },
    { type: 'simple_pair', winnerIdx: 2, runnerIdx: 3 },
    { type: 'simple_pair', winnerIdx: 4, runnerIdx: 5 },
    { type: 'simple_pair', winnerIdx: 6, runnerIdx: 7 },
    { type: 'simple_pair', winnerIdx: 1, runnerIdx: 0 },
    { type: 'simple_pair', winnerIdx: 3, runnerIdx: 2 },
    { type: 'simple_pair', winnerIdx: 5, runnerIdx: 4 },
    { type: 'simple_pair', winnerIdx: 7, runnerIdx: 6 },
  ],
  6: [
    {
      type: 'winner_vs_third_or_runner',
      winnerIdx: 1,
      thirdIdx: 0,
      fallbackRunnerIdx: 0,
    },
    { type: 'winner_vs_runner', winnerIdx: 0, runnerIdx: 2 },
    {
      type: 'winner_vs_third_or_runner',
      winnerIdx: 5,
      thirdIdx: 1,
      fallbackRunnerIdx: 1,
    },
    { type: 'winner_vs_runner', winnerIdx: 3, runnerIdx: 4 },
    {
      type: 'winner_vs_third_or_runner',
      winnerIdx: 4,
      thirdIdx: 2,
      fallbackRunnerIdx: 2,
    },
    {
      type: 'winner_vs_third_or_runner',
      winnerIdx: 2,
      thirdIdx: 3,
      fallbackRunnerIdx: 3,
    },
    { type: 'runner_vs_runner', runnerAIdx: 0, runnerBIdx: 1 },
    { type: 'runner_vs_runner', runnerAIdx: 3, runnerBIdx: 5 },
  ],
  4: [
    { type: 'simple_pair', winnerIdx: 0, runnerIdx: 1 },
    { type: 'simple_pair', winnerIdx: 2, runnerIdx: 3 },
    { type: 'simple_pair', winnerIdx: 1, runnerIdx: 0 },
    { type: 'simple_pair', winnerIdx: 3, runnerIdx: 2 },
  ],
};

@Injectable()
export class TournamentSimulationService {
  constructor(
    private readonly tournamentRepo: TournamentRepository,
    private readonly teamRepo: NationalTeamRepository,
    @Inject(LoggerService) private readonly logger: LoggerService,
  ) {}

  async generateGroupMatches(tournamentId: string) {
    const tournament = await this.tournamentRepo.findById(tournamentId);
    if (!tournament) throw new NotFoundException('Tournament not found');

    for (const group of tournament.groups) {
      const teamIds = group.standings.map((s) => s.teamId);
      const matches: Match[] = [];

      for (let i = 0; i < teamIds.length; i++) {
        for (let j = i + 1; j < teamIds.length; j++) {
          matches.push({
            _id: new Types.ObjectId() as any,
            homeTeamId: teamIds[i],
            awayTeamId: teamIds[j],
            homeScore: 0,
            awayScore: 0,
            homeExtraScore: 0,
            awayExtraScore: 0,
            homePenaltyScore: 0,
            awayPenaltyScore: 0,
            status: 'pending',
            winnerId: null,
            loserId: null,
            phase: 'group',
            bracketPosition: null,
          });
        }
      }
      group.matches = matches;
    }

    tournament.status = 'group_stage';
    await this.tournamentRepo.save(tournament);
  }

  async simulateGroupMatches(tournamentId: string) {
    const tournament = await this.tournamentRepo.findById(tournamentId);
    if (!tournament) throw new NotFoundException('Tournament not found');

    for (const group of tournament.groups) {
      for (const match of group.matches) {
        if (match.status !== 'pending') continue;

        const [home, away] = await Promise.all([
          this.teamRepo.findOne({
            where: { _id: toObjectId(match.homeTeamId) },
          }),
          this.teamRepo.findOne({
            where: { _id: toObjectId(match.awayTeamId) },
          }),
        ]);
        if (!home || !away) continue;

        const [homeGoals, awayGoals] = this.simulateScore(
          home.simulationRating,
          away.simulationRating,
        );

        match.homeScore = homeGoals;
        match.awayScore = awayGoals;
        match.status = 'finished';

        if (homeGoals > awayGoals) {
          match.winnerId = home._id.toString();
          match.loserId = away._id.toString();
        } else if (awayGoals > homeGoals) {
          match.winnerId = away._id.toString();
          match.loserId = home._id.toString();
        }

        // Update local standings immediately in memory
        this.updateGroupStandingLocal(group, match);
      }

      // Sort standing positions
      this.sortGroupStandings(group);
    }

    await this.tournamentRepo.save(tournament);
  }

  private updateGroupStandingLocal(group: any, match: Match) {
    const homeStanding = group.standings.find(
      (s) => s.teamId === match.homeTeamId,
    );
    const awayStanding = group.standings.find(
      (s) => s.teamId === match.awayTeamId,
    );

    if (!homeStanding || !awayStanding) return;

    homeStanding.played += 1;
    awayStanding.played += 1;
    homeStanding.goalsFor += match.homeScore;
    homeStanding.goalsAgainst += match.awayScore;
    awayStanding.goalsFor += match.awayScore;
    awayStanding.goalsAgainst += match.homeScore;

    if (match.homeScore > match.awayScore) {
      homeStanding.wins += 1;
      homeStanding.points += 3;
      awayStanding.losses += 1;
    } else if (match.awayScore > match.homeScore) {
      awayStanding.wins += 1;
      awayStanding.points += 3;
      homeStanding.losses += 1;
    } else {
      homeStanding.draws += 1;
      homeStanding.points += 1;
      awayStanding.draws += 1;
      awayStanding.points += 1;
    }

    homeStanding.goalDiff = homeStanding.goalsFor - homeStanding.goalsAgainst;
    awayStanding.goalDiff = awayStanding.goalsFor - awayStanding.goalsAgainst;
  }

  private sortGroupStandings(group: any) {
    const sorted = [...group.standings].sort((a, b) => {
      if (a.points !== b.points) return b.points - a.points;
      if (a.goalDiff !== b.goalDiff) return b.goalDiff - a.goalDiff;
      if (a.goalsFor !== b.goalsFor) return b.goalsFor - a.goalsFor;

      const allTied = group.standings.filter((s) => s.points === a.points);
      const tiedIds = allTied.map((s) => s.teamId);
      const h2hA = this.computeH2H(a.teamId, tiedIds, group.matches);
      const h2hB = this.computeH2H(b.teamId, tiedIds, group.matches);
      if (h2hA.points !== h2hB.points) return h2hB.points - h2hA.points;
      if (h2hA.GD !== h2hB.GD) return h2hB.GD - h2hA.GD;
      if (h2hA.GF !== h2hB.GF) return h2hB.GF - h2hA.GF;

      if (a.fairPlayPoints !== b.fairPlayPoints)
        return a.fairPlayPoints - b.fairPlayPoints;

      return a.teamId.localeCompare(b.teamId);
    });

    sorted.forEach((s, idx) => {
      s.position = idx + 1;
    });
    group.standings = sorted;
  }

  private computeH2H(teamId: string, tiedIds: string[], matches: Match[]) {
    let points = 0;
    let GD = 0;
    let GF = 0;

    for (const m of matches) {
      if (m.homeTeamId === teamId && tiedIds.includes(m.awayTeamId)) {
        GF += m.homeScore;
        GD += m.homeScore - m.awayScore;
        if (m.homeScore > m.awayScore) points += 3;
        else if (m.homeScore === m.awayScore) points += 1;
      } else if (m.awayTeamId === teamId && tiedIds.includes(m.homeTeamId)) {
        GF += m.awayScore;
        GD += m.awayScore - m.homeScore;
        if (m.awayScore > m.homeScore) points += 3;
        else if (m.awayScore === m.homeScore) points += 1;
      }
    }

    return { points, GD, GF };
  }

  private simulateScore(
    ratingHome: number,
    ratingAway: number,
  ): [number, number] {
    const ratingDiff = ratingHome - ratingAway;
    const expectedHome = Math.max(0.1, 1.2 + ratingDiff * 0.05 + 0.2);
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

  async getBestThirdPlaced(tournamentId: string) {
    const tournament = await this.tournamentRepo.findById(tournamentId);
    if (!tournament) throw new NotFoundException('Tournament not found');

    const thirdPlaced: Array<{ standing: any; groupName: string }> = [];

    for (const group of tournament.groups) {
      if (group.standings.length >= 3) {
        thirdPlaced.push({
          standing: group.standings[2],
          groupName: group.name,
        });
      }
    }

    thirdPlaced.sort((a, b) => {
      const sa = a.standing;
      const sb = b.standing;
      if (sa.points !== sb.points) return sb.points - sa.points;
      if (sa.goalDiff !== sb.goalDiff) return sb.goalDiff - sa.goalDiff;
      if (sa.goalsFor !== sb.goalsFor) return sb.goalsFor - sa.goalsFor;
      if (sa.fairPlayPoints !== sb.fairPlayPoints)
        return sa.fairPlayPoints - sb.fairPlayPoints;
      return sa.teamId.localeCompare(sb.teamId);
    });

    return thirdPlaced.slice(0, 8);
  }

  async generateKnockoutBracket(tournamentId: string) {
    const tournament = await this.tournamentRepo.findById(tournamentId);
    if (!tournament) throw new NotFoundException('Tournament not found');

    const numGroups = tournament.groups.length;

    let targetPhase: MatchPhase = 'round_of_32';
    if (numGroups === 8 || numGroups === 6) targetPhase = 'round_of_16';
    if (numGroups === 4) targetPhase = 'quarter';

    // Verify if already generated
    const knockoutStage = tournament.knockoutStage || {};
    const phaseKey = this.getKnockoutPhaseKey(targetPhase);
    if (knockoutStage[phaseKey] && knockoutStage[phaseKey].length > 0) return;

    const groupWinners: Array<{ teamId: string; groupIndex: number }> = [];
    const groupRunnersUp: Array<{ teamId: string; groupIndex: number }> = [];

    for (let gi = 0; gi < tournament.groups.length; gi++) {
      const group = tournament.groups[gi];
      if (group.standings.length >= 2) {
        groupWinners.push({
          teamId: group.standings[0].teamId,
          groupIndex: gi,
        });
        groupRunnersUp.push({
          teamId: group.standings[1].teamId,
          groupIndex: gi,
        });
      }
    }

    const bracket: Array<{ homeTeamId: string; awayTeamId: string }> = [];
    const config = BRACKET_CONFIGS[numGroups];

    if (config) {
      let thirds: string[] = [];
      if (numGroups === 12 || numGroups === 6) {
        const bestThird = await this.getBestThirdPlaced(tournamentId);
        thirds = bestThird.map((t) => t.standing.teamId);
      }

      for (const action of config) {
        let homeTeamId = '';
        let awayTeamId = '';

        if (action.type === 'winner_vs_third_or_runner') {
          homeTeamId = groupWinners[action.winnerIdx!]?.teamId || '';
          awayTeamId =
            thirds[action.thirdIdx!] ||
            groupRunnersUp[action.fallbackRunnerIdx!]?.teamId ||
            '';
        } else if (action.type === 'winner_vs_runner') {
          homeTeamId = groupWinners[action.winnerIdx!]?.teamId || '';
          awayTeamId = groupRunnersUp[action.runnerIdx!]?.teamId || '';
        } else if (action.type === 'runner_vs_runner') {
          homeTeamId = groupRunnersUp[action.runnerAIdx!]?.teamId || '';
          awayTeamId = groupRunnersUp[action.runnerBIdx!]?.teamId || '';
        } else if (action.type === 'simple_pair') {
          homeTeamId = groupWinners[action.winnerIdx!]?.teamId || '';
          awayTeamId = groupRunnersUp[action.runnerIdx!]?.teamId || '';
        }

        if (homeTeamId && awayTeamId) {
          bracket.push({ homeTeamId, awayTeamId });
        }
      }
    } else {
      for (let i = 0; i < groupWinners.length; i++) {
        const awayIdx = (i + 1) % groupRunnersUp.length;
        bracket.push({
          homeTeamId: groupWinners[i]?.teamId || '',
          awayTeamId: groupRunnersUp[awayIdx]?.teamId || '',
        });
      }
    }

    const matches: Match[] = [];
    for (let i = 0; i < bracket.length; i++) {
      matches.push({
        _id: new Types.ObjectId() as any,
        homeTeamId: bracket[i].homeTeamId,
        awayTeamId: bracket[i].awayTeamId,
        phase: targetPhase,
        bracketPosition: i + 1,
        status: 'pending',
        homeScore: 0,
        awayScore: 0,
        homeExtraScore: 0,
        awayExtraScore: 0,
        homePenaltyScore: 0,
        awayPenaltyScore: 0,
        winnerId: null,
        loserId: null,
      });
    }

    tournament.knockoutStage[phaseKey] = matches;
    tournament.status = targetPhase;
    await this.tournamentRepo.save(tournament);
  }

  async simulateKnockoutRound(tournamentId: string, phase: MatchPhase) {
    const tournament = await this.tournamentRepo.findById(tournamentId);
    if (!tournament) throw new NotFoundException('Tournament not found');

    const phaseKey = this.getKnockoutPhaseKey(phase);
    const matches = tournament.knockoutStage[phaseKey] || [];

    for (const match of matches) {
      if (match.status !== 'pending') continue;

      const [home, away] = await Promise.all([
        this.teamRepo.findOne({ where: { _id: toObjectId(match.homeTeamId) } }),
        this.teamRepo.findOne({ where: { _id: toObjectId(match.awayTeamId) } }),
      ]);
      if (!home || !away) continue;

      let [homeGoals, awayGoals] = this.simulateScore(
        home.simulationRating,
        away.simulationRating,
      );

      match.homeScore = homeGoals;
      match.awayScore = awayGoals;

      if (homeGoals !== awayGoals) {
        match.winnerId =
          homeGoals > awayGoals ? home._id.toString() : away._id.toString();
        match.loserId =
          homeGoals > awayGoals ? away._id.toString() : home._id.toString();
        match.status = 'finished';
        continue;
      }

      // Extra time simulation
      [homeGoals, awayGoals] = this.simulateScore(
        home.simulationRating,
        away.simulationRating,
      );
      match.homeExtraScore = homeGoals;
      match.awayExtraScore = awayGoals;

      if (homeGoals !== awayGoals) {
        match.winnerId =
          homeGoals > awayGoals ? home._id.toString() : away._id.toString();
        match.loserId =
          homeGoals > awayGoals ? away._id.toString() : home._id.toString();
        match.status = 'finished';
        continue;
      }

      // Penalty shootout simulation
      match.homePenaltyScore = this.simulatePenalties();
      match.awayPenaltyScore = this.simulatePenalties();
      let attempts = 0;
      while (
        match.homePenaltyScore === match.awayPenaltyScore &&
        attempts < 20
      ) {
        match.homePenaltyScore += this.simulatePenalties();
        match.awayPenaltyScore += this.simulatePenalties();
        attempts++;
      }
      match.winnerId =
        match.homePenaltyScore > match.awayPenaltyScore
          ? home._id.toString()
          : away._id.toString();
      match.loserId =
        match.homePenaltyScore > match.awayPenaltyScore
          ? away._id.toString()
          : home._id.toString();
      match.status = 'finished';
    }

    // Propagate matches internally in this tournament doc
    await this.propagateToNextPhaseLocal(tournament, phase);
    this.updateTournamentStatusLocal(tournament);

    await this.tournamentRepo.save(tournament);

    return { simulated: matches.length, phase };
  }

  private simulatePenalties(): number {
    let score = 0;
    for (let i = 0; i < 5; i++) {
      if (Math.random() < 0.75) score++;
    }
    return score;
  }

  private async propagateToNextPhaseLocal(
    tournament: any,
    phase: MatchPhase,
  ): Promise<void> {
    const phaseKey = this.getKnockoutPhaseKey(phase);
    const matches = tournament.knockoutStage[phaseKey] || [];

    if (phase === 'semi') {
      const semi1 = matches[0];
      const semi2 = matches[1];

      if (
        semi1 &&
        semi2 &&
        semi1.status === 'finished' &&
        semi2.status === 'finished'
      ) {
        this.upsertNextMatchLocal(
          tournament,
          'final',
          1,
          semi1.winnerId,
          semi2.winnerId,
        );
        this.upsertNextMatchLocal(
          tournament,
          'third_place',
          1,
          semi1.loserId,
          semi2.loserId,
        );
      }
      return;
    }

    const nextPhaseMap: Partial<Record<MatchPhase, MatchPhase>> = {
      round_of_32: 'round_of_16',
      round_of_16: 'quarter',
      quarter: 'semi',
    };
    const nextPhase = nextPhaseMap[phase];
    if (!nextPhase) return;

    for (const match of matches) {
      if (match.status !== 'finished' || !match.winnerId) continue;

      const partnerPos =
        match.bracketPosition % 2 === 1
          ? match.bracketPosition + 1
          : match.bracketPosition - 1;
      const partner = matches.find((m) => m.bracketPosition === partnerPos);

      if (!partner || partner.status !== 'finished' || !partner.winnerId)
        continue;

      const nextBracketPosition =
        Math.floor((Math.min(match.bracketPosition, partnerPos) - 1) / 2) + 1;
      const [firstWinner, secondWinner] =
        match.bracketPosition < partnerPos
          ? [match.winnerId, partner.winnerId]
          : [partner.winnerId, match.winnerId];

      this.upsertNextMatchLocal(
        tournament,
        nextPhase,
        nextBracketPosition,
        firstWinner,
        secondWinner,
      );
    }
  }

  private upsertNextMatchLocal(
    tournament: any,
    phase: MatchPhase,
    bracketPosition: number,
    homeTeamId: string,
    awayTeamId: string,
  ) {
    const phaseKey = this.getKnockoutPhaseKey(phase);

    if (phase === 'final' || phase === 'third_place') {
      const existing = tournament.knockoutStage[phaseKey];
      if (
        !existing ||
        existing.homeTeamId !== homeTeamId ||
        existing.awayTeamId !== awayTeamId
      ) {
        tournament.knockoutStage[phaseKey] = {
          _id: new Types.ObjectId() as any,
          homeTeamId,
          awayTeamId,
          phase,
          bracketPosition,
          status: 'pending',
          homeScore: 0,
          awayScore: 0,
          homeExtraScore: 0,
          awayExtraScore: 0,
          homePenaltyScore: 0,
          awayPenaltyScore: 0,
          winnerId: null,
          loserId: null,
        };
      }
      return;
    }

    if (!tournament.knockoutStage[phaseKey]) {
      tournament.knockoutStage[phaseKey] = [];
    }

    const matchesList = tournament.knockoutStage[phaseKey];
    const existingMatch = matchesList.find(
      (m) => m.bracketPosition === bracketPosition,
    );

    if (!existingMatch) {
      matchesList.push({
        _id: new Types.ObjectId() as any,
        homeTeamId,
        awayTeamId,
        phase,
        bracketPosition,
        status: 'pending',
        homeScore: 0,
        awayScore: 0,
        homeExtraScore: 0,
        awayExtraScore: 0,
        homePenaltyScore: 0,
        awayPenaltyScore: 0,
        winnerId: null,
        loserId: null,
      });
      // Sort
      matchesList.sort((a, b) => a.bracketPosition - b.bracketPosition);
    } else if (
      existingMatch.homeTeamId !== homeTeamId ||
      existingMatch.awayTeamId !== awayTeamId ||
      existingMatch.status === 'finished'
    ) {
      existingMatch.homeTeamId = homeTeamId;
      existingMatch.awayTeamId = awayTeamId;
      existingMatch.homeScore = 0;
      existingMatch.awayScore = 0;
      existingMatch.homeExtraScore = 0;
      existingMatch.awayExtraScore = 0;
      existingMatch.homePenaltyScore = 0;
      existingMatch.awayPenaltyScore = 0;
      existingMatch.winnerId = null;
      existingMatch.loserId = null;
      existingMatch.status = 'pending';
    }
  }

  private updateTournamentStatusLocal(tournament: any) {
    const phaseOrder: MatchPhase[] = [
      'round_of_32',
      'round_of_16',
      'quarter',
      'semi',
      'third_place',
      'final',
    ];

    for (const phase of phaseOrder) {
      const phaseKey = this.getKnockoutPhaseKey(phase);
      const matches = tournament.knockoutStage[phaseKey];
      if (!matches) continue;

      const matchesArray = Array.isArray(matches) ? matches : [matches];
      if (matchesArray.length === 0 || !matchesArray[0]) continue;

      const allFinished = matchesArray.every((m) => m.status === 'finished');
      const anyFinished = matchesArray.some((m) => m.status === 'finished');

      if (!allFinished) {
        if (anyFinished) {
          tournament.status = phase;
        }
        return;
      }
    }

    if (
      tournament.knockoutStage.final &&
      tournament.knockoutStage.final.status === 'finished'
    ) {
      tournament.status = 'finished';
    }
  }

  async getBracket(tournamentId: string) {
    const tournament = await this.tournamentRepo.findById(tournamentId);
    if (!tournament) throw new NotFoundException('Tournament not found');

    const teamCache = new Map<string, any>();
    const fetchTeam = async (id: string) => {
      if (!id) return null;
      if (!teamCache.has(id)) {
        const t = await this.teamRepo.findOne({
          where: { _id: toObjectId(id) },
        });
        if (t) teamCache.set(id, t);
      }
      return teamCache.get(id);
    };

    const allPhases: MatchPhase[] = [
      'round_of_32',
      'round_of_16',
      'quarter',
      'semi',
      'third_place',
      'final',
    ];
    const result: Record<string, any[]> = {};

    for (const phase of allPhases) {
      const phaseKey = this.getKnockoutPhaseKey(phase);
      const rawMatches = tournament.knockoutStage[phaseKey] || [];
      const matchesList = Array.isArray(rawMatches)
        ? rawMatches
        : [rawMatches].filter(Boolean);

      const enriched = await Promise.all(
        matchesList.map(async (m) => {
          const home = await fetchTeam(m.homeTeamId);
          const away = await fetchTeam(m.awayTeamId);
          return {
            id: m._id,
            homeTeam: home?.name ?? null,
            homeCode: home?.fifaCode ?? null,
            awayTeam: away?.name ?? null,
            awayCode: away?.fifaCode ?? null,
            homeScore: m.homeScore,
            awayScore: m.awayScore,
            homeExtra: m.homeExtraScore,
            awayExtra: m.awayExtraScore,
            homePen: m.homePenaltyScore,
            awayPen: m.awayPenaltyScore,
            winnerId: m.winnerId,
            status: m.status,
            bracketPosition: m.bracketPosition,
          };
        }),
      );

      result[phase] = enriched;
    }

    return result;
  }

  async getGroupStandings(tournamentId: string) {
    const tournament = await this.tournamentRepo.findById(tournamentId);
    if (!tournament) throw new NotFoundException('Tournament not found');

    const teamIds: string[] = [];
    for (const group of tournament.groups) {
      for (const s of group.standings) {
        teamIds.push(s.teamId);
      }
    }

    const teams =
      teamIds.length > 0
        ? await this.teamRepo.find({
            where: { _id: { $in: toObjectIds(teamIds) } },
          })
        : [];
    const teamMap = new Map(teams.map((t) => [t._id.toString(), t]));

    const result: any[] = [];
    for (const group of tournament.groups) {
      result.push({
        groupId: group._id,
        groupName: group.name,
        standings: group.standings.map((s) => ({
          position: s.position,
          teamId: s.teamId,
          teamName: teamMap.get(s.teamId)?.name ?? null,
          teamCode: teamMap.get(s.teamId)?.fifaCode ?? null,
          played: s.played,
          wins: s.wins,
          draws: s.draws,
          losses: s.losses,
          goalsFor: s.goalsFor,
          goalsAgainst: s.goalsAgainst,
          goalDiff: s.goalDiff,
          points: s.points,
        })),
      });
    }

    return result;
  }

  async getTournamentStatus(tournamentId: string) {
    const tournament = await this.tournamentRepo.findById(tournamentId);
    if (!tournament) throw new NotFoundException('Tournament not found');

    const result: any = {
      id: tournament._id,
      name: tournament.name,
      status: tournament.status,
    };

    if (tournament.status === 'finished') {
      const finalMatch = tournament.knockoutStage?.final;
      if (finalMatch?.winnerId) {
        const champion = await this.teamRepo.findOne({
          where: { _id: toObjectId(finalMatch.winnerId) },
        });
        if (champion) {
          result.championId = champion._id;
          result.championName = champion.name;
          result.championCode = champion.fifaCode;
          result.championFlagUrl = champion.flagUrl;
        }
      }
    }

    return result;
  }

  async getGroupMatches(tournamentId: string) {
    const tournament = await this.tournamentRepo.findById(tournamentId);
    if (!tournament) throw new NotFoundException('Tournament not found');

    const teamCache = new Map<string, any>();
    const fetchTeam = async (id: string) => {
      if (!id) return null;
      if (!teamCache.has(id)) {
        const t = await this.teamRepo.findOne({
          where: { _id: toObjectId(id) },
        });
        if (t) teamCache.set(id, t);
      }
      return teamCache.get(id);
    };

    const enriched: any[] = [];
    for (const group of tournament.groups) {
      for (const m of group.matches) {
        const home = await fetchTeam(m.homeTeamId);
        const away = await fetchTeam(m.awayTeamId);
        enriched.push({
          id: m._id,
          groupId: group._id,
          homeTeamId: m.homeTeamId,
          awayTeamId: m.awayTeamId,
          homeTeam: home?.name ?? null,
          homeCode: home?.fifaCode ?? null,
          awayTeam: away?.name ?? null,
          awayCode: away?.fifaCode ?? null,
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          winnerId: m.winnerId,
          status: m.status,
          phase: m.phase,
        });
      }
    }

    return enriched;
  }

  async updateMatch(
    matchId: string,
    dto: {
      homeScore: number;
      awayScore: number;
      homeExtraScore?: number;
      awayExtraScore?: number;
      homePenaltyScore?: number;
      awayPenaltyScore?: number;
    },
  ) {
    // Find tournament containing this match (group stage or knockout stage)
    const tournaments = await this.tournamentRepo.find();
    let tournament: any = null;
    let match: Match | null = null;
    let isGroupMatch = false;
    let parentGroup: any = null;

    // Search in groups first
    for (const t of tournaments) {
      for (const g of t.groups) {
        const m = g.matches.find((x) => x._id.toString() === matchId);
        if (m) {
          tournament = t;
          match = m;
          isGroupMatch = true;
          parentGroup = g;
          break;
        }
      }
      if (match) break;
    }

    // Search in knockout if not found in groups
    if (!match) {
      for (const t of tournaments) {
        const ko = t.knockoutStage;
        if (!ko) continue;

        const phases = [
          'round32',
          'round16',
          'quarterfinals',
          'semifinals',
          'thirdPlace',
          'final',
        ];
        for (const phaseKey of phases) {
          const raw = ko[phaseKey];
          if (!raw) continue;
          if (Array.isArray(raw)) {
            const m = raw.find((x) => x._id.toString() === matchId);
            if (m) {
              tournament = t;
              match = m;
              break;
            }
          } else {
            if (raw._id.toString() === matchId) {
              tournament = t;
              match = raw;
              break;
            }
          }
        }
        if (match) break;
      }
    }

    if (!match || !tournament) throw new NotFoundException('Match not found');

    match.homeScore = dto.homeScore;
    match.awayScore = dto.awayScore;
    match.homeExtraScore = dto.homeExtraScore ?? 0;
    match.awayExtraScore = dto.awayExtraScore ?? 0;
    match.homePenaltyScore = dto.homePenaltyScore ?? 0;
    match.awayPenaltyScore = dto.awayPenaltyScore ?? 0;
    match.status = 'finished';

    const totalHome = match.homeScore + match.homeExtraScore;
    const totalAway = match.awayScore + match.awayExtraScore;

    if (totalHome > totalAway) {
      match.winnerId = match.homeTeamId;
      match.loserId = match.awayTeamId;
    } else if (totalAway > totalHome) {
      match.winnerId = match.awayTeamId;
      match.loserId = match.homeTeamId;
    } else {
      if (
        match.phase !== 'group' &&
        (match.homePenaltyScore > 0 || match.awayPenaltyScore > 0)
      ) {
        if (match.homePenaltyScore > match.awayPenaltyScore) {
          match.winnerId = match.homeTeamId;
          match.loserId = match.awayTeamId;
        } else if (match.awayPenaltyScore > match.homePenaltyScore) {
          match.winnerId = match.awayTeamId;
          match.loserId = match.homeTeamId;
        } else {
          match.winnerId = null;
          match.loserId = null;
        }
      } else {
        match.winnerId = null;
        match.loserId = null;
      }
    }

    if (isGroupMatch && parentGroup) {
      // Recalculate standings for this group
      this.recalculateGroupStandingsLocal(parentGroup);
    } else {
      await this.propagateToNextPhaseLocal(tournament, match.phase);
      this.updateTournamentStatusLocal(tournament);
    }

    await this.tournamentRepo.save(tournament);
    return match;
  }

  private recalculateGroupStandingsLocal(group: any) {
    // Reset standings
    for (const s of group.standings) {
      s.played = 0;
      s.wins = 0;
      s.draws = 0;
      s.losses = 0;
      s.goalsFor = 0;
      s.goalsAgainst = 0;
      s.goalDiff = 0;
      s.points = 0;
    }

    // Accumulate finished matches
    for (const match of group.matches) {
      if (match.status !== 'finished') continue;
      this.updateGroupStandingLocal(group, match);
    }

    // Sort
    this.sortGroupStandings(group);
  }

  private getKnockoutPhaseKey(phase: MatchPhase): string {
    const keys: Record<MatchPhase, string> = {
      group: 'group',
      round_of_32: 'round32',
      round_of_16: 'round16',
      quarter: 'quarterfinals',
      semi: 'semifinals',
      third_place: 'thirdPlace',
      final: 'final',
    };
    return keys[phase];
  }
}
