import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CommentStatus } from '@prisma/client';
import { AuthGuard, OptionalAuthGuard, type AuthedRequest } from '../auth/auth.guard';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { CommentsService } from './comments.service';

class CreateCommentDto {
  @IsString() billId!: string;
  @IsString() @MinLength(2) @MaxLength(2000) body!: string;
  @IsOptional() @IsString() parentId?: string;
}

class SetStatusDto {
  @IsString() status!: CommentStatus;
}

@ApiTags('comments')
@Controller('comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  @UseGuards(OptionalAuthGuard)
  list(@Query('billId') billId: string, @Req() req: AuthedRequest) {
    return this.comments.listForBill(billId, req.user?.userId);
  }

  @Post()
  @UseGuards(AuthGuard)
  create(@Req() req: AuthedRequest, @Body() dto: CreateCommentDto) {
    return this.comments.create(req.user!.userId, dto.billId, dto.body, dto.parentId);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.comments.deleteOwn(req.user!.userId, id);
  }
}

@ApiTags('comments')
@Controller('admin/comments')
export class AdminCommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  @UseGuards(AdminAuthGuard)
  adminList(@Query('status') status?: CommentStatus) {
    return this.comments.listForModeration(status);
  }

  @Post(':id/status')
  @UseGuards(AdminAuthGuard)
  adminSetStatus(@Param('id') id: string, @Body() dto: SetStatusDto) {
    return this.comments.setStatus(id, dto.status);
  }
}
