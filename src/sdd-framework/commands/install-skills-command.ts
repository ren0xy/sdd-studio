/**
 * InstallSkillsCommand - Deterministic skill installation
 * 
 * Installs framework skills to platform-specific directories,
 * transforming canonical skills to the correct format for each platform.
 * 
 * Requirements: 5.1, 5.2, 5.7, 5.8
 */

import type { PlatformId } from '../types';
import type { PlatformAdapter } from '../adapters/platform-adapter';
import type { SkillRegistry } from '../registry/skill-registry';
import { Validator } from '../validation/validator';
import { ErrorCode, successResult, errorResult, type CommandResult } from './command-result';
import { isDirectorySkill } from '../types';

/**
 * Options for installing skills
 */
export interface InstallSkillsOptions {
  platform: PlatformId;
  skills?: string[];
  force?: boolean;
  workspaceRoot?: string;
}

/**
 * Result data from skill installation
 */
export interface InstallSkillsResult {
  platform: PlatformId;
  installed: string[];
  skipped: string[];
  targetPath: string;
}

/**
 * File system operations interface for dependency injection
 */
export interface InstallSkillsFileSystem {
  exists(path: string): Promise<boolean>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  writeFile(path: string, content: string): Promise<void>;
}

/**
 * InstallSkillsCommand handles deterministic skill installation
 */
export class InstallSkillsCommand {
  private readonly commandName = 'install-skills';

  constructor(
    private registry: SkillRegistry,
    private adapters: Map<PlatformId, PlatformAdapter>,
    private fs: InstallSkillsFileSystem
  ) {}

  /**
   * Execute the install-skills command
   * @param options - Skill installation options
   * @returns CommandResult with installation details or error
   * Requirements: 5.1, 5.2, 5.7, 5.8
   */
  async execute(options: InstallSkillsOptions): Promise<CommandResult<InstallSkillsResult>> {
    const { platform, skills, force = false, workspaceRoot = process.cwd() } = options;

    // Validate platform (Requirements: 7.2)
    const platformValidation = Validator.validatePlatform(platform);
    if (!platformValidation.valid) {
      return errorResult(
        this.commandName,
        ErrorCode.INVALID_PLATFORM,
        platformValidation.errors[0]?.message || 'Invalid platform',
        { platform, validPlatforms: ['kiro', 'claude-code', 'codex', 'antigravity', 'amazonq'] }
      );
    }

    // Get the platform adapter
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      return errorResult(
        this.commandName,
        ErrorCode.INVALID_PLATFORM,
        `No adapter found for platform: ${platform}`,
        { platform }
      );
    }

    // Determine which skills to install (Requirements: 5.8)
    const allSkills = this.registry.listForPlatform(platform);
    let skillsToInstall: string[];

    if (skills && skills.length > 0) {
      // Validate that all requested skills exist
      const invalidSkills: string[] = [];
      for (const skillName of skills) {
        const skill = this.registry.get(skillName);
        if (!skill) {
          invalidSkills.push(skillName);
        } else if (!skill.supportedPlatforms.includes(platform)) {
          invalidSkills.push(`${skillName} (not supported on ${platform})`);
        }
      }

      if (invalidSkills.length > 0) {
        return errorResult(
          this.commandName,
          ErrorCode.SKILL_NOT_FOUND,
          `Skills not found or not supported: ${invalidSkills.join(', ')}`,
          { invalidSkills, platform }
        );
      }

      skillsToInstall = skills;
    } else {
      // Install all skills for the platform
      skillsToInstall = allSkills.map(s => s.name);
    }

    // Build target path
    const targetPath = `${workspaceRoot}/${adapter.getSkillsDirectory()}`;

    try {
      // Create skills directory if it doesn't exist
      if (!await this.fs.exists(targetPath)) {
        await this.fs.mkdir(targetPath, { recursive: true });
      }

      const installed: string[] = [];
      const skipped: string[] = [];

      // Install each skill (Requirements: 5.1, 5.2, 5.7)
      for (const skillName of skillsToInstall) {
        const skill = this.registry.get(skillName);
        if (!skill) {
          continue; // Already validated above
        }

        // Transform skill to platform format
        const platformSkill = adapter.formatSkill(skill);

        // Check if skill already exists (Requirements: 5.7)
        const skillPath = this.getSkillPath(targetPath, platformSkill);
        const exists = await this.fs.exists(skillPath);

        if (exists && !force) {
          skipped.push(skillName);
          continue;
        }

        // Write the skill file(s)
        await this.writeSkill(targetPath, platformSkill);
        installed.push(skillName);
      }

      return successResult(this.commandName, {
        platform,
        installed,
        skipped,
        targetPath,
      });
    } catch (err) {
      return errorResult(
        this.commandName,
        ErrorCode.WRITE_FAILED,
        `Failed to install skills: ${err instanceof Error ? err.message : String(err)}`,
        { platform, targetPath }
      );
    }
  }

  /**
   * Get the path to a skill file or directory
   * @param targetPath - Base skills directory path
   * @param platformSkill - The platform-specific skill
   * @returns Full path to the skill
   */
  private getSkillPath(targetPath: string, platformSkill: ReturnType<PlatformAdapter['formatSkill']>): string {
    if (isDirectorySkill(platformSkill)) {
      return `${targetPath}${platformSkill.directory}/`;
    } else {
      return `${targetPath}${platformSkill.filename}`;
    }
  }

  /**
   * Write a skill to the file system
   * @param targetPath - Base skills directory path
   * @param platformSkill - The platform-specific skill to write
   */
  private async writeSkill(
    targetPath: string,
    platformSkill: ReturnType<PlatformAdapter['formatSkill']>
  ): Promise<void> {
    if (isDirectorySkill(platformSkill)) {
      // Directory-based skill (e.g., Codex)
      const skillDir = `${targetPath}${platformSkill.directory}/`;
      
      if (!await this.fs.exists(skillDir)) {
        await this.fs.mkdir(skillDir, { recursive: true });
      }

      for (const file of platformSkill.files) {
        await this.fs.writeFile(`${skillDir}${file.filename}`, file.content);
      }
    } else {
      // Single file skill (e.g., Kiro, Claude Code, Antigravity)
      await this.fs.writeFile(`${targetPath}${platformSkill.filename}`, platformSkill.content);
    }
  }
}
