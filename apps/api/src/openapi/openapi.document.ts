import { z } from 'zod';
import {
  adminUserListQuerySchema,
  auditLogListQuerySchema,
  updateUserRoleSchema,
} from '../admin/admin.schemas';
import { chatRequestSchema } from '../agent/agent.controller';
import { alertDeliveryListQuerySchema, alertListQuerySchema } from '../alerts/alert.schemas';
import { forecastQuerySchema } from '../forecasting/forecast.schemas';
import {
  assignmentCreateSchema,
  assignmentListQuerySchema,
  assignmentUpdateSchema,
  clientCreateSchema,
  clientListQuerySchema,
  clientUpdateSchema,
  contractCreateSchema,
  contractListQuerySchema,
  contractUpdateSchema,
  developerCreateSchema,
  developerListQuerySchema,
  developerUpdateSchema,
  performanceCreateSchema,
  performanceListQuerySchema,
  performanceUpdateSchema,
} from '../management/management.schemas';
import { notificationListQuerySchema } from '../notifications/notification.schemas';

type JsonObject = Record<string, unknown>;

interface OperationSpec {
  method: 'get' | 'post' | 'patch' | 'delete';
  /** Express-style path; `:id` segments are converted to `{id}`. */
  path: string;
  tag: string;
  summary: string;
  description?: string;
  /** Set false for public endpoints; every operation is secured by default. */
  secure?: boolean;
  /** Names of path parameters, in order of appearance. */
  pathParams?: string[];
  query?: z.ZodType;
  body?: z.ZodType;
  /** Response content type defaults to application/json; SSE overrides it. */
  sse?: boolean;
  responses: Record<string, string>;
}

/**
 * Converts a Zod schema to an OpenAPI-compatible JSON Schema for the
 * validation (input) side, so defaults stay optional and transforms are not
 * described as output shapes.
 */
function jsonSchemaOf(schema: z.ZodType): JsonObject {
  const converted = z.toJSONSchema(schema, {
    io: 'input',
    // Date-normalizing transforms are described by their string input.
    unrepresentable: 'any',
  }) as JsonObject;
  const { $schema: _schema, ...rest } = converted;
  return rest;
}

function queryParameters(schema: z.ZodType): JsonObject[] {
  const json = jsonSchemaOf(schema) as {
    properties?: Record<string, JsonObject>;
    required?: string[];
  };
  return Object.entries(json.properties ?? {}).map(([name, property]) => ({
    name,
    in: 'query',
    required: json.required?.includes(name) ?? false,
    description: property.description,
    schema: property,
  }));
}

function pathParameters(names: string[] | undefined): JsonObject[] {
  return (names ?? []).map((name) => ({
    name,
    in: 'path',
    required: true,
    schema: { type: 'string', minLength: 1 },
  }));
}

