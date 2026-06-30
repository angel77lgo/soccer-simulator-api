import { Test, TestingModule } from '@nestjs/testing';
import { TeamsService } from './teams.service';
import { NationalTeamRepository } from '../repository/national-team.repository';
import { NotFoundException } from '@nestjs/common';
import { toObjectId } from '../../common/objectid.util';
import { expect } from 'chai';
import * as sinon from 'sinon';

describe('TeamsService', () => {
  let service: TeamsService;
  let repo: sinon.SinonStubbedInstance<NationalTeamRepository>;

  const mockNationalTeamRepository = {
    find: sinon.stub(),
    findById: sinon.stub(),
  };

  beforeEach(async () => {
    mockNationalTeamRepository.find.reset();
    mockNationalTeamRepository.findById.reset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamsService,
        {
          provide: NationalTeamRepository,
          useValue: mockNationalTeamRepository,
        },
      ],
    }).compile();

    service = module.get<TeamsService>(TeamsService);
    repo = module.get(NationalTeamRepository);
  });

  it('should be defined', () => {
    expect(service).to.not.be.undefined;
  });

  describe('findAll', () => {
    it('should return an array of teams', async () => {
      const mockConfederation = { name: 'UEFA', code: 'UEFA' };
      const team = {
        toObject: () => ({
          _id: toObjectId('1'),
          name: 'Argentina',
          confederation: mockConfederation,
        }),
      } as any;
      mockNationalTeamRepository.find.resolves([team]);

      const res = await service.findAll(0, 10);
      expect(res[0].name).to.equal('Argentina');
      expect(res[0].confederation?.code).to.equal('UEFA');
      expect(
        mockNationalTeamRepository.find.calledOnceWith({
          skip: 0,
          take: 10,
        }),
      ).to.be.true;
    });
  });

  describe('findOne', () => {
    it('should return a team if found', async () => {
      const mockConfederation = { name: 'UEFA', code: 'UEFA' };
      const team = {
        _id: toObjectId('1'),
        name: 'Argentina',
        confederation: mockConfederation,
      } as any;
      mockNationalTeamRepository.findById.resolves(team);

      const res = await service.findOne('1');
      expect(res.name).to.equal('Argentina');
      expect(res.confederation).to.equal(mockConfederation);
      expect(mockNationalTeamRepository.findById.calledOnceWith('1')).to.be
        .true;
    });

    it('should throw NotFoundException if team not found', async () => {
      mockNationalTeamRepository.findById.resolves(null);

      try {
        await service.findOne('1');
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(NotFoundException);
      }
    });
  });
});
