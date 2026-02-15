/**
 * Claude Code Platform Adapter
 * 
 * Handles Claude Code-specific skill formatting and workspace operations.
 * Claude Code uses markdown files for skills and CLAUDE.md for instructions.
 */

import type { PlatformAdapter } from './platform-adapter';
import type {
  CanonicalSkill,
  PlatformSkill,
  SpecMetadata,
  ValidationResult,
  SingleFileSkill,
} from '../types';

/**
 * Adapter for the Claude Code platform.
 * 
 * Claude Code uses:
 * - `.claude/skills/` for workspace skills
 * - `.kiro/specs/` for spec storage (unified location)
 * - `CLAUDE.md` for project instructions
 * - Markdown files for skills
 */
export class ClaudeCodeAdapter implements PlatformAdapter {
  readonly platformId = 'claude-code' as const;
  readonly skillsPath = '.claude/skills/';
  readonly specsPath = '.kiro/specs/';
  readonly instructionsFile = 'CLAUDE.md';

  getSkillsDirectory(): string {
    return this.skillsPath;
  }

  getSpecsDirectory(): string {
    return this.specsPath;
  }

  getUserSkillsDirectory(): string | null {
    // Claude Code doesn't have a standard user-level skills directory
    return null;
  }

  formatSkill(skill: CanonicalSkill): PlatformSkill {
    // Get platform-specific overrides if available
    const overrides = skill.platformOverrides?.['claude-code'];
    const instructions = overrides?.instructions ?? skill.instructions;
    const additionalContent = overrides?.additionalContent ?? '';

    // Build the skill content in Claude Code format
    const content = `# ${skill.title}

${skill.description}

## Usage

${instructions}
${additionalContent ? `\n${additionalContent}` : ''}`;

    return {
      filename: `${skill.name}.md`,
      content,
    } as SingleFileSkill;
  }

  parseSkill(content: string): CanonicalSkill {
    // Parse title from first heading
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : '';

    // Parse description (text after title, before ## Usage)
    const descriptionMatch = content.match(/^#\s+.+\n\n([\s\S]*?)(?=\n## Usage)/);
    const description = descriptionMatch ? descriptionMatch[1].trim() : '';

    // Parse instructions (content after ## Usage)
    const instructionsMatch = content.match(/## Usage\n\n([\s\S]*?)$/);
    const instructions = instructionsMatch ? instructionsMatch[1].trim() : '';

    // Extract name from title (convert to kebab-case)
    const name = title.toLowerCase().replace(/\s+/g, '-');

    return {
      name,
      title,
      description,
      version: '1.0.0',
      supportedPlatforms: ['claude-code'],
      instructions,
      parameters: [],
    };
  }

  generateInstructionsContent(specs: SpecMetadata[]): string {
    const specsList = specs.length > 0
      ? specs.map(s => `- **${s.name}**: ${s.description}`).join('\n')
      : '- No specs found';

    return `# Project Instructions

## Specs

This project uses structured specs located in \`.kiro/specs/\`.

${specsList}

## Available Skills

Use the skills in \`.claude/skills/\` for spec management.
`;
  }

  validateWorkspace(): ValidationResult {
    // Basic validation - in a real implementation this would check
    // for the existence of required directories and files
    return {
      valid: true,
      errors: [],
      warnings: [],
    };
  }
}
