import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  InternalServerErrorException,
} from '@nestjs/common';
import { TournamentsService } from '../services/tournaments.service';
import { TournamentSimulationService } from '../services/tournament-simulation.service';

@Controller('tournaments')
export class TournamentsController {
  constructor(
    private readonly tournamentsService: TournamentsService,
    private readonly simService: TournamentSimulationService,
  ) {}

  @Get('templates')
  getTemplates() {
    return this.tournamentsService.getTemplates();
  }

  @Get()
  findAll() {
    return this.tournamentsService.findAll();
  }

  @Post()
  async create(@Body() body: any) {
    try {
      return await this.tournamentsService.create(body);
    } catch (e: any) {
      if (e?.status && e.status >= 400 && e.status < 500) {
        throw e;
      }
      throw new InternalServerErrorException(e?.message || 'Unknown error');
    }
  }

  @Get(':id/status')
  getStatus(@Param('id') id: string) {
    return this.simService.getTournamentStatus(id);
  }

  @Get(':id/standings')
  getStandings(@Param('id') id: string) {
    return this.simService.getGroupStandings(id);
  }

  @Get(':id/bracket')
  getBracket(@Param('id') id: string) {
    return this.simService.getBracket(id);
  }

  @Get(':id/best-third')
  getBestThird(@Param('id') id: string) {
    return this.simService.getBestThirdPlaced(id);
  }

  @Post(':id/generate-matches')
  generateGroupMatches(@Param('id') id: string) {
    return this.simService.generateGroupMatches(id);
  }

  @Post(':id/simulate-groups')
  simulateGroupStage(@Param('id') id: string) {
    return this.simService.simulateGroupMatches(id);
  }

  @Post(':id/generate-knockout')
  generateKnockout(@Param('id') id: string) {
    return this.simService.generateKnockoutBracket(id);
  }

  @Post(':id/simulate-knockout/:phase')
  simulateKnockoutRound(
    @Param('id') id: string,
    @Param('phase') phase: string,
  ) {
    return this.simService.simulateKnockoutRound(id, phase as any);
  }

  @Get(':id/group-matches')
  getGroupMatches(@Param('id') id: string) {
    return this.simService.getGroupMatches(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tournamentsService.remove(id);
  }

  @Post('matches/:matchId')
  updateMatch(@Param('matchId') matchId: string, @Body() body: any) {
    return this.simService.updateMatch(matchId, body);
  }
}
