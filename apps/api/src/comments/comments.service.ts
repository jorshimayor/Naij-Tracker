import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CommentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public list — only approved comments, threaded. */
  async listForBill(billId: string, viewerUserId?: string) {
    const all = await this.prisma.comment.findMany({
      where: {
        billId,
        OR: [
          { status: CommentStatus.VISIBLE },
          ...(viewerUserId ? [{ userId: viewerUserId }] : []), // commenter sees own pending too
        ],
      },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, displayName: true, email: true } } },
    });
    return all.map((c) => ({
      id: c.id,
      body: c.body,
      status: c.status,
      parentId: c.parentId,
      createdAt: c.createdAt,
      author: {
        id: c.user.id,
        // Fall back to local-part of email if no display name.
        name: c.user.displayName ?? c.user.email.split('@')[0],
        isYou: viewerUserId === c.user.id,
      },
    }));
  }

  async create(userId: string, billId: string, body: string, parentId?: string) {
    const bill = await this.prisma.bill.findUnique({ where: { id: billId }, select: { id: true } });
    if (!bill) throw new NotFoundException('Bill not found');

    // Auto-approve first iteration. Production should add anti-spam (rate limits, profanity filter,
    // ML classifier). Sensitive bills could require moderation by default; we leave that to admins.
    const status = CommentStatus.VISIBLE;

    return this.prisma.comment.create({
      data: {
        billId,
        userId,
        body: body.trim(),
        parentId: parentId ?? null,
        status,
      },
    });
  }

  async deleteOwn(userId: string, commentId: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.userId !== userId) throw new ForbiddenException('Not your comment');
    await this.prisma.comment.delete({ where: { id: commentId } });
    return { ok: true };
  }

  // --- Admin ---

  async listForModeration(status?: CommentStatus) {
    return this.prisma.comment.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: { select: { email: true, displayName: true } },
        bill: { select: { billNumber: true, title: true, slug: true, jurisdiction: { select: { slug: true } } } },
      },
    });
  }

  async setStatus(commentId: string, status: CommentStatus) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Comment not found');
    return this.prisma.comment.update({ where: { id: commentId }, data: { status } });
  }
}