const OPERATIONS: OperationSpec[] = [
  {
    method: 'get',
    path: '/',
    tag: 'System',
    summary: 'Service greeting',
    secure: false,
    responses: { '200': 'Service greeting message.' },
  },
  {
    method: 'get',
    path: '/health',
    tag: 'System',
    summary: 'Process liveness check',
    secure: false,
    responses: { '200': 'Uptime and service name.' },
  },
  {
    method: 'get',
    path: '/ready',
    tag: 'System',
    summary: 'Database readiness check',
    secure: false,
    responses: { '200': 'Database is reachable.', '503': 'Database is unreachable.' },
  },
  {
    method: 'get',
    path: '/stats',
    tag: 'System',
    summary: 'Dashboard statistics',
    description:
      'Roster, bench, assignment, contract, alert, and conversation counts for the signed-in workspace.',
    responses: { '200': 'Dashboard counts.' },
  },
  {
    method: 'post',
    path: '/agent/chat',
    tag: 'Chat',
    summary: 'Chat with Aya',
    description:
      'Runs one agent turn with tool calling and returns the final answer. Rate limited to 20 requests per minute and subject to the daily chat quota.',
    body: chatRequestSchema,
    responses: {
      '200': 'Final assistant reply and conversation id.',
      '400': 'Message is missing or exceeds 10000 characters.',
      '429': 'Rate limit or daily chat quota reached.',
    },
  },
  {
    method: 'post',
    path: '/agent/chat/stream',
    tag: 'Chat',
    summary: 'Stream a chat reply over Server-Sent Events',
    description:
      'Emits `conversation`, `status`, `tool_call`, `tool_result`, `delta`, `usage`, and `done` events, followed by the end of the stream. Heartbeats are sent every 15 seconds.',
    sse: true,
    body: chatRequestSchema,
    responses: {
      '200': 'Server-Sent Events stream for one agent turn.',
      '400': 'Message is missing or exceeds 10000 characters.',
      '429': 'Rate limit or daily chat quota reached.',
    },
  },
  {
    method: 'get',
    path: '/api/auth/get-session',
    tag: 'Auth',
    summary: 'Read the current Better Auth session',
    secure: false,
    responses: { '200': 'Session payload, or null when signed out.' },
  },
  {
    method: 'post',
    path: '/api/auth/{action}',
    tag: 'Auth',
    summary: 'Better Auth endpoint',
    description:
      'Catch-all for Better Auth routes, for example `sign-up/email`, `sign-in/email`, and `sign-out`. See the Better Auth documentation for request and response shapes.',
    pathParams: ['action'],
    secure: false,
    responses: { '200': 'Better Auth response.' },
  },
  {
    method: 'get',
    path: '/conversations',
    tag: 'Conversations',
    summary: "List the caller's recent conversations",
    responses: { '200': 'Conversation summaries with previews.' },
  },
  {
    method: 'get',
    path: '/conversations/{id}',
    tag: 'Conversations',
    summary: 'Read one conversation with cursor-paginated messages',
    pathParams: ['id'],
    query: z.object({
      limit: z.coerce.number().int().min(1).max(200).default(100),
      before: z.string().min(1).optional(),
    }),
    responses: {
      '200': 'Conversation detail with a message page.',
      '404': 'Unknown conversation.',
    },
  },
  {
    method: 'delete',
    path: '/conversations/{id}',
    tag: 'Conversations',
    summary: "Delete one of the caller's conversations",
    pathParams: ['id'],
    responses: { '200': 'Deletion confirmation.', '404': 'Unknown conversation.' },
  },
  {
    method: 'get',
    path: '/developers',
    tag: 'Developers',
    summary: 'Search developers',
    description: 'Filters: text search, seniority, bench state, plus pagination.',
    query: developerListQuerySchema,
    responses: { '200': 'Developer summaries with skills and bench state.' },
  },
  {
    method: 'post',
    path: '/developers',
    tag: 'Developers',
    summary: 'Create a developer',
    description: 'Requires the manager or administrator role.',
    body: developerCreateSchema,
    responses: { '201': 'Created developer.', '400': 'Validation failed.' },
  },
  {
    method: 'get',
    path: '/developers/{id}',
    tag: 'Developers',
    summary: 'Read a developer profile',
    pathParams: ['id'],
    responses: {
      '200': 'Developer profile with assignments, contracts, and performance.',
      '404': 'Unknown developer.',
    },
  },
  {
    method: 'patch',
    path: '/developers/{id}',
    tag: 'Developers',
    summary: 'Update a developer',
    description: 'Requires the manager or administrator role.',
    pathParams: ['id'],
    body: developerUpdateSchema,
    responses: {
      '200': 'Updated developer.',
      '400': 'Validation failed.',
      '404': 'Unknown developer.',
    },
  },
  {
    method: 'delete',
    path: '/developers/{id}',
    tag: 'Developers',
    summary: 'Delete a developer',
    description: 'Requires the manager or administrator role.',
    pathParams: ['id'],
    responses: { '200': 'Deletion confirmation.', '404': 'Unknown developer.' },
  },
  {
    method: 'get',
    path: '/clients',
    tag: 'Clients',
    summary: 'Search clients',
    query: clientListQuerySchema,
    responses: { '200': 'Client summaries.' },
  },
  {
    method: 'post',
    path: '/clients',
    tag: 'Clients',
    summary: 'Create a client',
    description: 'Requires the manager or administrator role.',
    body: clientCreateSchema,
    responses: { '201': 'Created client.', '400': 'Validation failed.' },
  },
  {
    method: 'get',
    path: '/clients/{id}',
    tag: 'Clients',
    summary: 'Read a client profile',
    pathParams: ['id'],
    responses: {
      '200': 'Client profile with contacts, assignments, and contracts.',
      '404': 'Unknown client.',
    },
  },
  {
    method: 'patch',
    path: '/clients/{id}',
    tag: 'Clients',
    summary: 'Update a client',
    description: 'Requires the manager or administrator role.',
    pathParams: ['id'],
    body: clientUpdateSchema,
    responses: { '200': 'Updated client.', '400': 'Validation failed.', '404': 'Unknown client.' },
  },
  {
    method: 'delete',
    path: '/clients/{id}',
    tag: 'Clients',
    summary: 'Delete a client',
    description: 'Requires the manager or administrator role.',
    pathParams: ['id'],
    responses: { '200': 'Deletion confirmation.', '404': 'Unknown client.' },
  },
  {
    method: 'get',
    path: '/contracts',
    tag: 'Contracts',
    summary: 'Search contracts',
    description: 'Filters: status, expiry window, plus pagination.',
    query: contractListQuerySchema,
    responses: { '200': 'Contract summaries with days until expiry.' },
  },
  {
    method: 'post',
    path: '/contracts',
    tag: 'Contracts',
    summary: 'Create a contract',
    description: 'Requires the manager or administrator role.',
    body: contractCreateSchema,
    responses: { '201': 'Created contract.', '400': 'Validation failed.' },
  },
  {
    method: 'get',
    path: '/contracts/{id}',
    tag: 'Contracts',
    summary: 'Read a contract',
    pathParams: ['id'],
    responses: { '200': 'Contract detail.', '404': 'Unknown contract.' },
  },
  {
    method: 'patch',
    path: '/contracts/{id}',
    tag: 'Contracts',
    summary: 'Update a contract',
    description: 'Requires the manager or administrator role.',
    pathParams: ['id'],
    body: contractUpdateSchema,
    responses: {
      '200': 'Updated contract.',
      '400': 'Validation failed.',
      '404': 'Unknown contract.',
    },
  },
  {
    method: 'delete',
    path: '/contracts/{id}',
    tag: 'Contracts',
    summary: 'Delete a contract',
    description: 'Requires the manager or administrator role.',
    pathParams: ['id'],
    responses: { '200': 'Deletion confirmation.', '404': 'Unknown contract.' },
  },
  {
    method: 'get',
    path: '/assignments',
    tag: 'Assignments',
    summary: 'Search assignments',
    description: 'Filters: status, active state, plus pagination.',
    query: assignmentListQuerySchema,
    responses: { '200': 'Assignment summaries.' },
  },
  {
    method: 'post',
    path: '/assignments',
    tag: 'Assignments',
    summary: 'Create an assignment',
    description: 'Requires the manager or administrator role.',
    body: assignmentCreateSchema,
    responses: { '201': 'Created assignment.', '400': 'Validation failed.' },
  },
  {
    method: 'get',
    path: '/assignments/{id}',
    tag: 'Assignments',
    summary: 'Read an assignment',
    pathParams: ['id'],
    responses: { '200': 'Assignment detail.', '404': 'Unknown assignment.' },
  },
  {
    method: 'patch',
    path: '/assignments/{id}',
    tag: 'Assignments',
    summary: 'Update an assignment',
    description: 'Requires the manager or administrator role.',
    pathParams: ['id'],
    body: assignmentUpdateSchema,
    responses: {
      '200': 'Updated assignment.',
      '400': 'Validation failed.',
      '404': 'Unknown assignment.',
    },
  },
  {
    method: 'delete',
    path: '/assignments/{id}',
    tag: 'Assignments',
    summary: 'Delete an assignment',
    description: 'Requires the manager or administrator role.',
    pathParams: ['id'],
    responses: { '200': 'Deletion confirmation.', '404': 'Unknown assignment.' },
  },
  {
    method: 'get',
    path: '/performance',
    tag: 'Performance',
    summary: 'List performance records',
    description: 'Filters: developer, quarter, plus pagination.',
    query: performanceListQuerySchema,
    responses: { '200': 'Performance records.' },
  },
  {
    method: 'post',
    path: '/performance',
    tag: 'Performance',
    summary: 'Create a performance record',
    description: 'Requires the manager or administrator role.',
    body: performanceCreateSchema,
    responses: { '201': 'Created performance record.', '400': 'Validation failed.' },
  },
  {
    method: 'patch',
    path: '/performance/{id}',
    tag: 'Performance',
    summary: 'Update a performance record',
    description: 'Requires the manager or administrator role.',
    pathParams: ['id'],
    body: performanceUpdateSchema,
    responses: {
      '200': 'Updated performance record.',
      '400': 'Validation failed.',
      '404': 'Unknown record.',
    },
  },
  {
    method: 'delete',
    path: '/performance/{id}',
    tag: 'Performance',
    summary: 'Delete a performance record',
    description: 'Requires the manager or administrator role.',
    pathParams: ['id'],
    responses: { '200': 'Deletion confirmation.', '404': 'Unknown record.' },
  },
  {
    method: 'get',
    path: '/alerts',
    tag: 'Alerts',
    summary: 'List persisted staffing alerts',
    description: 'Reads the same rules the background worker and the agent use.',
    query: alertListQuerySchema,
    responses: { '200': 'Alert state with lifecycle timestamps.' },
  },
  {
    method: 'get',
    path: '/alerts/deliveries',
    tag: 'Alerts',
    summary: 'Inspect webhook delivery attempts',
    description: 'Administrator only.',
    query: alertDeliveryListQuerySchema,
    responses: { '200': 'Delivery attempts with status, attempts, and last error.' },
  },
  {
    method: 'get',
    path: '/admin/alerts/config',
    tag: 'Administration',
    summary: 'Inspect effective alert rules and delivery configuration',
    description: 'Administrator only.',
    responses: { '200': 'Scan interval, lease, webhook settings, and rule thresholds.' },
  },
  {
    method: 'post',
    path: '/admin/alerts/scan',
    tag: 'Administration',
    summary: 'Trigger an immediate alert scan',
    description: 'Administrator only. Audited as an administration action.',
    responses: { '201': 'Scan summary with opened, updated, resolved, and reopened counts.' },
  },
  {
    method: 'get',
    path: '/notifications',
    tag: 'Notifications',
    summary: "List the signed-in user's notification inbox",
    description: 'Requires a signed-in workspace user; API-key clients receive 403.',
    query: notificationListQuerySchema,
    responses: { '200': 'Notifications with per-user read state.' },
  },
  {
    method: 'get',
    path: '/notifications/unread-count',
    tag: 'Notifications',
    summary: "Get the signed-in user's unread count",
    responses: { '200': 'Unread count.' },
  },
  {
    method: 'post',
    path: '/notifications/read-all',
    tag: 'Notifications',
    summary: 'Mark all notifications as read',
    responses: { '200': 'Updated unread count.' },
  },
  {
    method: 'post',
    path: '/notifications/{id}/read',
    tag: 'Notifications',
    summary: 'Mark one notification as read',
    pathParams: ['id'],
    responses: { '200': 'Read confirmation.', '404': 'Unknown notification.' },
  },
  {
    method: 'get',
    path: '/forecast',
    tag: 'Forecast',
    summary: 'Capacity forecast with backfill recommendations',
    description:
      'Projects weekly bench supply against contract openings for a 1-26 week horizon and ranks up to three candidates per opening.',
    query: forecastQuerySchema,
    responses: { '200': 'Forecast summary, timeline, openings, and bench pool.' },
  },
  {
    method: 'get',
    path: '/admin/users',
    tag: 'Administration',
    summary: 'List workspace users and roles',
    description: 'Administrator only.',
    query: adminUserListQuerySchema,
    responses: { '200': 'Workspace users with roles.' },
  },
  {
    method: 'patch',
    path: '/admin/users/{id}/role',
    tag: 'Administration',
    summary: "Change a workspace user's role",
    description:
      'Administrator only. Protected by a serializable transaction; the workspace must keep at least one administrator.',
    pathParams: ['id'],
    body: updateUserRoleSchema,
    responses: {
      '200': 'Updated user.',
      '400': 'Validation failed or the last administrator would be demoted.',
      '404': 'Unknown user.',
    },
  },
  {
    method: 'get',
    path: '/admin/audit-logs',
    tag: 'Administration',
    summary: 'Browse mutation and access audit history',
    description: 'Administrator only.',
    query: auditLogListQuerySchema,
    responses: { '200': 'Audit log entries with before/after state.' },
  },
  {
    method: 'get',
    path: '/metrics',
    tag: 'Metrics',
    summary: 'Prometheus exposition for alert operations',
    description:
      'Requires the `x-metrics-token` header (or `Authorization: Bearer`) when METRICS_TOKEN is configured; returns 404 when no token is set.',
    secure: false,
    responses: {
      '200': 'Prometheus text exposition.',
      '401': 'Invalid metrics token.',
      '404': 'Metrics are disabled (no token configured).',
    },
  },
];

