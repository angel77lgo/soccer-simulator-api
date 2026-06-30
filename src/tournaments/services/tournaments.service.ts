import {
  Injectable,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { NationalTeamRepository } from '../../teams/repository/national-team.repository';
import { TournamentRepository } from '../repository/tournament.repository';
import { OFFICIAL_TEMPLATES, TournamentQuotas } from '../tournament-rules';
import { TournamentSimulationService } from './tournament-simulation.service';
import { toObjectId, toObjectIds } from '../../common/objectid.util';
import { Types } from 'mongoose';

interface CreateTournamentDto {
  name: string;
  type: string;
  subType?: string;
  teamsCount: number;
  teamIds: string[];
  hostIds?: string[];
  customQuotas?: TournamentQuotas;
  groups?: string[][];
}

@Injectable()
export class TournamentsService {
  constructor(
    private readonly teamRepo: NationalTeamRepository,
    private readonly tournamentRepo: TournamentRepository,
    @Inject(forwardRef(() => TournamentSimulationService))
    private readonly simService: TournamentSimulationService,
  ) {}

  getTemplates() {
    return OFFICIAL_TEMPLATES;
  }

  async findAll() {
    const tournaments = await this.tournamentRepo.find();
    return tournaments.map((t) => {
      const result: any = t.toObject ? t.toObject() : { ...t };
      result.id = result._id;
      if (t.status === 'finished') {
        const finalMatch = t.knockoutStage?.final;
        if (finalMatch?.status === 'finished' && finalMatch?.winnerId) {
          result.championId = finalMatch.winnerId;
        }
      }
      return result;
    });
  }

  private normalizeTournament(t: any) {
    const result: any = t.toObject ? t.toObject() : { ...t };
    result.id = result._id;
    if (t.status === 'finished') {
      const finalMatch = t.knockoutStage?.final;
      if (finalMatch?.status === 'finished' && finalMatch?.winnerId) {
        result.championId = finalMatch.winnerId;
      }
    }
    return result;
  }

  async create(dto: CreateTournamentDto) {
    const hostIds = dto.hostIds || [];

    // Idempotency: if a tournament with the same name and type was created
    // in the last 30 seconds, return the existing one instead of creating a duplicate.
    const recentWindow = new Date(Date.now() - 30_000);
    const existingRecent = await this.tournamentRepo.findOne({
      where: {
        name: dto.name,
        format: dto.subType || 'custom',
        createdAt: { $gte: recentWindow },
      },
    });
    if (existingRecent) {
      return this.normalizeTournament(existingRecent);
    }

    let baseQuotas: TournamentQuotas;
    let expectedTotal: number;

    if (dto.type === 'official') {
      if (!dto.subType || !OFFICIAL_TEMPLATES[dto.subType]) {
        throw new BadRequestException(
          'Invalid or missing official template subtype',
        );
      }
      const template = OFFICIAL_TEMPLATES[dto.subType];
      expectedTotal = template.teamsCount;
      baseQuotas = { ...template.quotas };
    } else {
      expectedTotal = dto.teamsCount;
      if (!dto.customQuotas) {
        throw new BadRequestException(
          'Custom quotas required for custom tournament',
        );
      }
      baseQuotas = { ...dto.customQuotas };
      const sum = Object.values(baseQuotas).reduce((a, b) => a + b, 0);
      if (sum !== expectedTotal) {
        throw new BadRequestException(
          'Sum of confederation quotas must match total teams count',
        );
      }
    }

    const allIds = [...new Set([...hostIds, ...dto.teamIds])];
    if (allIds.length !== expectedTotal) {
      throw new BadRequestException(
        `Expected exactly ${expectedTotal} unique team IDs (hosts + participants), got ${allIds.length}`,
      );
    }

    const allTeams = await this.teamRepo.find({
      where: { _id: { $in: toObjectIds(allIds) } },
    });
    if (allTeams.length !== allIds.length) {
      throw new BadRequestException('One or more team IDs are invalid');
    }

    const teamConfedMap = new Map<string, string>();
    for (const team of allTeams) {
      teamConfedMap.set((team as any)._id.toString(), team.confederation.code);
    }

    const hostsByConfed: Record<string, number> = {};
    for (const hid of hostIds) {
      const code = teamConfedMap.get(hid) || 'UNKNOWN';
      hostsByConfed[code] = (hostsByConfed[code] || 0) + 1;
    }

    const actualCounts: Record<string, number> = {};
    for (const tid of allIds) {
      const code = teamConfedMap.get(tid) || 'UNKNOWN';
      actualCounts[code] = (actualCounts[code] || 0) + 1;
    }

    const isWorldCup = dto.type === 'official' && dto.subType === 'world_cup';

    const uefaBase = baseQuotas['UEFA'] || 0;
    if ((actualCounts['UEFA'] || 0) !== uefaBase) {
      throw new BadRequestException(
        `Quota mismatch for UEFA. Expected exactly ${uefaBase}, got ${actualCounts['UEFA'] || 0}`,
      );
    }

    for (const [code, base] of Object.entries(baseQuotas)) {
      if (code === 'UEFA') continue;
      const actual = actualCounts[code] || 0;
      const hosts = hostsByConfed[code] || 0;
      const minRequired = isWorldCup ? Math.max(0, base - hosts) : base;
      if (actual < minRequired) {
        throw new BadRequestException(
          `Quota mismatch for ${code}. Expected at least ${minRequired} total, got ${actual}`,
        );
      }
    }

    const dbTournament = this.tournamentRepo.create({
      name: dto.name,
      groupStageSize: expectedTotal,
      format: dto.subType || 'custom',
      teamsIds: toObjectIds(allIds),
      status: 'pending',
      groups: [],
      knockoutStage: {
        round32: [],
        round16: [],
        quarterfinals: [],
        semifinals: [],
        thirdPlace: null,
        final: null,
      },
    });
    // Populate groups and standings structure in the document
    await this.generateGroupsAndSchedule(
      dbTournament,
      allIds,
      hostIds,
      allTeams,
      dto.groups,
      isWorldCup,
    );

    await this.tournamentRepo.save(dbTournament);

    await this.simService.generateGroupMatches(dbTournament._id.toString());

    const saved = await this.tournamentRepo.findById(
      dbTournament._id.toString(),
    );
    return this.normalizeTournament(saved);
  }

  async remove(id: string) {
    const tournament = await this.tournamentRepo.findById(id);
    if (!tournament) throw new BadRequestException('Tournament not found');
    await this.tournamentRepo.delete(id);
    return { deleted: true };
  }

  private validateManualGroupsConfederations(
    manualGroups: string[][],
    teamMap: Map<string, any>,
    groupNames: string[],
  ): void {
    for (let gIdx = 0; gIdx < manualGroups.length; gIdx++) {
      const confedCounts: Record<string, string[]> = {};
      for (const teamId of manualGroups[gIdx]) {
        if (!teamId) continue;
        const team = teamMap.get(teamId);
        const confed = team?.confederation?.code || 'UNKNOWN';
        if (!confedCounts[confed]) confedCounts[confed] = [];
        confedCounts[confed].push(team?.name || teamId);
      }
      for (const [confed, names] of Object.entries(confedCounts)) {
        const maxAllowed = confed === 'UEFA' ? 2 : 1;
        if (names.length > maxAllowed) {
          throw new BadRequestException(
            `Grupo ${groupNames[gIdx]} tiene ${names.length} equipos de ${confed} (${names.join(', ')}). Máximo permitido: ${maxAllowed}.`,
          );
        }
      }
    }
  }

  private async generateGroupsAndSchedule(
    tournament: any,
    teamIds: string[],
    hostIds: string[],
    teams: any[],
    manualGroups?: string[][],
    isWorldCup?: boolean,
  ) {
    const totalTeams = teams.length;
    const numGroups = Math.max(1, Math.floor(totalTeams / 4));
    const groupNames = Array.from({ length: numGroups }, (_, i) =>
      String.fromCharCode(65 + i),
    );

    const teamMap = new Map(teams.map((t) => [t._id.toString(), t]));

    if (manualGroups && manualGroups.length > 0) {
      if (isWorldCup) {
        this.validateManualGroupsConfederations(
          manualGroups,
          teamMap,
          groupNames,
        );
      }
      tournament.groups = [];
      for (let i = 0; i < groupNames.length; i++) {
        const gName = groupNames[i];
        const mg = manualGroups[i] || [];
        const standings = mg.map((tId) => {
          const t = teamMap.get(tId);
          return {
            teamId: tId,
            confederation: t?.confederation?.code || 'UNKNOWN',
            points: 0,
            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDiff: 0,
            fairPlayPoints: 0,
            position: 0,
          };
        });

        tournament.groups.push({
          _id: new Types.ObjectId(),
          name: `Grupo ${gName}`,
          identifier: gName,
          standings,
          matches: [],
        });
      }
      return;
    }

    const sorted = [...teams].sort((a, b) => {
      const aIsHost = hostIds.includes(a._id.toString()) ? 0 : 1;
      const bIsHost = hostIds.includes(b._id.toString()) ? 0 : 1;
      if (aIsHost !== bIsHost) return aIsHost - bIsHost;
      return (a.fifaRanking || 9999) - (b.fifaRanking || 9999);
    });

    const pots: any[][] = [[], [], [], []];
    const potSize = numGroups;
    for (let i = 0; i < 4 && i * potSize < sorted.length; i++) {
      pots[i] = sorted.slice(i * potSize, (i + 1) * potSize);
    }

    const confedTotal: Record<string, number> = {};
    for (const t of teams) {
      const c = t.confederation.code || 'UNKNOWN';
      confedTotal[c] = (confedTotal[c] || 0) + 1;
    }
    const confedLimit: Record<string, number> = {};
    for (const [c, total] of Object.entries(confedTotal)) {
      const defaultMax = c === 'UEFA' ? 2 : 1;
      const needed = Math.ceil(total / numGroups);
      confedLimit[c] = Math.max(defaultMax, needed);
    }

    let groupAssignments: any[][] = Array.from({ length: numGroups }, () => []);

    const isValidAddition = (gIdx: number, team: any): boolean => {
      const teamConfed = team.confederation.code || 'UNKNOWN';
      const maxPerGroup = confedLimit[teamConfed] || 1;
      let count = 0;
      for (const member of groupAssignments[gIdx]) {
        if (member.confederation.code === teamConfed) {
          count++;
        }
      }
      return count < maxPerGroup;
    };

    const solve = (potIdx: number): boolean => {
      if (potIdx >= 4) return true;

      const currentPot = [...pots[potIdx]];
      currentPot.sort(() => Math.random() - 0.5);

      const assignInPot = (teamIdx: number, available: number[]): boolean => {
        if (teamIdx >= currentPot.length) return solve(potIdx + 1);

        const team = currentPot[teamIdx];
        const shuffled = [...available].sort(() => Math.random() - 0.5);

        for (const gIdx of shuffled) {
          if (isValidAddition(gIdx, team)) {
            groupAssignments[gIdx].push(team);
            const nextAvailable = available.filter((g) => g !== gIdx);

            if (assignInPot(teamIdx + 1, nextAvailable)) return true;
            groupAssignments[gIdx].pop();
          }
        }
        return false;
      };

      return assignInPot(
        0,
        Array.from({ length: numGroups }, (_, i) => i),
      );
    };

    let solved = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      groupAssignments = Array.from({ length: numGroups }, () => []);
      if (solve(0)) {
        solved = true;
        break;
      }
    }

    if (!solved) {
      groupAssignments = Array.from({ length: numGroups }, () => []);
      for (let potIdx = 0; potIdx < 4; potIdx++) {
        const shuffled = [...(pots[potIdx] || [])].sort(
          () => Math.random() - 0.5,
        );
        for (let gIdx = 0; gIdx < numGroups; gIdx++) {
          if (shuffled[gIdx]) groupAssignments[gIdx].push(shuffled[gIdx]);
        }
      }
    }

    tournament.groups = [];
    for (let i = 0; i < groupNames.length; i++) {
      const gName = groupNames[i];
      const standings = groupAssignments[i].map((team) => ({
        teamId: team._id.toString(),
        confederation: team.confederation.code || 'UNKNOWN',
        points: 0,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0,
        fairPlayPoints: 0,
        position: 0,
      }));

      tournament.groups.push({
        _id: new Types.ObjectId(),
        name: `Grupo ${gName}`,
        identifier: gName,
        standings,
        matches: [],
      });
    }
  }
}
