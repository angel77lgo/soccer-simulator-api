import { Test, TestingModule } from '@nestjs/testing';
import { TournamentsService } from './tournaments.service';
import { NationalTeamRepository } from '../../teams/repository/national-team.repository';
import { TournamentRepository } from '../repository/tournament.repository';
import { TournamentSimulationService } from './tournament-simulation.service';
import { BadRequestException } from '@nestjs/common';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { toObjectId } from '../../common/objectid.util';

describe('TournamentsService', () => {
  let service: TournamentsService;

  const mockNationalTeamRepository = {
    find: sinon.stub(),
    findById: sinon.stub(),
  };
  const mockTournamentRepository = {
    find: sinon.stub(),
    findById: sinon.stub(),
    findOne: sinon.stub(),
    create: sinon.stub(),
    save: sinon.stub(),
    delete: sinon.stub(),
  };
  const mockTournamentSimulationService = {
    generateGroupMatches: sinon.stub(),
  };

  beforeEach(async () => {
    mockNationalTeamRepository.find.reset();
    mockNationalTeamRepository.findById.reset();
    mockTournamentRepository.find.reset();
    mockTournamentRepository.findById.reset();
    mockTournamentRepository.findOne.reset();
    mockTournamentRepository.create.reset();
    mockTournamentRepository.save.reset();
    mockTournamentRepository.delete.reset();
    mockTournamentSimulationService.generateGroupMatches.reset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TournamentsService,
        {
          provide: NationalTeamRepository,
          useValue: mockNationalTeamRepository,
        },
        { provide: TournamentRepository, useValue: mockTournamentRepository },
        {
          provide: TournamentSimulationService,
          useValue: mockTournamentSimulationService,
        },
      ],
    }).compile();

    service = module.get<TournamentsService>(TournamentsService);
  });

  it('should be defined', () => {
    expect(service).to.not.be.undefined;
  });

  describe('getTemplates', () => {
    it('should return templates', () => {
      const templates = service.getTemplates();
      expect(templates).to.not.be.undefined;
    });
  });

  describe('findAll', () => {
    it('should return a list of tournaments', async () => {
      const mockTournaments = [{ _id: '1', status: 'pending' }];
      mockTournamentRepository.find.resolves(mockTournaments as any);

      const res = await service.findAll();
      expect(res).to.deep.equal([{ _id: '1', id: '1', status: 'pending' }]);
    });
  });

  describe('remove', () => {
    it('should throw BadRequestException if tournament does not exist', async () => {
      mockTournamentRepository.findById.resolves(null);
      try {
        await service.remove('id');
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(BadRequestException);
      }
    });
  });

  describe('create - manual groups confederation rule (World Cup)', () => {
    const makeTeam = (id: string, confed: string) => ({
      _id: { toString: () => id },
      name: id,
      fifaCode: id,
      confederation: { code: confed },
      fifaRanking: 100,
    });

    const worldCupDto = {
      name: 'Test WC',
      type: 'official' as const,
      subType: 'world_cup',
      teamsCount: 48,
      teamIds: [] as string[],
      hostIds: [] as string[],
    };

    const baseTeamIds = Array.from({ length: 48 }, (_, i) => `t${i + 1}`);

    const allTeams = [
      ...Array.from({ length: 16 }, (_, i) => makeTeam(`t${i + 1}`, 'UEFA')),
      ...Array.from({ length: 9 }, (_, i) => makeTeam(`t${i + 17}`, 'CAF')),
      ...Array.from({ length: 8 }, (_, i) => makeTeam(`t${i + 26}`, 'AFC')),
      ...Array.from({ length: 6 }, (_, i) => makeTeam(`t${i + 34}`, 'CONCACAF')),
      ...Array.from({ length: 8 }, (_, i) => makeTeam(`t${i + 40}`, 'CONMEBOL')),
      makeTeam('t48', 'OFC'),
    ];

    // Perfect valid manual group configuration (A-H with 1 UEFA + 3 non-UEFA, I-L with 2 UEFA + 2 non-UEFA)
    const validGroups = [
      ['t1', 't17', 't26', 't40'], // Group A
      ['t2', 't18', 't27', 't41'], // Group B
      ['t3', 't19', 't28', 't42'], // Group C
      ['t4', 't20', 't29', 't43'], // Group D
      ['t5', 't21', 't30', 't34'], // Group E
      ['t6', 't22', 't31', 't35'], // Group F
      ['t7', 't23', 't32', 't36'], // Group G
      ['t8', 't24', 't33', 't37'], // Group H
      ['t9', 't10', 't25', 't44'], // Group I
      ['t11', 't12', 't38', 't45'], // Group J
      ['t13', 't14', 't39', 't46'], // Group K
      ['t15', 't16', 't47', 't48'], // Group L
    ];

    beforeEach(() => {
      mockNationalTeamRepository.find.callsFake((query?: any) => {
        const inIds = query?.where?._id?.$in;
        if (inIds) {
          const stringIds = inIds.map((id: any) => id.toString());
          const filtered = allTeams.filter((t) => {
            const tObjectIdStr = toObjectId(t._id.toString()).toString();
            return stringIds.includes(tObjectIdStr);
          });
          return Promise.resolve(filtered);
        }
        return Promise.resolve(allTeams);
      });
      mockTournamentRepository.create.returns({ _id: { toString: () => 'new-id' } } as any);
      mockTournamentRepository.save.resolves({} as any);
      mockTournamentRepository.findOne.resolves(null);
      mockTournamentSimulationService.generateGroupMatches.resolves({} as any);
    });

    it('rejects when group has 3 UEFA teams in World Cup manual groups', async () => {
      const groups = [...validGroups];
      groups[0] = ['t1', 't2', 't3', 't17']; // 3 UEFA teams - INVALID
      try {
        await service.create({ ...worldCupDto, teamIds: baseTeamIds, groups });
        throw new Error('Should have thrown');
      } catch (err: any) {
        expect(err).to.be.instanceOf(BadRequestException);
        expect(err.message).to.include('UEFA');
        expect(err.message).to.include('3');
      }
    });

    it('accepts when group has 2 UEFA teams in World Cup manual groups', async () => {
      mockTournamentRepository.findById.resolves({ _id: { toString: () => 'new-id' } } as any);
      const result = await service.create({ ...worldCupDto, teamIds: baseTeamIds, groups: validGroups });
      expect(result).to.not.be.undefined;
    });

    it('rejects when group has 2 CONMEBOL teams in World Cup manual groups', async () => {
      const groups = [...validGroups];
      groups[0] = ['t1', 't17', 't40', 't41']; // 2 CONMEBOL teams - INVALID
      try {
        await service.create({ ...worldCupDto, teamIds: baseTeamIds, groups });
        throw new Error('Should have thrown');
      } catch (err: any) {
        expect(err).to.be.instanceOf(BadRequestException);
        expect(err.message).to.include('CONMEBOL');
        expect(err.message).to.include('2');
      }
    });

    it('rejects when group has 2 teams of same non-UEFA confederation', async () => {
      const groups = [...validGroups];
      groups[0] = ['t1', 't17', 't18', 't40']; // 2 CAF teams (t17, t18) - INVALID
      try {
        await service.create({ ...worldCupDto, teamIds: baseTeamIds, groups });
        throw new Error('Should have thrown');
      } catch (err: any) {
        expect(err).to.be.instanceOf(BadRequestException);
        expect(err.message).to.include('CAF');
        expect(err.message).to.include('2');
      }
    });

    it('skips rule when tournament is not World Cup (custom tournament)', async () => {
      const groups = [
        ['t1', 't2', 't3', 't4'], // 4 UEFA in custom - should be OK
        ['t5', 't6', 't7', 't8'],
        [], [], [], [], [], [],
      ];
      const customTeamIds = [
        ...Array.from({ length: 16 }, (_, i) => `t${i + 1}`), // UEFA
        ...Array.from({ length: 4 }, (_, i) => `t${i + 17}`), // CAF
        ...Array.from({ length: 4 }, (_, i) => `t${i + 26}`), // AFC
        ...Array.from({ length: 4 }, (_, i) => `t${i + 34}`), // CONCACAF
        ...Array.from({ length: 4 }, (_, i) => `t${i + 40}`), // CONMEBOL
      ];
      mockTournamentRepository.findById.resolves({ _id: { toString: () => 'new-id' } } as any);
      const result = await service.create({
        name: 'Custom',
        type: 'custom',
        teamsCount: 32,
        teamIds: customTeamIds,
        customQuotas: { UEFA: 16, CONMEBOL: 4, CONCACAF: 4, CAF: 4, AFC: 4 },
        groups,
      });
      expect(result).to.not.be.undefined;
    });

    it('skips rule when no manual groups provided (auto draw)', async () => {
      mockTournamentRepository.findById.resolves({ _id: { toString: () => 'new-id' } } as any);
      const result = await service.create({ ...worldCupDto, teamIds: baseTeamIds });
      expect(result).to.not.be.undefined;
    });

    it('returns existing tournament when same name+format created in last 30s (idempotency)', async () => {
      const existing = { _id: { toString: () => 'existing-id' }, name: 'Test WC', format: 'world_cup', status: 'pending' };
      mockTournamentRepository.findOne.resolves(existing as any);
      const result = await service.create({ ...worldCupDto, teamIds: baseTeamIds });
      expect(result).to.have.property('id', 'existing-id');
      expect(mockTournamentRepository.create.called).to.be.false;
    });
  });
});
