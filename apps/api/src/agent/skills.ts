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
