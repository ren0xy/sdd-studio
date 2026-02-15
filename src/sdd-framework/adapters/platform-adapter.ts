/**
 * Platform Adapter Interface
 * 
 * Defines the contract for platform-specific operations.
 * Each platform adapter implements this interface to handle
 * platform-specific transformations and file operations.
 */

import type {
  PlatformId,
  CanonicalSkill,
  PlatformSkill,
  SpecMetadata,
  ValidationResult,
} from '../types';

/**
 * Platform adapter interface for handling platform-specific operations.
 * Each supported platform (Kiro, Claude Code, Codex, Antigravity) implements
 * this interface to provide platform-specific behavior.
 */
export interface PlatformAdapter {
  /** Unique identifier for this platform */
  readonly platformId: PlatformId;

  /** Path to the skills directory for this platform (relative to workspace root) */
  readonly skillsPath: string;

  /** Path to the specs directory for this platform (relative to workspace root) */
  readonly specsPath: string;

  /** 
   * Path to the instructions file for this platform, or null if the platform
   * uses a different mechanism (e.g., Kiro uses steering files)
   */
  readonly instructionsFile: string | null;

  /**
   * Get the full path to the skills directory
   */
  getSkillsDirectory(): string;

  /**
   * Get the full path to the specs directory
   */
  getSpecsDirectory(): string;

  /**
   * Get the path to user-level skills directory, or null if not supported
   */
  getUserSkillsDirectory(): string | null;

  /**
   * Transform a canonical skill definition into the platform-specific format
   * @param skill The canonical skill definition
   * @returns The platform-specific skill output
   */
  formatSkill(skill: CanonicalSkill): PlatformSkill;

  /**
   * Parse a platform-specific skill file back into a canonical skill definition
   * @param content The raw content of the skill file
   * @returns The parsed canonical skill
   */
  parseSkill(content: string): CanonicalSkill;

  /**
   * Generate the content for the platform's instructions file
   * @param specs Array of spec metadata to reference in the instructions
   * @returns The generated instructions file content
   */
  generateInstructionsContent(specs: SpecMetadata[]): string;

  /**
   * Validate that the workspace is properly configured for this platform
   * @returns Validation result with any errors or warnings
   */
  validateWorkspace(): ValidationResult;
}
