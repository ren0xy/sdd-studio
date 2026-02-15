import { describe, it, expect } from 'vitest';
import { allSkills, getSkillByName, refineSpecSkill } from '../skills/index';

describe('refine-spec skill registration', () => {
  it('refineSpecSkill is in allSkills array', () => {
    expect(allSkills).toContain(refineSpecSkill);
  });

  it('getSkillByName returns refine-spec skill', () => {
    const skill = getSkillByName('refine-spec');
    expect(skill).toBeDefined();
    expect(skill?.name).toBe('refine-spec');
  });

  it('refine-spec skill has required fields', () => {
    expect(refineSpecSkill.name).toBe('refine-spec');
    expect(refineSpecSkill.instructions).toBeTruthy();
    expect(refineSpecSkill.parameters.length).toBeGreaterThan(0);
  });
});
