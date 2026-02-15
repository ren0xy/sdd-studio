/**
 * Skill CLI Generator
 * 
 * Generates CLI invocation instructions for each skill, formatted
 * for each platform's shell syntax. These instructions are included
 * in transformed skills so agents can invoke deterministic CLI commands
 * instead of performing file operations directly.
 * 
 * Requirements: 6.1, 6.2, 6.4
 */

import type { PlatformId } from '../types';

/**
 * A CLI invocation instruction for a skill operation
 */
export interface CLIInvocation {
  command: string;
  description: string;
  example: string;
}

/**
 * Map of skill names to the CLI commands they should invoke
 */
const SKILL_CLI_MAP: Record<string, CLIInvocation[]> = {
  'create-spec': [
    {
      command: 'npx sdd create-spec <name>',
      description: 'Create a new spec folder with template files',
      example: 'npx sdd create-spec user-authentication --mode requirements-first',
    },
  ],
  'run-task': [
    {
      command: 'npx sdd run-task --spec <name> --task <id> --status <status>',
      description: 'Update task status in tasks.md',
      example: 'npx sdd run-task --spec user-authentication --task 1.1 --status completed',
    },
  ],
  'workspace-init': [
    {
      command: 'npx sdd workspace-init --platform <platform>',
      description: 'Initialize workspace for a target platform',
      example: 'npx sdd workspace-init --platform claude-code',
    },
  ],
  'install-skills': [
    {
      command: 'npx sdd install-skills --platform <platform>',
      description: 'Install framework skills for a platform',
      example: 'npx sdd install-skills --platform kiro --force',
    },
  ],
};

/**
 * SkillCLIGenerator produces CLI invocation instructions that get embedded
 * into transformed skill content. This ensures agents use deterministic
 * CLI commands for critical operations.
 */
export class SkillCLIGenerator {
  /**
   * Get the CLI invocations associated with a skill.
   * 
   * @param skillName - The canonical skill name
   * @returns Array of CLI invocations, empty if the skill has no CLI commands
   */
  generateInvocations(skillName: string): CLIInvocation[] {
    return SKILL_CLI_MAP[skillName] ?? [];
  }

  /**
   * Format a CLI invocation instruction block for a specific platform.
   * All platforms use the same `npx sdd` prefix for portability (Requirement 6.4),
   * but the surrounding instruction prose adapts to platform conventions.
   * 
   * @param invocation - The CLI invocation to format
   * @param platform - The target platform
   * @returns Formatted instruction string
   */
  formatForPlatform(invocation: CLIInvocation, platform: PlatformId): string {
    const header = platform === 'antigravity'
      ? '**CLI Command**'
      : '**CLI Command**';

    return [
      header,
      '',
      `${invocation.description}:`,
      '',
      '```bash',
      invocation.command,
      '```',
      '',
      `Example:`,
      '',
      '```bash',
      invocation.example,
      '```',
    ].join('\n');
  }

  /**
   * Generate a complete CLI instructions section for a skill on a given platform.
   * Returns an empty string if the skill has no associated CLI commands.
   * 
   * @param skillName - The canonical skill name
   * @param platform - The target platform
   * @returns Markdown section with CLI instructions, or empty string
   */
  generateCLISection(skillName: string, platform: PlatformId): string {
    const invocations = this.generateInvocations(skillName);
    if (invocations.length === 0) {
      return '';
    }

    const formatted = invocations
      .map(inv => this.formatForPlatform(inv, platform))
      .join('\n\n');

    return [
      '',
      '## CLI Invocation',
      '',
      'For reliable execution, use the CLI command instead of performing file operations directly.',
      'If the CLI command fails, report the error and do not attempt manual recovery.',
      '',
      formatted,
      '',
    ].join('\n');
  }
}
