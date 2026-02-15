/**
 * Workspace Adapter - Handles cross-platform workspace operations
 * 
 * Provides functionality for detecting the current platform, finding specs
 * across all known locations, and transforming workspaces between platforms.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 9.1, 9.2, 9.3
 */

import type { PlatformAdapter } from '../adapters/platform-adapter';
import type { PlatformId, SpecMetadata, SpecLocation, TransformResult } from '../types';

/**
 * File system operations interface for dependency injection and testing.
 */
export interface WorkspaceFileSystem {
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  readdir(path: string): Promise<string[]>;
  copyDirectory(source: string, target: string): Promise<void>;
  isDirectory(path: string): Promise<boolean>;
}

/**
 * Known spec locations to search across all platforms.
 * Requirements: 9.2
 */
const KNOWN_SPEC_LOCATIONS = [
  '.kiro/specs/',
];

/**
 * WorkspaceAdapter handles platform detection, spec discovery, and
 * workspace transformation between different AI coding agent platforms.
 */
export class WorkspaceAdapter {
  constructor(private adapters: Map<PlatformId, PlatformAdapter>) {}

  /**
   * Detect the current platform based on workspace markers.
   * Checks for platform-specific directories and files in order of specificity.
   * 
   * @param fs - File system operations interface
   * @returns The detected platform ID, or null if no platform detected
   * Requirements: 9.1
   */
  async detectCurrentPlatform(fs: WorkspaceFileSystem): Promise<PlatformId | null> {
    // Check for platform-specific markers in order of specificity
    // Kiro has the most specific marker (.kiro/)
    if (await fs.exists('.kiro/')) {
      return 'kiro';
    }

    // Claude Code markers
    if (await fs.exists('.claude/') || await fs.exists('CLAUDE.md')) {
      return 'claude-code';
    }

    // Codex markers
    if (await fs.exists('.codex/') || await fs.exists('AGENTS.md')) {
      return 'codex';
    }

    // Antigravity markers
    if (await fs.exists('.agent/')) {
      return 'antigravity';
    }

    // Amazon Q markers
    if (await fs.exists('.amazonq/')) {
      return 'amazonq';
    }

    return null;
  }


  /**
   * Find all specs across all known spec locations.
   * Searches .kiro/specs/, .specs/, and .agent/workflows/ directories.
   * 
   * @param fs - File system operations interface
   * @returns Array of spec locations found
   * Requirements: 9.1, 9.2, 9.3
   */
  async findSpecs(fs: WorkspaceFileSystem): Promise<SpecLocation[]> {
    const locations: SpecLocation[] = [];

    for (const searchPath of KNOWN_SPEC_LOCATIONS) {
      if (await fs.exists(searchPath)) {
        try {
          const entries = await fs.readdir(searchPath);
          
          for (const entry of entries) {
            const fullPath = `${searchPath}${entry}`;
            // Only include directories (specs are folders)
            if (await fs.isDirectory(fullPath)) {
              locations.push({
                path: searchPath,
                name: entry,
              });
            }
          }
        } catch {
          // Directory exists but couldn't be read - skip it
          continue;
        }
      }
    }

    return locations;
  }

  /**
   * Read spec metadata from a spec folder.
   * Extracts name and description from requirements.md if available.
   * 
   * @param specPath - Full path to the spec folder
   * @param specName - Name of the spec
   * @param fs - File system operations interface
   * @returns Spec metadata
   */
  private async readSpecMetadata(
    specPath: string,
    specName: string,
    fs: WorkspaceFileSystem
  ): Promise<SpecMetadata> {
    const requirementsPath = `${specPath}requirements.md`;
    let description = '';

    try {
      if (await fs.exists(requirementsPath)) {
        const content = await fs.readFile(requirementsPath);
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

  /**
   * Transform workspace from source platform to target platform.
   * Copies specs to the target location and generates instructions file.
   * 
   * @param sourcePlatform - The source platform
   * @param targetPlatform - The target platform
   * @param fs - File system operations interface
   * @returns Result of the transformation
   * Requirements: 1.1, 1.2, 1.3, 1.4
   */
  async transformWorkspace(
    sourcePlatform: PlatformId,
    targetPlatform: PlatformId,
    fs: WorkspaceFileSystem
  ): Promise<TransformResult> {
    const sourceAdapter = this.adapters.get(sourcePlatform);
    const targetAdapter = this.adapters.get(targetPlatform);

    if (!sourceAdapter) {
      return {
        success: false,
        sourceDir: '',
        targetDir: '',
        filesTransformed: 0,
        errors: [`No adapter found for source platform: ${sourcePlatform}`],
      };
    }

    if (!targetAdapter) {
      return {
        success: false,
        sourceDir: '',
        targetDir: '',
        filesTransformed: 0,
        errors: [`No adapter found for target platform: ${targetPlatform}`],
      };
    }

    const sourceDir = sourceAdapter.specsPath;
    const targetDir = targetAdapter.specsPath;
    const errors: string[] = [];
    let filesTransformed = 0;

    // Check if source directory exists
    if (!await fs.exists(sourceDir)) {
      return {
        success: false,
        sourceDir,
        targetDir,
        filesTransformed: 0,
        errors: [`Source directory not found: ${sourceDir}`],
      };
    }

    try {
      // Create target directory if it doesn't exist
      if (!await fs.exists(targetDir)) {
        await fs.mkdir(targetDir);
      }

      // Get list of specs from source
      const specEntries = await fs.readdir(sourceDir);
      const specs: SpecMetadata[] = [];

      // Copy each spec folder to target location (Requirement 1.4 - preserve content)
      for (const specName of specEntries) {
        const sourcePath = `${sourceDir}${specName}`;
        
        // Skip non-directories
        if (!await fs.isDirectory(sourcePath)) {
          continue;
        }

        const targetPath = `${targetDir}${specName}`;

        try {
          // Copy the entire spec folder
          await fs.copyDirectory(sourcePath, targetPath);
          filesTransformed++;

          // Read spec metadata for instructions file
          const metadata = await this.readSpecMetadata(`${targetPath}/`, specName, fs);
          specs.push(metadata);
        } catch (err) {
          errors.push(`Failed to copy spec '${specName}': ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Generate instructions file for target platform (Requirements 1.1, 1.2, 1.3)
      if (targetAdapter.instructionsFile) {
        try {
          const instructionsContent = targetAdapter.generateInstructionsContent(specs);
          await fs.writeFile(targetAdapter.instructionsFile, instructionsContent);
        } catch (err) {
          errors.push(`Failed to generate instructions file: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      return {
        success: errors.length === 0,
        sourceDir,
        targetDir,
        filesTransformed,
        errors,
      };
    } catch (err) {
      return {
        success: false,
        sourceDir,
        targetDir,
        filesTransformed,
        errors: [`Transformation failed: ${err instanceof Error ? err.message : String(err)}`],
      };
    }
  }

  /**
   * Get all specs with their metadata from all known locations.
   * 
   * @param fs - File system operations interface
   * @returns Array of spec metadata
   */
  async getAllSpecsMetadata(fs: WorkspaceFileSystem): Promise<SpecMetadata[]> {
    const locations = await this.findSpecs(fs);
    const specs: SpecMetadata[] = [];

    for (const location of locations) {
      const fullPath = `${location.path}${location.name}/`;
      const metadata = await this.readSpecMetadata(fullPath, location.name, fs);
      specs.push(metadata);
    }

    return specs;
  }
}
