export const USER_ROLES = ['admin', 'manager', 'viewer'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function normalizeUserRole(value: unknown): UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value)
    ? (value as UserRole)
    : 'viewer';
}
