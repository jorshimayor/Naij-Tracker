import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LegislatorsService } from './legislators.service';

@ApiTags('legislators')
@Controller('legislators')
export class LegislatorsController {
  constructor(private readonly legislators: LegislatorsService) {}

  @Get()
  list() {
    return this.legislators.list();
  }

  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.legislators.getBySlug(slug);
  }
}
