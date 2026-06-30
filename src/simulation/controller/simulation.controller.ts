import { Controller, Post, Query } from '@nestjs/common';
import { SimulationService } from '../services/simulation.service';

@Controller('simulation')
export class SimulationController {
  constructor(private readonly simulationService: SimulationService) {}

  @Post('simulate')
  simulate(@Query('homeId') homeId: string, @Query('awayId') awayId: string) {
    return this.simulationService.simulate(homeId, awayId);
  }
}
