import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JurisdictionsService } from './jurisdictions.service';

@ApiTags('jurisdictions')
@Controller('jurisdictions')
export class JurisdictionsController {
  constructor(private readonly jurisdictions: JurisdictionsService) {}

  @Get()
  list() {
    return this.jurisdictions.list();
  }

  @Get('stats')
  stats() {
    return this.jurisdictions.stats();
  }
}
