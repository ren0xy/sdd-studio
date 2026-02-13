import * as vscode from 'vscode';
import type { PlatformAdapter, CreateSpecFileSystem } from 'sdd-framework';
import type { PlatformId } from 'sdd-framework';
import { FileSystemBridge } from './fileSystemBridge';

// Lazy-loaded framework module reference
type FrameworkModule = typeof import('sdd-framework');
let frameworkModule: FrameworkModule | null = null;
let frameworkAvailable = false;

export interface FrameworkInstances {
  workspaceAdapter: InstanceType<FrameworkModule['WorkspaceAdapter']>;
  skillRegistry: InstanceType<FrameworkModule['SkillRegistry']>;
  skillTransformer: InstanceType<FrameworkModule['SkillTransformer']>;
  taskTracker: InstanceType<FrameworkModule['TaskTracker']>;
  createSpecCommand: InstanceType<FrameworkModule['CreateSpecCommand']>;
  /** TaskGroupResolver from spec 007 — undefined when framework version lacks it */
  taskGroupResolver?: unknown;
  adapters: Map<PlatformId, PlatformAdapter>;
  fsBridge: FileSystemBridge;
}

let instances: FrameworkInstances | null = null;

/**
 * Lazily load the ESM framework via dynamic import().
 * Caches the module after first successful load.
 *
 * Uses Function-based import to prevent TypeScript (module: "commonjs")
 * from downgrading the dynamic import() into require().
 */
export async function loadFramework(): Promise<FrameworkModule> {
  if (frameworkModule) { return frameworkModule; }
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const importDynamic = new Function('specifier', 'return import(specifier)');
  frameworkModule = await importDynamic('sdd-framework') as FrameworkModule;
  frameworkAvailable = true;
  return frameworkModule;
}

/** Indirection for testability — allows vitest to intercept loadFramework. */
export const _internal = { loadFramework };

/**
 * Get (or create) the singleton set of framework instances.
 * Instantiates all four platform adapters and registers all built-in skills.
 */
export async function getInstances(workspaceRoot: vscode.Uri): Promise<FrameworkInstances> {
  if (instances) { return instances; }

  const fw = await _internal.loadFramework();
  const fsBridge = new FileSystemBridge(workspaceRoot);

  // Instantiate all five platform adapters
  const adapters = new Map<PlatformId, PlatformAdapter>();
  adapters.set('kiro', new fw.KiroAdapter());
  adapters.set('claude-code', new fw.ClaudeCodeAdapter());
  adapters.set('codex', new fw.CodexAdapter());
  adapters.set('antigravity', new fw.AntigravityAdapter());
  adapters.set('amazonq', new fw.AmazonQAdapter());

  // Create and populate the skill registry
  const skillRegistry = new fw.SkillRegistry();
  fw.allSkills.forEach(skill => skillRegistry.register(skill));

  const skillTransformer = new fw.SkillTransformer(skillRegistry, adapters);
  const workspaceAdapter = new fw.WorkspaceAdapter(adapters);
  const taskTracker = new fw.TaskTracker();

  // Create a CreateSpecFileSystem that works with absolute paths via VS Code API
  const createSpecFs: CreateSpecFileSystem = {
    async exists(filePath: string): Promise<boolean> {
      try {
        await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
        return true;
      } catch {
        return false;
      }
    },
    async mkdir(filePath: string, _options?: { recursive?: boolean }): Promise<void> {
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(filePath));
    },
    async writeFile(filePath: string, content: string): Promise<void> {
      const data = new TextEncoder().encode(content);
      await vscode.workspace.fs.writeFile(vscode.Uri.file(filePath), data);
    }
  };
  const createSpecCommand = new fw.CreateSpecCommand(createSpecFs);

  // TaskGroupResolver (spec 007) — instantiate if the framework exports it
  let taskGroupResolver: unknown;
  try {
    const TGR = (fw as Record<string, unknown>)['TaskGroupResolver'] as (new () => unknown) | undefined;
    if (typeof TGR === 'function') {
      taskGroupResolver = new TGR();
    }
  } catch {
    // Framework version doesn't include TaskGroupResolver yet — graceful skip
  }

  instances = { workspaceAdapter, skillRegistry, skillTransformer, taskTracker, createSpecCommand, taskGroupResolver, adapters, fsBridge };
  return instances;
}

/** Whether the framework loaded successfully. */
export function isFrameworkAvailable(): boolean {
  return frameworkAvailable;
}

/** Reset singleton instances (for testing). */
export function resetInstances(): void {
  instances = null;
}
