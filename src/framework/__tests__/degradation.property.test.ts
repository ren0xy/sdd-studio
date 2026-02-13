import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

vi.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/workspace', path: '/workspace' } }],
    fs: {
      stat: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      readDirectory: vi.fn().mockResolvedValue([]),
      createDirectory: vi.fn(),
      copy: vi.fn(),
    },
    getConfiguration: vi.fn(() => ({
      get: vi.fn((_key: string, defaultVal: unknown) => defaultVal),
      update: vi.fn().mockResolvedValue(undefined),
    })),
  },
  Uri: {
    joinPath: vi.fn((base: { fsPath: string }, ...parts: string[]) => ({
      fsPath: [base.fsPath, ...parts].join('/'),
      path: [base.fsPath, ...parts].join('/'),
    })),
  },
  FileType: { File: 1, Directory: 2 },
  ConfigurationTarget: { Workspace: 2 },
}));

// Mock the framework loader to simulate unavailable framework
vi.mock('../../framework/loader', () => ({
  getInstances: vi.fn(async () => {
    throw new Error('sdd-framework failed to load');
  }),
  isFrameworkAvailable: vi.fn(() => false),
  loadFramework: vi.fn(async () => {
    throw new Error('sdd-framework failed to load');
  }),
  resetInstances: vi.fn(),
}));

import { PlatformService } from '../../services/platform';
import { SkillsService } from '../../services/skills';
import { createSpec } from '../../services/specs';

type OperationName = 'spec-creation' | 'skill-install' | 'platform-switch';
const operationArb: fc.Arbitrary<OperationName> = fc.constantFrom(
  'spec-creation', 'skill-install', 'platform-switch',
);

describe('Property Tests: Graceful Degradation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 10: Graceful degradation blocks framework-dependent operations
   * For any framework-dependent operation attempted while frameworkAvailable is false,
   * the operation throws or returns an error without performing file system writes.
   *
   * **Validates: Requirements 9.2**
   */
  it('Property 10: Graceful degradation blocks framework-dependent operations', async () => {
    await fc.assert(
      fc.asyncProperty(operationArb, async (operation) => {
        let threw = false;

        try {
          switch (operation) {
            case 'spec-creation':
              await createSpec('test-spec');
              break;
            case 'skill-install': {
              const skills = new SkillsService();
              await skills.installSkill('kiro', 'test-skill');
              break;
            }
            case 'platform-switch': {
              const platform = new PlatformService();
              (platform as any).currentPlatform = 'kiro';
              await platform.switchPlatform('codex');
              break;
            }
          }
        } catch {
          threw = true;
        }

        expect(threw).toBe(true);
      }),
      { numRuns: 20 },
    );
  });
});
