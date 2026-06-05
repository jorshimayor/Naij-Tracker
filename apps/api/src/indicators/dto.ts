import { IsOptional, IsString, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { IndicatorPillar } from '@prisma/client';

export class ListIndicatorsQueryDto {
  @IsOptional() @IsEnum(IndicatorPillar)
  pillar?: IndicatorPillar;

  @IsOptional() @IsString()
  source?: string;
}

export class IndicatorObservationsQueryDto {
  /** Range string: "1y" | "5y" | "10y" | "all". Defaults to "5y". */
  @IsOptional() @IsString()
  range?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(2000)
  limit: number = 600;
}
