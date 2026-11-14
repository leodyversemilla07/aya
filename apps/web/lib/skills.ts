/**
 * Mirrors the skill-name rule the API enforces (`apps/api/src/domain/skills.ts`).
 * The API is the source of truth; this copy only lets the management console
 * warn about duplicates before a request is sent.
 */
export function canonicalizeSkillName(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+#]/gu, '');
}

/** Returns the names that collide with an earlier entry once canonicalized. */
export function findDuplicateSkillNames(names: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const name of names) {
    const canonical = canonicalizeSkillName(name);
    if (canonical.length === 0) continue;
    if (seen.has(canonical)) {
      duplicates.add(name.trim());
      continue;
    }
    seen.add(canonical);
  }

  return [...duplicates];
}
