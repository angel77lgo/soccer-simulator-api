import { Test, TestingModule } from '@nestjs/testing';
import { SimulationService } from './simulation.service';
import { NationalTeamRepository } from '../../teams/repository/national-team.repository';
import { NotFoundException } from '@nestjs/common';
import { expect } from 'chai';
import * as sinon from 'sinon';

describe('SimulationService', () => {
  let service: SimulationService;

  const mockNationalTeamRepository = {
    findOne: sinon.stub(),
    save: sinon.stub(),
  };

  beforeEach(async () => {
    mockNationalTeamRepository.findOne.reset();
    mockNationalTeamRepository.save.reset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SimulationService,
        {
          provide: NationalTeamRepository,
          useValue: mockNationalTeamRepository,
        },
      ],
    }).compile();

    service = module.get<SimulationService>(SimulationService);
  });

  it('should be defined', () => {
    expect(service).to.not.be.undefined;
  });

  describe('simulate', () => {
    it('should throw NotFoundException if home team is missing', async () => {
      mockNationalTeamRepository.findOne.onFirstCall().resolves(null);
      mockNationalTeamRepository.findOne
        .onSecondCall()
        .resolves({ id: '2' } as any);

      try {
        await service.simulate('1', '2');
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(NotFoundException);
      }
    });

    it('should throw NotFoundException if away team is missing', async () => {
      mockNationalTeamRepository.findOne
        .onFirstCall()
        .resolves({ id: '1' } as any);
      mockNationalTeamRepository.findOne.onSecondCall().resolves(null);

      try {
        await service.simulate('1', '2');
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(NotFoundException);
      }
    });

    it('should simulate a match and save results correctly', async () => {
      const homeTeam = {
        id: { toHexString: () => '1' },
        simulationRating: 80,
        wins: 0,
        losses: 0,
        draws: 0,
        matchesPlayed: 0,
        goalsFor: 0,
        goalsAgainst: 0,
      } as any;

      const awayTeam = {
        id: { toHexString: () => '2' },
        simulationRating: 70,
        wins: 0,
        losses: 0,
        draws: 0,
        matchesPlayed: 0,
        goalsFor: 0,
        goalsAgainst: 0,
      } as any;

      mockNationalTeamRepository.findOne.onFirstCall().resolves(homeTeam);
      mockNationalTeamRepository.findOne.onSecondCall().resolves(awayTeam);

      const result = await service.simulate('1', '2');

      expect(mockNationalTeamRepository.findOne.callCount).to.equal(2);
      expect(mockNationalTeamRepository.save.callCount).to.equal(2);

      expect(result).to.have.property('homeTeamId', '1');
      expect(result).to.have.property('awayTeamId', '2');
      expect(result).to.have.property('score');
      expect(result).to.have.property('winnerId');
    });
  });
});
