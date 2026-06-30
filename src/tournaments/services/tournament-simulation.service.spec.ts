import { Test, TestingModule } from '@nestjs/testing';
import { TournamentSimulationService } from './tournament-simulation.service';
import { TournamentRepository } from '../repository/tournament.repository';
import { NationalTeamRepository } from '../../teams/repository/national-team.repository';
import { LoggerService } from '../../core/logger/logger.service';
import { NotFoundException } from '@nestjs/common';
import { expect } from 'chai';
import * as sinon from 'sinon';

describe('TournamentSimulationService', () => {
  let service: TournamentSimulationService;

  const mockLoggerService = {
    log: sinon.stub(),
    error: sinon.stub(),
    warn: sinon.stub(),
    debug: sinon.stub(),
    verbose: sinon.stub(),
  };

  const mockTournamentRepository = {
    findById: sinon.stub(),
    save: sinon.stub(),
  };
  const mockNationalTeamRepository = {
    findOne: sinon.stub(),
    find: sinon.stub(),
  };

  beforeEach(async () => {
    mockLoggerService.log.reset();
    mockLoggerService.error.reset();
    mockLoggerService.warn.reset();
    mockLoggerService.debug.reset();
    mockLoggerService.verbose.reset();
    mockTournamentRepository.findById.reset();
    mockTournamentRepository.save.reset();
    mockNationalTeamRepository.findOne.reset();
    mockNationalTeamRepository.find.reset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TournamentSimulationService,
        { provide: TournamentRepository, useValue: mockTournamentRepository },
        {
          provide: NationalTeamRepository,
          useValue: mockNationalTeamRepository,
        },
        { provide: LoggerService, useValue: mockLoggerService },
      ],
    }).compile();

    service = module.get<TournamentSimulationService>(
      TournamentSimulationService,
    );
  });

  it('should be defined', () => {
    expect(service).to.not.be.undefined;
  });

  describe('generateGroupMatches', () => {
    it('should throw NotFoundException if tournament is missing', async () => {
      mockTournamentRepository.findById.resolves(null);
      try {
        await service.generateGroupMatches('id');
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(NotFoundException);
      }
    });
  });
});
