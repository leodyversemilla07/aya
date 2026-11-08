import { Injectable } from '@nestjs/common';
import { prisma } from '@workspace/db';
import { getServerEnv } from '@workspace/env';

export interface ChatQuotaSnapshot {
  enabled: boolean;
  limit: number;
  used: number;
  remaining: number;
  resetsAt: Date;
}

export interface ChatQuotaResult {
  allowed: boolean;
  snapshot: ChatQuotaSnapshot;
}

export function quotaSubjectFor(request: {
  auth?: { user?: { id?: string } } | null;
}): string {
  const userId = request.auth?.user?.id;
  return userId ? `user:${userId}` : 'api-key';
}

function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function nextUtcMidnight(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

/**
 * Durable per-subject daily chat quota. Usage is stored in the database so
 * limits survive restarts and apply across every API replica.
 */
@Injectable()
export class ChatQuotaService {
  private readonly limit = getServerEnv().CHAT_DAILY_QUOTA;

  async consume(subject: string, now = new Date()): Promise<ChatQuotaResult> {
    const resetsAt = nextUtcMidnight(now);

    if (this.limit <= 0) {
      return {
        allowed: true,
        snapshot: { enabled: false, limit: 0, used: 0, remaining: 0, resetsAt },
      };
    }

    const day = utcDay(now);
    const record = await prisma.chatUsage.upsert({
      where: { subject_day: { subject, day } },
      create: { subject, day, count: 1 },
      update: { count: { increment: 1 } },
    });

    if (record.count > this.limit) {
      // Keep the stored counter bounded when callers keep retrying.
      await prisma.chatUsage.updateMany({
        where: { subject, day, count: { gt: this.limit } },
        data: { count: this.limit },
      });

      return {
        allowed: false,
        snapshot: {
          enabled: true,
          limit: this.limit,
          used: this.limit,
          remaining: 0,
          resetsAt,
        },
      };
    }

    return {
      allowed: true,
      snapshot: {
        enabled: true,
        limit: this.limit,
        used: record.count,
        remaining: this.limit - record.count,
        resetsAt,
      },
    };
  }
}
