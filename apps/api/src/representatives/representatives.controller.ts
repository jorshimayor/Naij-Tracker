import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RepresentativesService } from './representatives.service';

@ApiTags('representatives')
@Controller('representatives')
export class RepresentativesController {
  constructor(private readonly reps: RepresentativesService) {}

  @Get('states')
  @ApiOperation({ summary: 'List states + LGAs available in the v0 dataset (used by find-my-rep picker).' })
  listStates() {
    return this.reps.listStates();
  }

  @Get('lookup')
  @ApiOperation({ summary: 'Resolve a state + LGA to a citizen\'s federal senator, federal Reps member, and state assembly member.' })
  lookup(@Query('state') state: string, @Query('lga') lga: string) {
    return this.reps.lookup(state, lga);
  }

  @Get('state-stats')
  @ApiOperation({ summary: 'Per-state aggregated counts (bills, senators, reps, indicators) for the map.' })
  stateStats() {
    return this.reps.stateStats();
  }

  @Get('states/:name')
  @ApiOperation({ summary: 'State detail — senators, reps, recent state-assembly bills, state-level indicators.' })
  stateDetail(@Param('name') name: string) {
    return this.reps.stateDetail(name);
  }
}
