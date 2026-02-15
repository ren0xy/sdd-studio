/**
 * Kiro Platform Adapter
 * 
 * Handles Kiro-specific skill formatting and workspace operations.
 * Kiro uses markdown files with front-matter for skills and
 * `.kiro/specs/` for spec storage.
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
 * Adapter for the Kiro platform.
 * 
 * Kiro uses:
 * - `.kiro/skills/` for workspace skills
 * - `~/.kiro/skills/` for user-level skills
 * - `.kiro/specs/` for spec storage
 * - Markdown files with `inclusion: auto` front-matter for skills
 * - Steering files instead of a single instructions file
 */
export class KiroAdapter implements PlatformAdapter {
  readonly platformId = 'kiro' as const;
  readonly skillsPath = '.kiro/skills/';
  readonly specsPath = '.kiro/specs/';
  readonly instructionsFile = null; // Kiro uses steering files instead

  getSkillsDirectory(): string {
    return this.skillsPath;
  }

  getSpecsDirectory(): string {
    return this.specsPath;
  }

  getUserSkillsDirectory(): string {
    return '~/.kiro/skills/';
  }

  formatSkill(skill: CanonicalSkill): PlatformSkill {
    // Get platform-specific overrides if available
    const overrides = skill.platformOverrides?.kiro;
    const instructions = overrides?.instructions ?? skill.instructions;
    const additionalContent = overrides?.additionalContent ?? '';

    // Build the skill content with front-matter
    const content = `---
inclusion: auto
---

# ${skill.title}

${skill.description}

## Instructions

${instructions}
${additionalContent ? `\n${additionalContent}` : ''}`;

    return {
      filename: `${skill.name}.md`,
      content,
    } as SingleFileSkill;
  }

  parseSkill(content: string): CanonicalSkill {
    // Parse front-matter and content
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    
    if (!frontMatterMatch) {
      throw new Error('Invalid Kiro skill format: missing front-matter');
    }

    const body = frontMatterMatch[2];

    // Parse title from first heading
    const titleMatch = body.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : '';

    // Parse description (text after title, before ## Instructions)
    const descriptionMatch = body.match(/^#\s+.+\n\n([\s\S]*?)(?=\n## Instructions)/);
    const description = descriptionMatch ? descriptionMatch[1].trim() : '';

    // Parse instructions (content after ## Instructions)
    const instructionsMatch = body.match(/## Instructions\n\n([\s\S]*?)$/);
    const instructions = instructionsMatch ? instructionsMatch[1].trim() : '';

    // Extract name from title (convert to kebab-case)
    const name = title.toLowerCase().replace(/\s+/g, '-');

    return {
      name,
      title,
      description,
      version: '1.0.0',
      supportedPlatforms: ['kiro'],
      instructions,
      parameters: [],
    };
  }

  generateInstructionsContent(_specs: SpecMetadata[]): string {
    // Kiro doesn't use a single instructions file - it uses steering files
    // Return empty string as this method shouldn't be called for Kiro
    return '';
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
