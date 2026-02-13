import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type { PlatformId } from '../../types';

vi.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/workspace', path: '/workspace' } }],
    fs: {
      stat: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      readDirectory: vi.fn(),
      createDirectory: vi.fn(),
      copy: vi.fn(),
    },
  },
  Uri: {
    joinPath: vi.fn((base: { fsPath: string }, ...parts: string[]) => ({
      fsPath: [base.fsPath, ...parts].join('/'),
      path: [base.fsPath, ...parts].join('/'),
    })),
  },
  FileType: { File: 1, Directory: 2 },
}));

import { getInstances, resetInstances, _internal } from '../loader';

// Mock the _internal.loadFramework to avoid ESM dynamic import issues in vitest.
// The real loadFramework uses new Function('return import(...)') which
// doesn't work in vitest's VM context.
const mockFrameworkModule = {
  KiroAdapter: class { platformId = 'kiro'; skillsPath = '.kiro/skills/'; specsPath = '.kiro/specs/'; instructionsFile = null; getSkillsDirectory() { return this.skillsPath; } getSpecsDirectory() { return this.specsPath; } getUserSkillsDirectory() { return null; } formatSkill = vi.fn(); parseSkill = vi.fn(); generateInstructionsContent = vi.fn(); validateWorkspace() { return { valid: true, errors: [], warnings: [] }; } },
  ClaudeCodeAdapter: class { platformId = 'claude-code'; skillsPath = '.claude/skills/'; specsPath = '.kiro/specs/'; instructionsFile = 'CLAUDE.md'; getSkillsDirectory() { return this.skillsPath; } getSpecsDirectory() { return this.specsPath; } getUserSkillsDirectory() { return null; } formatSkill = vi.fn(); parseSkill = vi.fn(); generateInstructionsContent = vi.fn(); validateWorkspace() { return { valid: true, errors: [], warnings: [] }; } },
  CodexAdapter: class { platformId = 'codex'; skillsPath = '.codex/skills/'; specsPath = '.kiro/specs/'; instructionsFile = 'AGENTS.md'; getSkillsDirectory() { return this.skillsPath; } getSpecsDirectory() { return this.specsPath; } getUserSkillsDirectory() { return null; } formatSkill = vi.fn(); parseSkill = vi.fn(); generateInstructionsContent = vi.fn(); validateWorkspace() { return { valid: true, errors: [], warnings: [] }; } },
  AntigravityAdapter: class { platformId = 'antigravity'; skillsPath = '.antigravity/skills/'; specsPath = '.kiro/specs/'; instructionsFile = null; getSkillsDirectory() { return this.skillsPath; } getSpecsDirectory() { return this.specsPath; } getUserSkillsDirectory() { return null; } formatSkill = vi.fn(); parseSkill = vi.fn(); generateInstructionsContent = vi.fn(); validateWorkspace() { return { valid: true, errors: [], warnings: [] }; } },
  AmazonQAdapter: class { platformId = 'amazonq'; skillsPath = '.amazonq/rules/'; specsPath = '.kiro/specs/'; instructionsFile = null; getSkillsDirectory() { return this.skillsPath; } getSpecsDirectory() { return this.specsPath; } getUserSkillsDirectory() { return null; } formatSkill = vi.fn(); parseSkill = vi.fn(); generateInstructionsContent = vi.fn(); validateWorkspace() { return { valid: true, errors: [], warnings: [] }; } },
  SkillRegistry: class { skills = new Map(); register = vi.fn(); get = vi.fn(); getAll() { return []; } has() { return false; } },
  SkillTransformer: class { constructor(..._args: any[]) {} transform = vi.fn(); },
  WorkspaceAdapter: class { constructor(..._args: any[]) {} },
  TaskTracker: class { constructor() {} updateTaskStatus = vi.fn(); },
  CreateSpecCommand: class { constructor(..._args: any[]) {} execute = vi.fn(); },
  allSkills: [],
};

const allPlatforms: PlatformId[] = ['kiro', 'claude-code', 'codex', 'antigravity', 'amazonq'];
const platformArb: fc.Arbitrary<PlatformId> = fc.constantFrom(...allPlatforms);

describe('Property Tests: FrameworkLoader', () => {
  beforeEach(() => {
    resetInstances();
    _internal.loadFramework = vi.fn().mockResolvedValue(mockFrameworkModule);
  });

  /**
   * Property 9: Framework adapters provide paths for all platforms
   * For any PlatformId, the adapter map contains an entry with non-empty skillsPath and specsPath.
   *
   * **Validates: Requirements 8.4**
   */
  it('Property 9: Framework adapters provide paths for all platforms', async () => {
    await fc.assert(
      fc.asyncProperty(platformArb, async (platform) => {
        const workspaceRoot = { fsPath: '/workspace', path: '/workspace' } as any;
        const { adapters } = await getInstances(workspaceRoot);

        const adapter = adapters.get(platform);
        expect(adapter).toBeDefined();
        expect(typeof adapter!.skillsPath).toBe('string');
        expect(adapter!.skillsPath.length).toBeGreaterThan(0);
        expect(typeof adapter!.specsPath).toBe('string');
        expect(adapter!.specsPath.length).toBeGreaterThan(0);
      }),
      { numRuns: 20 },
    );
  });
});

describe('Unit Tests: getInstances adapter map', () => {
  beforeEach(() => {
    resetInstances();
    _internal.loadFramework = vi.fn().mockResolvedValue(mockFrameworkModule);
  });

  /**
   * Verify getInstances() returns exactly 5 adapters with 'amazonq' present.
   * _Requirements: 2.1, 2.3_
   */
  it('getInstances returns 5 adapters including amazonq', async () => {
    const workspaceRoot = { fsPath: '/workspace', path: '/workspace' } as any;
    const { adapters } = await getInstances(workspaceRoot);

    expect(adapters.size).toBe(5);
    expect(adapters.has('amazonq')).toBe(true);
  });

  /**
   * Verify the Amazon Q adapter has the expected paths.
   * _Requirements: 2.1, 2.2_
   */
  it('amazonq adapter has correct skillsPath and specsPath', async () => {
    const workspaceRoot = { fsPath: '/workspace', path: '/workspace' } as any;
    const { adapters } = await getInstances(workspaceRoot);

    const adapter = adapters.get('amazonq')!;
    expect(adapter.skillsPath).toContain('.amazonq/rules');
    expect(adapter.specsPath).toContain('.kiro/specs');
  });
});
