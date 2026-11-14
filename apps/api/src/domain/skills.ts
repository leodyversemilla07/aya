/**
 * Canonical skill matching keeps related technologies distinct while still
 * treating punctuation and spacing variants as equivalent. For example,
 * "Node.js", "Node JS", and "NodeJS" match, while "React" does not match
 * "React Native".
 */
export function canonicalizeSkillName(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+#]/gu, '');
}

export function skillNamesMatch(left: string, right: string): boolean {
  return canonicalizeSkillName(left) === canonicalizeSkillName(right);
}

/**
 * Finds skill names that collide once canonicalized. Writes go through this so
 * a developer never ends up with "Node.js" and "node js" as two separate
 * skills, which the agent would otherwise treat as one.
 */
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
