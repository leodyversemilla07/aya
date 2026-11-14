/**
 * Prisma filters that behave the same way on every supported database.
 *
 * SQLite and PostgreSQL disagree about string matching: SQLite's `LIKE` is
 * already case-insensitive for ASCII, while PostgreSQL's `LIKE` is
 * case-sensitive and needs `ILIKE`. Prisma exposes that difference through the
 * `mode` argument of a string filter, but the SQLite engine rejects `mode`
 * outright, so the filter has to be built for the database in use.
 */

/** A `contains` filter that ignores case on both SQLite and PostgreSQL. */
export interface CaseInsensitiveContainsFilter {
  contains: string;
  /** Only understood by the PostgreSQL engine. */
  mode?: 'insensitive';
}

/** Reports whether the configured datasource is PostgreSQL. */
export function isPostgresProvider(
  databaseUrl: string | undefined = process.env.DATABASE_URL,
): boolean {
  return /^postgres(ql)?:\/\//i.test(databaseUrl ?? '');
}

/**
 * Builds a "contains" filter that ignores case, so the same query returns the
 * same rows on SQLite and PostgreSQL.
 */
export function containsIgnoreCase(
  value: string,
  databaseUrl: string | undefined = process.env.DATABASE_URL,
): CaseInsensitiveContainsFilter {
  return isPostgresProvider(databaseUrl)
    ? { contains: value, mode: 'insensitive' }
    : { contains: value };
}
