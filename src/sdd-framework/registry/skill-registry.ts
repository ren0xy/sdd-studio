/**
 * Skill Registry - Central catalog of all available skills
 * 
 * Manages skill registration, validation, retrieval with platform filtering,
 * and installation to workspace directories.
 * Requirements: 2.1, 2.2, 2.3, 2.4, 8.1, 8.7
 */

import type { CanonicalSkill, PlatformId, SkillMetadata, ValidationResult, ValidationError, SkillInstallResult } from '../types';
import { isDirectorySkill } from '../types';
import type { PlatformAdapter } from '../adapters/platform-adapter';

/**
 * File system interface for skill installation
 * Allows dependency injection for testing
 */
export interface FileSystem {
  exists(path: string): Promise<boolean>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  writeFile(path: string, content: string): Promise<void>;
}

/**
 * SkillRegistry maintains a catalog of all available skills with their
 * descriptions and supported platforms.
 */
export class SkillRegistry {
  private skills: Map<string, CanonicalSkill> = new Map();

  /**
   * Register a new skill with validation.
   * Validates that required fields exist and at least one platform is supported.
   * 
   * @param skill - The canonical skill definition to register
   * @throws Error if skill validation fails
   * Requirements: 2.3
   */
  register(skill: CanonicalSkill): void {
    const validation = this.validateSkill(skill);
    if (!validation.valid) {
      const errorMessages = validation.errors.map((e: ValidationError) => e.message).join(', ');
      throw new Error(`Invalid skill: ${errorMessages}`);
    }
    this.skills.set(skill.name, skill);
  }

  /**
   * Retrieve a skill by name.
   * 
   * @param name - The skill name to look up
   * @returns The canonical skill definition or undefined if not found
   * Requirements: 2.1
   */
  get(name: string): CanonicalSkill | undefined {
    return this.skills.get(name);
  }

  /**
   * List skills filtered by platform.
   * Returns only metadata (without instructions and parameters) for skills
   * that support the specified platform.
   * 
   * @param platform - The platform to filter by
   * @returns Array of skill metadata for skills supporting the platform
   * Requirements: 2.2
   */
  listForPlatform(platform: PlatformId): SkillMetadata[] {
    return Array.from(this.skills.values())
      .filter(skill => skill.supportedPlatforms.includes(platform))
      .map(({ name, title, description, version, supportedPlatforms }) => ({
        name,
        title,
        description,
        version,
        supportedPlatforms
      }));
  }

  /**
   * List all registered skills.
   * 
   * @returns Array of all skill metadata
   * Requirements: 2.1, 2.4
   */
  listAll(): SkillMetadata[] {
    return Array.from(this.skills.values())
      .map(({ name, title, description, version, supportedPlatforms }) => ({
        name,
        title,
        description,
        version,
        supportedPlatforms
      }));
  }

  /**
   * Validate a skill definition.
   * Checks for required fields: name, instructions, and at least one supported platform.
   * 
   * @param skill - The skill to validate
   * @returns Validation result with any errors
   * Requirements: 2.3
   */
  private validateSkill(skill: CanonicalSkill): ValidationResult {
    const errors: ValidationResult['errors'] = [];

    if (!skill.name || typeof skill.name !== 'string' || skill.name.trim() === '') {
      errors.push({
        code: 'INVALID_SKILL',
        message: 'Skill must have a name'
      });
    }

    if (!skill.instructions || typeof skill.instructions !== 'string' || skill.instructions.trim() === '') {
      errors.push({
        code: 'INVALID_SKILL',
        message: 'Skill must have instructions'
      });
    }

    if (!skill.supportedPlatforms || !Array.isArray(skill.supportedPlatforms) || skill.supportedPlatforms.length === 0) {
      errors.push({
        code: 'INVALID_SKILL',
        message: 'Skill must support at least one platform'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  /**
   * Install a skill to the workspace skills directory for a specific platform.
   * Creates the target directory if it doesn't exist.
   * 
   * @param skillName - The name of the skill to install
   * @param adapter - The platform adapter to use for formatting
   * @param fs - File system interface for writing files
   * @returns Installation result with success status and details
   * Requirements: 8.1, 8.7
   */
  async install(
    skillName: string,
    adapter: PlatformAdapter,
    fs: FileSystem
  ): Promise<SkillInstallResult> {
    const skill = this.skills.get(skillName);
    
    if (!skill) {
      return {
        success: false,
        skillName,
        targetPath: '',
        directoryCreated: false,
        error: `Skill not found: ${skillName}`
      };
    }

    if (!skill.supportedPlatforms.includes(adapter.platformId)) {
      return {
        success: false,
        skillName,
        targetPath: '',
        directoryCreated: false,
        error: `Skill ${skillName} does not support platform ${adapter.platformId}`
      };
    }

    const skillsDir = adapter.getSkillsDirectory();
    let directoryCreated = false;

    try {
      // Create target directory if it doesn't exist
      const dirExists = await fs.exists(skillsDir);
      if (!dirExists) {
        await fs.mkdir(skillsDir, { recursive: true });
        directoryCreated = true;
      }

      // Format the skill for the target platform
      const platformSkill = adapter.formatSkill(skill);

      // Write the skill file(s)
      if (isDirectorySkill(platformSkill)) {
        // Directory-based skill (e.g., Codex)
        const skillDir = `${skillsDir}${platformSkill.directory}/`;
        const skillDirExists = await fs.exists(skillDir);
        if (!skillDirExists) {
          await fs.mkdir(skillDir, { recursive: true });
          if (!directoryCreated) {
            directoryCreated = true;
          }
        }
        
        for (const file of platformSkill.files) {
          await fs.writeFile(`${skillDir}${file.filename}`, file.content);
        }
        
        return {
          success: true,
          skillName,
          targetPath: skillDir,
          directoryCreated
        };
      } else {
        // Single file skill (e.g., Kiro, Claude Code, Antigravity)
        const targetPath = `${skillsDir}${platformSkill.filename}`;
        await fs.writeFile(targetPath, platformSkill.content);
        
        return {
          success: true,
          skillName,
          targetPath,
          directoryCreated
        };
      }
    } catch (error) {
      return {
        success: false,
        skillName,
        targetPath: skillsDir,
        directoryCreated,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
