/**
 * SDD Framework (Spec-Driven Development)
 * 
 * A portable abstraction layer that enables project initialization and
 * workspace management across multiple AI coding agent platforms
 * (Kiro, Claude Code, Codex, Antigravity, Amazon Q).
 * 
 * @packageDocumentation
 */

// Core types
export type {
  PlatformId,
  TaskStatus,
  SkillParameter,
  SkillMetadata,
  CanonicalSkill,
  SingleFileSkill,
  DirectorySkill,
  PlatformSkill,
  SpecConfig,
  SpecDocument,
  Task,
  TasksDocument,
  Spec,
  SpecMetadata,
  SpecLocation,
  ValidationError,
  ValidationWarning,
  ValidationResult,
  TaskUpdate,
  TransformResult,
  SkillInstallResult
} from './types';

// Type guards
export { isDirectorySkill, isSingleFileSkill } from './types';

// Platform Adapters
export type { PlatformAdapter } from './adapters/index';
export {
  KiroAdapter,
  ClaudeCodeAdapter,
  CodexAdapter,
  AntigravityAdapter,
  AmazonQAdapter
} from './adapters/index';

// Skill Registry
export { SkillRegistry } from './registry/index';
export type { FileSystem } from './registry/index';

// Skill Transformer
export { SkillTransformer } from './transformer/index';
export type { CreateSpecResult, FileSystemOperations } from './transformer/index';

// Workspace Adapter
export { WorkspaceAdapter, validateSpecConfig, validateSpecFolder, validateAllSpecs } from './workspace/index';
export type { WorkspaceFileSystem, SpecConfigSchema, SpecFolderSchema, ValidationFileSystem } from './workspace/index';

// Task Tracker
export { TaskTracker } from './tasks/index';
export { TaskGroupResolver } from './tasks/index';
export type { TaskGroup, TaskSubgroup, ParsedTask, TaskGroupStatus, RequirementsValidation } from './tasks/index';

// Document Generators
export { TasksGenerator } from './documents/index';
export type { TaskInput, TasksGeneratorOptions } from './documents/index';

// Canonical Skills
export {
  workspaceInitSkill,
  createSpecSkill,
  runTaskSkill,
  installSkillsSkill,
  refineSpecSkill,
  startTaskGroupSkill,
  allSkills,
  getSkillByName
} from './skills/index';

// Instruction Composer
export {
  composeSkillInstruction,
  registerInstructionTemplate,
  getInstructionTemplates
} from './instructions/index';
export type { InstructionTemplate } from './instructions/index';

// Commands (for extension consumption)
export { CreateSpecCommand } from './commands/create-spec-command';
export type { CreateSpecFileSystem, CreateSpecOptions } from './commands/create-spec-command';
export type { CreateSpecResult as CreateSpecCommandResult } from './commands/create-spec-command';

export { StartGroupCommand } from './commands/start-group-command';
export type { StartGroupOptions, StartGroupResult } from './commands/start-group-command';

