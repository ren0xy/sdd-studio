/**
 * Skill Transformer - Transforms canonical skills to platform-specific formats
 * 
 * Handles skill transformation between platforms and spec folder creation.
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 6.3, 6.5, 7.1, 7.6, 8.5
 */

import type { PlatformAdapter } from '../adapters/platform-adapter';
import type { SkillRegistry } from '../registry/skill-registry';
import type { PlatformId, PlatformSkill, SpecConfig } from '../types';
import { isDirectorySkill, isSingleFileSkill } from '../types';
import { SkillCLIGenerator } from './skill-cli-generator';

/**
 * Result of a spec folder creation operation
 */
export interface CreateSpecResult {
  success: boolean;
  path: string;
  error?: string;
}

/**
 * SkillTransformer transforms canonical skill definitions into platform-specific
 * formats and handles spec folder creation across platforms.
 */
export class SkillTransformer {
  private cliGenerator: SkillCLIGenerator;

  constructor(
    private registry: SkillRegistry,
    private adapters: Map<PlatformId, PlatformAdapter>,
    cliGenerator?: SkillCLIGenerator
  ) {
    this.cliGenerator = cliGenerator ?? new SkillCLIGenerator();
  }

  /**
   * Transform a skill for a specific target platform.
   * 
   * @param skillName - The name of the skill to transform
   * @param targetPlatform - The platform to transform the skill for
   * @returns The platform-specific skill output
   * @throws Error if skill not found or platform not supported
   * Requirements: 7.1, 7.6
   */
  transformForPlatform(skillName: string, targetPlatform: PlatformId): PlatformSkill {
    const skill = this.registry.get(skillName);
    if (!skill) {
      throw new Error(`Skill not found: ${skillName}`);
    }

    if (!skill.supportedPlatforms.includes(targetPlatform)) {
      throw new Error(
        `Skill '${skillName}' does not support platform '${targetPlatform}'. ` +
        `Supported platforms: ${skill.supportedPlatforms.join(', ')}`
      );
    }

    const adapter = this.adapters.get(targetPlatform);
    if (!adapter) {
      throw new Error(`No adapter found for platform: ${targetPlatform}`);
    }

    const platformSkill = adapter.formatSkill(skill);
    return this.injectCLIInstructions(platformSkill, skillName, targetPlatform);
  }

  /**
   * Generate platform-specific skill outputs for all supported platforms.
   * 
   * @param skillName - The name of the skill to transform
   * @returns Map of platform IDs to their platform-specific skill outputs
   * @throws Error if skill not found
   * Requirements: 7.1, 7.6
   */
  generateAllPlatformSkills(skillName: string): Map<PlatformId, PlatformSkill> {
    const skill = this.registry.get(skillName);
    if (!skill) {
      throw new Error(`Skill not found: ${skillName}`);
    }

    const results = new Map<PlatformId, PlatformSkill>();

    for (const platform of skill.supportedPlatforms) {
      const adapter = this.adapters.get(platform);
      if (adapter) {
        const platformSkill = adapter.formatSkill(skill);
        results.set(platform, this.injectCLIInstructions(platformSkill, skillName, platform));
      }
    }

    return results;
  }


  /**
   * Inject CLI invocation instructions into a platform skill's content.
   * Appends CLI instructions while preserving all existing content (Requirement 8.5).
   * 
   * @param platformSkill - The formatted platform skill
   * @param skillName - The canonical skill name
   * @param platform - The target platform
   * @returns The skill with CLI instructions appended
   * Requirements: 6.3, 6.5, 8.5
   */
  private injectCLIInstructions(
    platformSkill: PlatformSkill,
    skillName: string,
    platform: PlatformId
  ): PlatformSkill {
    const cliSection = this.cliGenerator.generateCLISection(skillName, platform);
    if (!cliSection) {
      return platformSkill;
    }

    if (isSingleFileSkill(platformSkill)) {
      return {
        filename: platformSkill.filename,
        content: platformSkill.content + cliSection,
      };
    }

    if (isDirectorySkill(platformSkill)) {
      // Append CLI instructions to the primary file (first file, typically SKILL.md)
      const files = platformSkill.files.map((file, index) => {
        if (index === 0) {
          return { ...file, content: file.content + cliSection };
        }
        return file;
      });
      return {
        directory: platformSkill.directory,
        files,
      };
    }

    return platformSkill;
  }

  /**
   * Get the spec folder path for a given feature name and platform.
   * 
   * @param featureName - The kebab-case feature name
   * @param platform - The target platform
   * @returns The full path to the spec folder
   * Requirements: 3.2, 3.3
   */
  getSpecPath(featureName: string, platform: PlatformId): string {
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      throw new Error(`No adapter found for platform: ${platform}`);
    }

    return `${adapter.specsPath}${featureName}/`;
  }

  /**
   * Create a spec folder at the platform-appropriate location.
   * 
   * @param featureName - The kebab-case feature name
   * @param platform - The target platform
   * @param fileSystem - File system operations interface
   * @returns Result of the creation operation
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
   */
  async createSpecFolder(
    featureName: string,
    platform: PlatformId,
    fileSystem: FileSystemOperations
  ): Promise<CreateSpecResult> {
    // Validate feature name is kebab-case
    if (!this.isValidFeatureName(featureName)) {
      return {
        success: false,
        path: '',
        error: `Invalid feature name '${featureName}'. Must be kebab-case (lowercase letters, numbers, and hyphens).`
      };
    }

    const adapter = this.adapters.get(platform);
    if (!adapter) {
      return {
        success: false,
        path: '',
        error: `No adapter found for platform: ${platform}`
      };
    }

    const specPath = `${adapter.specsPath}${featureName}/`;

    // Check if folder already exists (Requirement 3.5)
    if (await fileSystem.exists(specPath)) {
      return {
        success: false,
        path: specPath,
        error: `Spec folder already exists: ${specPath}`
      };
    }

    try {
      // Create the spec folder
      await fileSystem.mkdir(specPath);

      // Generate and write the config file (Requirement 3.4)
      const config = this.generateSpecConfig(platform);
      const configPath = `${specPath}.config.${platform === 'kiro' ? 'kiro' : 'json'}`;
      await fileSystem.writeFile(configPath, JSON.stringify(config, null, 2));

      return {
        success: true,
        path: specPath
      };
    } catch (err) {
      return {
        success: false,
        path: specPath,
        error: `Failed to create spec folder: ${err instanceof Error ? err.message : String(err)}`
      };
    }
  }

  /**
   * Validate that a feature name is valid kebab-case.
   * 
   * @param name - The feature name to validate
   * @returns True if valid kebab-case
   */
  private isValidFeatureName(name: string): boolean {
    // Must be non-empty, lowercase letters, numbers, and hyphens
    // Cannot start or end with hyphen, no consecutive hyphens
    return /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name);
  }

  /**
   * Generate a spec configuration for the target platform.
   * 
   * @param platform - The target platform
   * @returns The spec configuration object
   */
  private generateSpecConfig(platform: PlatformId): SpecConfig {
    return {
      generationMode: 'requirements-first',
      platform,
      createdAt: new Date().toISOString()
    };
  }
}

/**
 * Interface for file system operations.
 * Allows for dependency injection and testing.
 */
export interface FileSystemOperations {
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  writeFile(path: string, content: string): Promise<void>;
}