function openApiPath(path: string): string {
  return path.replace(/:([A-Za-z]+)/g, '{$1}');
}

function operationResponses(spec: OperationSpec): JsonObject {
  const contentType = spec.sse ? 'text/event-stream' : 'application/json';
  const responses: JsonObject = {};
  for (const [status, description] of Object.entries(spec.responses)) {
    responses[status] = {
      description,
      ...(status.startsWith('2') && !spec.sse
        ? { content: { [contentType]: { schema: { type: 'object' } } } }
        : {}),
      ...(spec.sse && status === '200'
        ? { content: { [contentType]: { schema: { type: 'string' } } } }
        : {}),
    };
  }
  return responses;
}

function operationFrom(spec: OperationSpec): JsonObject {
  const parameters = [
    ...pathParameters(spec.pathParams),
    ...(spec.query ? queryParameters(spec.query) : []),
  ];
  return {
    tags: [spec.tag],
    summary: spec.summary,
    ...(spec.description ? { description: spec.description } : {}),
    ...(spec.secure === false ? { security: [] } : {}),
    ...(parameters.length > 0 ? { parameters } : {}),
    ...(spec.body
      ? {
          requestBody: {
            required: true,
            content: { 'application/json': { schema: jsonSchemaOf(spec.body) } },
          },
        }
      : {}),
    responses: operationResponses(spec),
  };
}

