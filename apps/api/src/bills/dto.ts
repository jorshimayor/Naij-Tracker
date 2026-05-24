import { IsOptional, IsString, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { BillStage } from '@prisma/client';

export class ListBillsQueryDto {
  @IsOptional() @IsString()
  q?: string;

  @IsOptional() @IsString()
  jurisdiction?: string;

  @IsOptional() @IsEnum(BillStage)
  stage?: BillStage;

  @IsOptional() @IsString()
  topic?: string;

  @IsOptional() @IsString()
  sponsor?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit: number = 20;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  offset: number = 0;

  @IsOptional() @IsString()
  sort?: 'relevance' | 'introduced_desc' | 'last_action_desc';
}
