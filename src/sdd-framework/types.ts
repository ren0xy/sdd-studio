/**
 * Core type definitions for the Context Engineering Framework
 */

// Platform identifiers for supported AI coding agent platforms
export type PlatformId = 'kiro' | 'claude-code' | 'codex' | 'antigravity' | 'amazonq';

// Task status indicators matching checkbox syntax
export type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'failed' | 'queued';

/**
 * Parameter definition for a skill
 */
export interface SkillParameter {
  name: string;
  type: 'string' | 'boolean' | 'number';
  required: boolean;
  description: string;
}

/**
 * Metadata for a skill (without implementation details)
 */
export interface SkillMetadata {
  name: string;
  title: string;
  description: string;
  version: string;
  supportedPlatforms: PlatformId[];
}

/**
 * Canonical skill definition - the source of truth for skill behavior
 */
export interface CanonicalSkill extends SkillMetadata {
  instructions: string;
  parameters: SkillParameter[];
  platformOverrides?: {
    [K in PlatformId]?: Partial<{
      instructions: string;
      additionalContent: string;
    }>;
  };
}


/**
 * Single file skill output (Kiro, Claude Code)
 */
export interface SingleFileSkill {
  filename: string;
  content: string;
}

/**
 * Directory-based skill output (Codex, Antigravity)
 */
export interface DirectorySkill {
  directory: string;
  files: Array<{
    filename: string;
    content: string;
  }>;
}

/**
 * Platform-specific skill output - either single file or directory
 */
export type PlatformSkill = SingleFileSkill | DirectorySkill;

/**
 * Type guard to check if a skill is directory-based
 */
export function isDirectorySkill(skill: PlatformSkill): skill is DirectorySkill {
  return 'directory' in skill;
}

/**
 * Type guard to check if a skill is single-file
 */
export function isSingleFileSkill(skill: PlatformSkill): skill is SingleFileSkill {
  return 'filename' in skill && !('directory' in skill);
}

/**
 * Spec configuration options
 */
export interface SpecConfig {
  generationMode: 'requirements-first' | 'design-first';
  [key: string]: unknown;
}

/**
 * A document within a spec (requirements.md, design.md)
 */
export interface SpecDocument {
  path: string;
  content: string;
  lastModified: Date;
}

/**
 * A task item from tasks.md
 */
export interface Task {
  id: string;
  text: string;
  status: TaskStatus;
  subtasks: Task[];
  requirements?: string[];
}

/**
 * Tasks document with parsed task items
 */
export interface TasksDocument extends SpecDocument {
  tasks: Task[];
}

/**
 * Complete spec structure
 */
export interface Spec {
  name: string;
  path: string;
  platform: PlatformId;
  requirements?: SpecDocument;
  design?: SpecDocument;
  tasks?: TasksDocument;
  config: SpecConfig;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Spec metadata for listing and referencing
 */
export interface SpecMetadata {
  name: string;
  description: string;
  path: string;
}

/**
 * Location where a spec was found
 */
export interface SpecLocation {
  path: string;
  name: string;
}

/**
 * Validation error details
 */
export interface ValidationError {
  code: string;
  message: string;
  path?: string;
}

/**
 * Validation warning details
 */
export interface ValidationWarning {
  code: string;
  message: string;
  suggestion?: string;
}

/**
 * Result of a validation operation
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Result of a task status update
 */
export interface TaskUpdate {
  taskId: string;
  oldStatus: TaskStatus;
  newStatus: TaskStatus;
  timestamp: Date;
  error?: string;
}

/**
 * Result of a workspace transformation
 */
export interface TransformResult {
  success: boolean;
  sourceDir: string;
  targetDir: string;
  filesTransformed: number;
  errors: string[];
}

/**
 * Result of a skill installation operation
 */
export interface SkillInstallResult {
  success: boolean;
  skillName: string;
  targetPath: string;
  directoryCreated: boolean;
  error?: string;
}
