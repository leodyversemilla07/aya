import type { Prisma } from '@workspace/db';
import type { AuthenticatedRequest } from '../auth/request';

export interface AuditActor {
  type: 'user' | 'api-key';
  id?: string;
  name: string;
  key?: string;
}

export interface AuditEvent {
  action: 'create' | 'update' | 'delete';
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  requestId?: string;
}

type AuditClient = Pick<Prisma.TransactionClient, 'auditLog'>;

function serializeState(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value, (_key, nestedValue) => {
    if (nestedValue instanceof Date) return nestedValue.toISOString();
    if (typeof nestedValue === 'bigint') return nestedValue.toString();
    return nestedValue;
  });
}

export function actorFromRequest(request: AuthenticatedRequest): AuditActor {
  if (request.authType === 'api-key') {
    const fingerprint = request.authSubject?.replace(/^api-key:/, '') ?? '';
    return {
      type: 'api-key',
      name: `API key · ${fingerprint.slice(0, 12)}`,
      key: fingerprint.slice(0, 12),
    };
  }

  return {
    type: 'user',
    id: request.auth?.user.id,
    name: request.auth?.user.email ?? request.auth?.user.name ?? 'Unknown user',
    key: request.auth?.user.id,
  };
}

/** Writes an audit event in the same transaction as the mutation it describes. */
export async function writeAudit(
  client: AuditClient,
  actor: AuditActor,
  event: AuditEvent,
): Promise<void> {
  await client.auditLog.create({
    data: {
      actorId: actor.type === 'user' ? actor.id : null,
      actorType: actor.type,
      actorName: actor.name,
      actorKey: actor.key ?? null,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      beforeState: serializeState(event.before),
      afterState: serializeState(event.after),
      requestId: event.requestId ?? null,
    },
  });
}
