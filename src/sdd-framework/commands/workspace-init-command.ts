/**
 * WorkspaceInitCommand - Deterministic workspace initialization
 * 
 * Initializes workspaces for specific platforms, creating the necessary
 * directory structure and instruction files.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import * as path from 'path';
import type { PlatformId, SpecMetadata } from '../types';
import type { PlatformAdapter } from '../adapters/platform-adapter';
import { Validator } from '../validation/validator';
import { ErrorCode, successResult, errorResult, type CommandResult } from './command-result';

/**
 * Options for workspace initialization
 */
export interface WorkspaceInitOptions {
  platform: PlatformId;
  force?: boolean;
  workspaceRoot?: string;
}

/**
 * Result data from workspace initialization
 */
export interface WorkspaceInitResult {
  platform: PlatformId;
  specsDir: string;
  instructionsFile?: string;
  specsFound: number;
}

/**
 * File system operations interface for dependency injection
 */
export interface WorkspaceInitFileSystem {
  exists(path: string): Promise<boolean>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  writeFile(path: string, content: string): Promise<void>;
  readFile(path: string): Promise<string>;
  readdir(path: string): Promise<string[]>;
  isDirectory(path: string): Promise<boolean>;
}

/**
 * WorkspaceInitCommand handles deterministic workspace initialization
 */
export class WorkspaceInitCommand {
  private readonly commandName = 'workspace-init';

  constructor(
    private fs: WorkspaceInitFileSystem,
    private adapters: Map<PlatformId, PlatformAdapter>
  ) {}

  /**
   * Execute the workspace-init command
   * @param options - Workspace initialization options
   * @returns CommandResult with initialization details or error
   * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
   */
  async execute(options: WorkspaceInitOptions): Promise<CommandResult<WorkspaceInitResult>> {
    const { platform, workspaceRoot = process.cwd() } = options;

    // Validate platform (Requirements: 7.2)
    const platformValidation = Validator.validatePlatform(platform);
    if (!platformValidation.valid) {
      return errorResult(
        this.commandName,
        ErrorCode.INVALID_PLATFORM,
        platformValidation.errors[0]?.message || 'Invalid platform',
        { platform, validPlatforms: ['kiro', 'claude-code', 'codex', 'antigravity'] }
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

    try {
      // Create .kiro/specs/ directory if it doesn't exist (Requirements: 4.2)
      const specsDir = path.join(workspaceRoot, '.kiro', 'specs');
      if (!await this.fs.exists(specsDir)) {
        await this.fs.mkdir(specsDir, { recursive: true });
      }

      // Find existing specs to include in instructions file
      const specs = await this.findSpecs(specsDir);

      // Create platform-specific instruction file (Requirements: 4.3, 4.4, 4.5)
      let instructionsFile: string | undefined;
      
      if (adapter.instructionsFile) {
        instructionsFile = path.join(workspaceRoot, adapter.instructionsFile);
        
        // Ensure parent directory exists for nested paths like .agent/rules/specs.md
        const instructionsDir = path.dirname(instructionsFile);
        if (!await this.fs.exists(instructionsDir)) {
          await this.fs.mkdir(instructionsDir, { recursive: true });
        }

        // Generate and write instructions content
        const instructionsContent = adapter.generateInstructionsContent(specs);
        await this.fs.writeFile(instructionsFile, instructionsContent);
      }

      return successResult(this.commandName, {
        platform,
        specsDir,
        instructionsFile,
        specsFound: specs.length,
      });
    } catch (err) {
      return errorResult(
        this.commandName,
        ErrorCode.WRITE_FAILED,
        `Failed to initialize workspace: ${err instanceof Error ? err.message : String(err)}`,
        { platform }
      );
    }
  }

  /**
   * Find all specs in the specs directory
   * @param specsDir - Path to the specs directory
   * @returns Array of spec metadata
   */
  private async findSpecs(specsDir: string): Promise<SpecMetadata[]> {
    const specs: SpecMetadata[] = [];

    if (!await this.fs.exists(specsDir)) {
      return specs;
    }

    try {
      const entries = await this.fs.readdir(specsDir);

      for (const entry of entries) {
        const fullPath = path.join(specsDir, entry);
        
        // Only include directories (specs are folders)
        if (await this.fs.isDirectory(fullPath)) {
          const metadata = await this.readSpecMetadata(fullPath, entry);
          specs.push(metadata);
        }
      }
    } catch {
      // Directory exists but couldn't be read - return empty array
    }

    return specs;
  }

  /**
   * Read spec metadata from a spec folder
   * @param specPath - Full path to the spec folder
   * @param specName - Name of the spec
   * @returns Spec metadata
   */
  private async readSpecMetadata(specPath: string, specName: string): Promise<SpecMetadata> {
    const requirementsPath = path.join(specPath, 'requirements.md');
    let description = '';

    try {
      if (await this.fs.exists(requirementsPath)) {
        const content = await this.fs.readFile(requirementsPath);
        // Extract description from the Introduction section
        const introMatch = content.match(/## Introduction\s*\n\n([\s\S]*?)(?=\n##|$)/);
        if (introMatch) {
          // Take first sentence or first 100 chars
          const intro = introMatch[1].trim();
          const firstSentence = intro.match(/^[^.!?]*[.!?]/);
          description = firstSentence ? firstSentence[0] : intro.slice(0, 100);
        }
      }
    } catch {
      // Couldn't read requirements - use empty description
    }

    return {
      name: specName,
      description: description || `Spec: ${specName}`,
      path: specPath,
    };
  }
}
