import { Controller, Get, Param, Query } from '@nestjs/common';
import { TeamsService } from '../services/teams.service';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  findAll(@Query('skip') skip = 0, @Query('limit') limit = 211) {
    return this.teamsService.findAll(+skip, +limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.teamsService.findOne(id);
  }
}