export function buildOpenApiDocument(): JsonObject {
  const paths: JsonObject = {};
  const tags = new Set<string>();

  for (const spec of OPERATIONS) {
    tags.add(spec.tag);
    const path = openApiPath(spec.path);
    const item = (paths[path] ?? {}) as JsonObject;
    item[spec.method] = operationFrom(spec);
    paths[path] = item;
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Aya API',
      version: '1.0.0',
      description: [
        'AI-powered staff augmentation agent API.',
        '',
        '**Authentication** — every secured operation accepts either an internal',
        'client key in the `x-api-key` header or a Better Auth session cookie.',
        'API keys bypass role checks; sessions enforce the viewer/manager/admin roles.',
        'Notifications require a signed-in user.',
        '',
        '**Errors** — failures return a JSON envelope with `message`, `error`,',
        'and `statusCode`. Every response carries an `x-request-id` header.',
      ].join('\n'),
    },
    servers: [{ url: '/', description: 'This deployment' }],
    tags: [...tags].map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'Internal client key (API_KEY / API_KEYS).',
        },
        SessionCookie: {
          type: 'apiKey',
          in: 'cookie',
          name: 'better-auth.session_token',
          description: 'Better Auth session cookie for signed-in workspace users.',
        },
        MetricsToken: {
          type: 'apiKey',
          in: 'header',
          name: 'x-metrics-token',
          description: 'Token required by GET /metrics when METRICS_TOKEN is configured.',
        },
      },
    },
    security: [{ ApiKeyAuth: [] }, { SessionCookie: [] }],
  };
}

/** Content type of the generated document; exported for the controller. */
export const OPENAPI_JSON_PATH = '/openapi.json';

/** Route handlers for the interactive reference, kept CSP-clean (no inline scripts). */
export function docsHtmlPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Aya API reference</title>
    <link rel="stylesheet" href="/docs/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/docs/swagger-ui-bundle.js" crossorigin></script>
    <script src="/docs/init.js" crossorigin></script>
  </body>
</html>
`;
}

export function docsInitializerScript(): string {
  return `window.onload = () => {
  window.ui = SwaggerUIBundle({
    url: '/openapi.json',
    dom_id: '#swagger-ui',
    deepLinking: true,
    persistAuthorization: true,
    docExpansion: 'none',
  });
};
`;
}
