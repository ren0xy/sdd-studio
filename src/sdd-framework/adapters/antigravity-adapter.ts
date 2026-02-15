/**
 * Antigravity Platform Adapter
 * 
 * Handles Google Antigravity-specific skill formatting and workspace operations.
 * Antigravity uses markdown files for skills and `.agent/rules/specs.md` for instructions.
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
 * Adapter for the Google Antigravity platform.
 * 
 * Antigravity uses:
 * - `.agent/skills/` for workspace skills
 * - `.kiro/specs/` for spec storage (unified location)
 * - `.agent/rules/specs.md` for project instructions
 * - Markdown files for skills
 */
export class AntigravityAdapter implements PlatformAdapter {
  readonly platformId = 'antigravity' as const;
  readonly skillsPath = '.agent/skills/';
  readonly specsPath = '.kiro/specs/';
  readonly instructionsFile = '.agent/rules/specs.md';

  getSkillsDirectory(): string {
    return this.skillsPath;
  }

  getSpecsDirectory(): string {
    return this.specsPath;
  }

  getUserSkillsDirectory(): string | null {
    // Antigravity doesn't support user-level skills
    return null;
  }

  formatSkill(skill: CanonicalSkill): PlatformSkill {
    // Get platform-specific overrides if available
    const overrides = skill.platformOverrides?.antigravity;
    const instructions = overrides?.instructions ?? skill.instructions;
    const additionalContent = overrides?.additionalContent ?? '';

    // Build the skill content in Antigravity format
    const content = `# ${skill.title}

${skill.description}

${instructions}
${additionalContent ? `\n${additionalContent}` : ''}`;

    return {
      directory: skill.name,
      files: [{ filename: 'SKILL.md', content }],
    } as DirectorySkill;
  }

  parseSkill(content: string): CanonicalSkill {
    // Parse title from first heading
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : '';

    // Parse description and instructions (text after title)
    // Antigravity format doesn't have explicit sections, so we split on double newline
    const bodyMatch = content.match(/^#\s+.+\n\n([\s\S]*)$/);
    const body = bodyMatch ? bodyMatch[1].trim() : '';

    // First paragraph is description, rest is instructions
    const paragraphs = body.split(/\n\n/);
    const description = paragraphs[0] || '';
    const instructions = paragraphs.slice(1).join('\n\n');

    // Extract name from title (convert to kebab-case)
    const name = title.toLowerCase().replace(/\s+/g, '-');

    return {
      name,
      title,
      description,
      version: '1.0.0',
      supportedPlatforms: ['antigravity'],
      instructions,
      parameters: [],
    };
  }

  generateInstructionsContent(specs: SpecMetadata[]): string {
    const specsList = specs.length > 0
      ? specs.map(s => `- **${s.name}**: ${s.description}`).join('\n')
      : '- No specs found';

    return `# Specs Instructions

## Project Structure

This project uses structured specs located in \`.kiro/specs/\`.

## Available Specs

${specsList}

## Working with Specs

Use the skills in \`.agent/skills/\` for spec management.
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
