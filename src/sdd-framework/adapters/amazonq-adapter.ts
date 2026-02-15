/**
 * Amazon Q Developer Platform Adapter
 * 
 * Handles Amazon Q-specific skill formatting and workspace operations.
 * Amazon Q uses `.amazonq/rules/` for project-level instruction files (free-form markdown).
 * Rules are auto-loaded — no conditional inclusion mechanism.
 * Amazon Q inherits Claude's markdown quirks (Claude models via Amazon Bedrock).
 */

import * as fs from 'fs';
import type { PlatformAdapter } from './platform-adapter';
import type {
  CanonicalSkill,
  PlatformSkill,
  SpecMetadata,
  ValidationResult,
  SingleFileSkill,
} from '../types';

/**
 * Adapter for the Amazon Q Developer platform.
 * 
 * Amazon Q uses:
 * - `.amazonq/rules/` for project-level rule files
 * - `.kiro/specs/` for spec storage (unified location)
 * - No instructions file (auto-loads all rules)
 * - Free-form markdown for rules
 */
export class AmazonQAdapter implements PlatformAdapter {
  readonly platformId = 'amazonq' as const;
  readonly skillsPath = '.amazonq/rules/';
  readonly specsPath = '.kiro/specs/';
  readonly instructionsFile = null;

  getSkillsDirectory(): string {
    return this.skillsPath;
  }

  getSpecsDirectory(): string {
    return this.specsPath;
  }

  getUserSkillsDirectory(): string | null {
    return null;
  }

  formatSkill(skill: CanonicalSkill): PlatformSkill {
    const overrides = skill.platformOverrides?.amazonq;
    const instructions = overrides?.instructions ?? skill.instructions;
    const additionalContent = overrides?.additionalContent ?? '';

    const content = `# ${skill.title}

${skill.description}

${instructions}
${additionalContent ? `\n${additionalContent}` : ''}`;

    return {
      filename: `${skill.name}.md`,
      content,
    } as SingleFileSkill;
  }

  parseSkill(content: string): CanonicalSkill {
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : '';

    const bodyMatch = content.match(/^#\s+.+\n\n([\s\S]*)$/);
    const body = bodyMatch ? bodyMatch[1].trim() : '';

    const paragraphs = body.split(/\n\n/);
    const description = paragraphs[0] || '';
    const instructions = paragraphs.slice(1).join('\n\n');

    const name = title.toLowerCase().replace(/\s+/g, '-');

    return {
      name,
      title,
      description,
      version: '1.0.0',
      supportedPlatforms: ['amazonq'],
      instructions,
      parameters: [],
    };
  }

  generateInstructionsContent(specs: SpecMetadata[]): string {
    const specsList = specs.length > 0
      ? specs.map(s => `- **${s.name}**: ${s.description}`).join('\n')
      : '- No specs found';

    return `# SDD Framework

## Project Structure

This project uses structured specs located in \`.kiro/specs/\`.

## Available Specs

${specsList}

## Working with Specs

Rules in \`.amazonq/rules/\` are automatically loaded by Amazon Q Developer.
`;
  }

  validateWorkspace(): ValidationResult {
    const errors: import('../types').ValidationError[] = [];
    const warnings: import('../types').ValidationWarning[] = [];

    if (!fs.existsSync('.amazonq')) {
      warnings.push({
        code: 'MISSING_AMAZONQ_DIR',
        message: '.amazonq/ directory does not exist',
        suggestion: 'Create the .amazonq/ directory to configure Amazon Q Developer',
      });
    } else if (!fs.existsSync('.amazonq/rules')) {
      warnings.push({
        code: 'MISSING_RULES_DIR',
        message: '.amazonq/rules/ directory does not exist',
        suggestion: 'Create the .amazonq/rules/ directory for Amazon Q project rules',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
