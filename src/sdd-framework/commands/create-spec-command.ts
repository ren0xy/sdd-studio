/**
 * CreateSpecCommand - Deterministic spec folder creation
 * 
 * Creates spec folders with template files, ensuring consistent
 * structure regardless of which AI agent executes the command.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.6, 2.7
 */

import * as path from 'path';
import type { PlatformId, SpecConfig } from '../types';
import { Validator } from '../validation/validator';
import { ErrorCode, successResult, errorResult, type CommandResult } from './command-result';

/**
 * Template for requirements.md
 * Requirements: 2.2
 */
export const REQUIREMENTS_TEMPLATE = '';

/**
 * Template for design.md
 * Requirements: 2.2
 */
export const DESIGN_TEMPLATE = '';

/**
 * Template for tasks.md
 * Requirements: 2.2
 */
export const TASKS_TEMPLATE = '';

/**
 * Options for creating a spec
 */
export interface CreateSpecOptions {
  name: string;
  platform?: PlatformId;
  mode?: 'requirements-first' | 'design-first';
  workspaceRoot?: string;
}

/**
 * Result data from spec creation
 */
export interface CreateSpecResult {
  path: string;
  files: string[];
  config: SpecConfig;
}

/**
 * File system operations interface for dependency injection
 */
export interface CreateSpecFileSystem {
  exists(path: string): Promise<boolean>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  writeFile(path: string, content: string): Promise<void>;
}

/**
 * CreateSpecCommand handles deterministic spec folder creation
 */
export class CreateSpecCommand {
  private readonly commandName = 'create-spec';

  constructor(private fs: CreateSpecFileSystem) {}

  /**
   * Execute the create-spec command
   * @param options - Spec creation options
   * @returns CommandResult with creation details or error
   * Requirements: 2.1, 2.2, 2.3, 2.6, 2.7
   */
  async execute(options: CreateSpecOptions): Promise<CommandResult<CreateSpecResult>> {
    const { name, platform, mode = 'requirements-first', workspaceRoot = process.cwd() } = options;

    // Validate spec name (Requirements: 2.4, 7.1)
    const nameValidation = Validator.validateSpecName(name);
    if (!nameValidation.valid) {
      return errorResult(
        this.commandName,
        ErrorCode.INVALID_SPEC_NAME,
        nameValidation.errors[0]?.message || 'Invalid spec name',
        { name, expectedFormat: 'kebab-case (e.g., my-feature, user-auth-v2)' }
      );
    }

    // Validate platform if provided (Requirements: 2.7, 7.2)
    if (platform !== undefined) {
      const platformValidation = Validator.validatePlatform(platform);
      if (!platformValidation.valid) {
        return errorResult(
          this.commandName,
          ErrorCode.INVALID_PLATFORM,
          platformValidation.errors[0]?.message || 'Invalid platform',
          { platform, validPlatforms: ['kiro', 'claude-code', 'codex', 'antigravity'] }
        );
      }
    }

    // Validate mode
    if (mode !== 'requirements-first' && mode !== 'design-first') {
      return errorResult(
        this.commandName,
        ErrorCode.MISSING_ARGUMENT,
        `Invalid generation mode: "${mode}". Expected "requirements-first" or "design-first"`,
        { mode, validModes: ['requirements-first', 'design-first'] }
      );
    }

    // Build spec path (Requirements: 2.1)
    const specPath = path.join(workspaceRoot, '.kiro', 'specs', name);

    // Check if spec already exists (Requirements: 2.5)
    if (await this.fs.exists(specPath)) {
      return errorResult(
        this.commandName,
        ErrorCode.SPEC_EXISTS,
        `Spec "${name}" already exists at ${specPath}`,
        { name, path: specPath }
      );
    }

    // Create spec folder structure (Requirements: 2.1, 2.2, 2.3)
    try {
      // Create the spec directory (and parent directories if needed)
      await this.fs.mkdir(specPath, { recursive: true });

      // Build config object (Requirements: 2.3, 2.6)
      const config: SpecConfig = {
        generationMode: mode,
        ...(platform && { platform }),
        createdAt: new Date().toISOString(),
      };

      // Define files to create
      const files: string[] = [];

      // Create .config.kiro (Requirements: 2.3)
      const configPath = path.join(specPath, '.config.kiro');
      await this.fs.writeFile(configPath, JSON.stringify(config, null, 2));
      files.push('.config.kiro');

      // Create requirements.md (Requirements: 2.2)
      const requirementsPath = path.join(specPath, 'requirements.md');
      await this.fs.writeFile(requirementsPath, REQUIREMENTS_TEMPLATE);
      files.push('requirements.md');

      // Create design.md (Requirements: 2.2)
      const designPath = path.join(specPath, 'design.md');
      await this.fs.writeFile(designPath, DESIGN_TEMPLATE);
      files.push('design.md');

      // Create tasks.md (Requirements: 2.2)
      const tasksPath = path.join(specPath, 'tasks.md');
      await this.fs.writeFile(tasksPath, TASKS_TEMPLATE);
      files.push('tasks.md');

      return successResult(this.commandName, {
        path: specPath,
        files,
        config,
      });
    } catch (err) {
      return errorResult(
        this.commandName,
        ErrorCode.WRITE_FAILED,
        `Failed to create spec folder: ${err instanceof Error ? err.message : String(err)}`,
        { name, path: specPath }
      );
    }
  }
}
