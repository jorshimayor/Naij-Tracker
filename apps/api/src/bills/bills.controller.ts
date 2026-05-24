import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { BillsService } from './bills.service';
import { ListBillsQueryDto } from './dto';

@ApiTags('bills')
@Controller('bills')
export class BillsController {
  constructor(private readonly bills: BillsService) {}

  @Get()
  @ApiOperation({ summary: 'List and search bills across all jurisdictions.' })
  list(@Query() query: ListBillsQueryDto) {
    return this.bills.list(query);
  }

  @Get('export.csv')
  @ApiOperation({ summary: 'Export the matching bills as CSV (same filters as /bills).' })
  async exportCsv(@Query() query: ListBillsQueryDto, @Res() res: Response) {
    const csv = await this.bills.exportCsv(query);
    const filename = `bills_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get(':jurisdictionSlug/:slug')
  @ApiOperation({ summary: 'Get a single bill. Optional ?lang= picks the explainer language.' })
  async getDetail(
    @Param('jurisdictionSlug') jurisdictionSlug: string,
    @Param('slug') slug: string,
    @Query('lang') lang?: string,
  ) {
    const language = ['en', 'yo', 'ig', 'ha', 'pcm'].includes(lang ?? '') ? (lang as string) : 'en';
    const bill = await this.bills.getByJurisdictionAndSlug(jurisdictionSlug, slug, language);
    const [related, duplicates] = await Promise.all([
      this.bills.findRelated(jurisdictionSlug, slug),
      this.bills.findCrossChamberDuplicates(bill.id),
    ]);
    return { bill, related, duplicates };
  }
}
