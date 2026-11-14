import { containsIgnoreCase, isPostgresProvider } from '@workspace/db';

describe('database string filters', () => {
  describe('isPostgresProvider', () => {
    it('recognises PostgreSQL connection strings', () => {
      expect(isPostgresProvider('postgresql://user:pass@localhost:5432/aya')).toBe(true);
      expect(isPostgresProvider('postgres://user:pass@localhost:5432/aya')).toBe(true);
      expect(isPostgresProvider('POSTGRESQL://user:pass@localhost:5432/aya')).toBe(true);
    });

    it('treats SQLite URLs as non-PostgreSQL', () => {
      expect(isPostgresProvider('file:./dev.db')).toBe(false);
      expect(isPostgresProvider('')).toBe(false);
    });
  });

  describe('containsIgnoreCase', () => {
    it('asks PostgreSQL for a case-insensitive match', () => {
      expect(containsIgnoreCase('aya', 'postgresql://user:pass@localhost:5432/aya')).toEqual({
        contains: 'aya',
        mode: 'insensitive',
      });
    });

    it('relies on SQLite, whose LIKE is already case-insensitive', () => {
      // The SQLite engine rejects the `mode` argument outright.
      expect(containsIgnoreCase('aya', 'file:./dev.db')).toEqual({ contains: 'aya' });
    });
  });
});
