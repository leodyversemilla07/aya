import { describe, expect, it } from 'vitest';
import { canonicalizeSkillName, findDuplicateSkillNames } from '../lib/skills';

describe('canonicalizeSkillName', () => {
  it('ignores punctuation, casing, and spacing', () => {
    expect(canonicalizeSkillName('Node.js')).toBe('nodejs');
    expect(canonicalizeSkillName('  Node JS ')).toBe('nodejs');
    expect(canonicalizeSkillName('CI/CD')).toBe('cicd');
  });

  it('keeps meaningful characters', () => {
    expect(canonicalizeSkillName('C#')).toBe('c#');
    expect(canonicalizeSkillName('C++')).toBe('c++');
  });
});

describe('findDuplicateSkillNames', () => {
  it('reports names that collide once canonicalized', () => {
    expect(findDuplicateSkillNames(['TypeScript', 'NestJS'])).toEqual([]);
    expect(findDuplicateSkillNames(['React', 'React'])).toEqual(['React']);
    expect(findDuplicateSkillNames(['Node.js', 'node js'])).toEqual(['node js']);
  });

  it('reports every later collision', () => {
    expect(findDuplicateSkillNames(['React', 'REACT', 'react'])).toEqual(['REACT', 'react']);
  });

  it('ignores blank names', () => {
    expect(findDuplicateSkillNames(['React', '   '])).toEqual([]);
  });
});
