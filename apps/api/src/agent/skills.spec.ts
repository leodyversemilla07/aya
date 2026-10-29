import { canonicalizeSkillName, skillNamesMatch } from './skills';

describe('skill matching', () => {
  it('treats punctuation and spacing variants as equivalent', () => {
    expect(skillNamesMatch('Node.js', 'Node JS')).toBe(true);
    expect(skillNamesMatch('NodeJS', 'nodejs')).toBe(true);
    expect(skillNamesMatch('CI/CD', 'ci cd')).toBe(true);
  });

  it('does not confuse distinct technologies', () => {
    expect(skillNamesMatch('React', 'React Native')).toBe(false);
    expect(skillNamesMatch('Java', 'JavaScript')).toBe(false);
  });

  it('produces stable canonical names', () => {
    expect(canonicalizeSkillName('  HTML/CSS  ')).toBe('htmlcss');
    expect(canonicalizeSkillName('日本語')).toBe('日本語');
  });
});
