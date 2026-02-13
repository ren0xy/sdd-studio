// --- Re-exports from sdd-framework ---
import type { PlatformId as _PlatformId, TaskStatus } from 'sdd-framework';
export type PlatformId = _PlatformId;
export type TaskStatusValue = TaskStatus;

// --- Spec Data Models ---

export interface SpecSummary {
  name: string;
  description: string;
  status: SpecStatus;
}

export interface SpecStatus {
  requirementsDone: boolean;
  designDone: boolean;
  tasksTotal: number;
  tasksCompleted: number;
}

export interface SpecConfig {
  generationMode: 'requirements-first' | 'design-first';
}

// --- Task Data Models ---

export interface TaskNode {
  id: string;
  title: string;
  status: TaskStatusValue;
  children: TaskNode[];
  isOptional: boolean;
}

export const STATUS_MAP: Record<string, TaskStatusValue> = {
  '[ ]': 'not_started',
  '[-]': 'in_progress',
  '[x]': 'completed',
  '[!]': 'failed',
};

// --- Steering Document Data Model ---

export interface SteeringDoc {
  name: string;
  path: string;
  platform: PlatformId;
}

// --- Skill Data Model ---

export interface SkillInfo {
  name: string;
  description: string;
  supportedPlatforms: PlatformId[];
  installed: boolean;
}

// --- Platform Display Configuration ---
// Extension-specific platform metadata not provided by the framework.
// Path-related fields (skillsPath, specsPath) should be obtained from
// framework adapters via FrameworkLoader in production code.

export interface PlatformDisplayConfig {
  id: PlatformId;
  displayName: string;
  steeringPath: string;
  steeringIsDirectory: boolean;
  skillsPath: string;
}

export const PLATFORM_CONFIGS: Record<PlatformId, PlatformDisplayConfig> = {
  kiro: {
    id: 'kiro',
    displayName: 'Kiro',
    steeringPath: '.kiro/steering/',
    steeringIsDirectory: true,
    skillsPath: '.kiro/skills/',
  },
  'claude-code': {
    id: 'claude-code',
    displayName: 'Claude Code',
    steeringPath: 'CLAUDE.md',
    steeringIsDirectory: false,
    skillsPath: '.claude/skills/',
  },
  codex: {
    id: 'codex',
    displayName: 'Codex',
    steeringPath: 'AGENTS.md',
    steeringIsDirectory: false,
    skillsPath: '.codex/skills/',
  },
  antigravity: {
    id: 'antigravity',
    displayName: 'Antigravity',
    steeringPath: '.agent/rules/specs.md',
    steeringIsDirectory: false,
    skillsPath: '.agent/skills/',
  },
  amazonq: {
    id: 'amazonq',
    displayName: 'Amazon Q',
    steeringPath: '.amazonq/rules/',
    steeringIsDirectory: true,
    skillsPath: '.amazonq/rules/',
  },
};

// --- Message Protocol ---

export interface WebviewCommand {
  type: 'command';
  command: string;
  payload?: unknown;
}

export interface StateMessage {
  type: 'state';
  data: Partial<ExtensionState>;
}

export interface EventMessage {
  type: 'event';
  data: {
    event: string;
    [key: string]: unknown;
  };
}

export type ExtensionMessage = StateMessage | EventMessage;

// --- Extension State ---

export interface ExtensionState {
  specs: SpecSummary[];
  platform: PlatformId | null;
  steeringDocs: SteeringDoc[];
  installedSkills: SkillInfo[];
  availableSkills: SkillInfo[];
  settings: Record<string, unknown>;
}
