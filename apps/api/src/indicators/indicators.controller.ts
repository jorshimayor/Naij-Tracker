import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IndicatorsService } from './indicators.service';
import { IndicatorObservationsQueryDto, ListIndicatorsQueryDto } from './dto';

@ApiTags('indicators')
@Controller('indicators')
export class IndicatorsController {
  constructor(private readonly indicators: IndicatorsService) {}

  @Get()
  @ApiOperation({ summary: 'List all indicators with their latest value, grouped by pillar.' })
  list(@Query() query: ListIndicatorsQueryDto) {
    return this.indicators.list(query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get a single indicator with explainer, observations and related bills.' })
  get(@Param('slug') slug: string) {
    return this.indicators.getBySlug(slug);
  }

  @Get(':slug/observations')
  @ApiOperation({ summary: 'List historical observations for an indicator (range = 1y|5y|10y|all).' })
  observations(@Param('slug') slug: string, @Query() query: IndicatorObservationsQueryDto) {
    return this.indicators.listObservations(slug, query);
  }
}
