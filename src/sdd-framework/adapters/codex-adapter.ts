/**
 * Codex Platform Adapter
 * 
 * Handles OpenAI Codex-specific skill formatting and workspace operations.
 * Codex uses directory-based skills with SKILL.md files and AGENTS.md for instructions.
 */

import type { PlatformAdapter } from './platform-adapter';
import type {
  CanonicalSkill,
  PlatformSkill,
  SpecMetadata,
  ValidationResult,
  DirectorySkill,
} from '../types';

/**
 * Adapter for the OpenAI Codex platform.
 * 
 * Codex uses:
 * - `.codex/skills/` for workspace skills (directory-based with SKILL.md)
 * - `.kiro/specs/` for spec storage (unified location)
 * - `AGENTS.md` for project instructions
 * - Directory-based skills with SKILL.md file per skill
 */
export class CodexAdapter implements PlatformAdapter {
  readonly platformId = 'codex' as const;
  readonly skillsPath = '.codex/skills/';
  readonly specsPath = '.kiro/specs/';
  readonly instructionsFile = 'AGENTS.md';

  getSkillsDirectory(): string {
    return this.skillsPath;
  }

  getSpecsDirectory(): string {
    return this.specsPath;
  }

  getUserSkillsDirectory(): string | null {
    // Codex doesn't have a standard user-level skills directory
    return null;
  }

  formatSkill(skill: CanonicalSkill): PlatformSkill {
    // Get platform-specific overrides if available
    const overrides = skill.platformOverrides?.codex;
    const instructions = overrides?.instructions ?? skill.instructions;
    const additionalContent = overrides?.additionalContent ?? '';

    // Build the skill content in Codex format (directory with SKILL.md)
    const content = `# ${skill.title}

${skill.description}

## Instructions

${instructions}
${additionalContent ? `\n${additionalContent}` : ''}`;

    return {
      directory: skill.name,
      files: [
        {
          filename: 'SKILL.md',
          content,
        },
      ],
    } as DirectorySkill;
  }

  parseSkill(content: string): CanonicalSkill {
    // Parse title from first heading
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : '';

    // Parse description (text after title, before ## Instructions)
    const descriptionMatch = content.match(/^#\s+.+\n\n([\s\S]*?)(?=\n## Instructions)/);
    const description = descriptionMatch ? descriptionMatch[1].trim() : '';

    // Parse instructions (content after ## Instructions)
    const instructionsMatch = content.match(/## Instructions\n\n([\s\S]*?)$/);
    const instructions = instructionsMatch ? instructionsMatch[1].trim() : '';

    // Extract name from title (convert to kebab-case)
    const name = title.toLowerCase().replace(/\s+/g, '-');

    return {
      name,
      title,
      description,
      version: '1.0.0',
      supportedPlatforms: ['codex'],
      instructions,
      parameters: [],
    };
  }

  generateInstructionsContent(specs: SpecMetadata[]): string {
    const specsList = specs.length > 0
      ? specs.map(s => `- ${s.name}: ${s.description}`).join('\n')
      : '- No specs found';

    return `# Agent Instructions

## Project Structure

This project uses structured specs in \`.kiro/specs/\`.

## Skills

Skills are available in \`.codex/skills/\`. Each skill has a SKILL.md file.

## Specs

${specsList}
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
