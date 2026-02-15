/**
 * Canonical Skill Definitions
 * 
 * This module exports all canonical skill definitions for the
 * Context Engineering Framework.
 */

export { workspaceInitSkill } from './workspace-init';
export { createSpecSkill } from './create-spec';
export { runTaskSkill } from './run-task';
export { installSkillsSkill } from './install-skills';
export { refineSpecSkill } from './refine-spec';
export { startTaskGroupSkill } from './start-task-group';
export { analyzeTaskFailureSkill } from './analyze-task-failure';

import { workspaceInitSkill } from './workspace-init';
import { createSpecSkill } from './create-spec';
import { runTaskSkill } from './run-task';
import { installSkillsSkill } from './install-skills';
import { refineSpecSkill } from './refine-spec';
import { startTaskGroupSkill } from './start-task-group';
import { analyzeTaskFailureSkill } from './analyze-task-failure';
import { CanonicalSkill } from '../types';

/**
 * All canonical skills available in the framework
 */
export const allSkills: CanonicalSkill[] = [
  workspaceInitSkill,
  createSpecSkill,
  runTaskSkill,
  installSkillsSkill,
  refineSpecSkill,
  startTaskGroupSkill,
  analyzeTaskFailureSkill
];

/**
 * Get a skill by name
 */
export function getSkillByName(name: string): CanonicalSkill | undefined {
  return allSkills.find(skill => skill.name === name);
}
