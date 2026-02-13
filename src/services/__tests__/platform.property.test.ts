import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { PlatformId } from '../../types';

// Use a shared object so the hoisted vi.mock factory can reference it
const mocks = {
  getCommands: vi.fn<() => Promise<string[]>>().mockResolvedValue([]),
};

vi.mock('vscode', () => {
  return {
    workspace: {
      workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
      getConfiguration: vi.fn(() => ({
        get: vi.fn((_key: string, defaultVal: unknown) => defaultVal),
        update: vi.fn().mockResolvedValue(undefined),
      })),
    },
    commands: {
      getCommands: (...args: unknown[]) => mocks.getCommands(...args as []),
    },
    Uri: {
      joinPath: vi.fn((base: { fsPath: string }, ...parts: string[]) => ({
        fsPath: [base.fsPath, ...parts].join('/'),
      })),
    },
    ConfigurationTarget: { Workspace: 2 },
  };
});

// Mock the framework loader
const mockDetectCurrentPlatform = vi.fn();
const mockTransformWorkspace = vi.fn();

vi.mock('../../framework/loader', () => ({
  getInstances: vi.fn(async () => ({
    workspaceAdapter: {
      detectCurrentPlatform: mockDetectCurrentPlatform,
      transformWorkspace: mockTransformWorkspace,
    },
    fsBridge: {},
  })),
  isFrameworkAvailable: vi.fn(() => true),
}));

vi.mock('../../log', () => ({
  log: vi.fn(),
}));

import { PlatformService } from '../platform';

const platformArb: fc.Arbitrary<PlatformId> = fc.constantFrom(
  'kiro',
  'claude-code',
  'codex',
  'antigravity',
  'amazonq',
);

describe('Property Tests: PlatformService', () => {
  let service: PlatformService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PlatformService();
    // Default: no commands registered, framework detects nothing
    mocks.getCommands.mockResolvedValue([]);
    mockDetectCurrentPlatform.mockResolvedValue(null);
  });

  /**
   * Property 3: Platform detection caching consistency
   * After detectPlatform() completes, getCurrentPlatform() returns the primary platform.
   */
  it('Property 3: Platform detection caching consistency', async () => {
    await fc.assert(
      fc.asyncProperty(platformArb, async (platform) => {
        service = new PlatformService();
        // Simulate framework detecting this platform, no VS Code commands
        mocks.getCommands.mockResolvedValue([]);
        mockDetectCurrentPlatform.mockResolvedValue(platform);

        const detected = await service.detectPlatform();
        expect(detected).toBe(platform);
        expect(service.getCurrentPlatform()).toBe(platform);
      }),
      { numRuns: 50 },
    );
  });

  /**
   * Property: Amazon Q detected via command marker
   */
  it('detects amazonq when aws.amazonq.focusChat command is registered', async () => {
    mocks.getCommands.mockResolvedValue(['aws.amazonq.focusChat', 'some.other.command']);
    mockDetectCurrentPlatform.mockResolvedValue(null);

    const detected = await service.detectPlatform();
    expect(detected).toBe('amazonq');
    expect(service.getActivePlatforms()).toContain('amazonq');
  });

  /**
   * Property: Multiple platforms detected simultaneously
   */
  it('detects multiple platforms when multiple command markers are present', async () => {
    mocks.getCommands.mockResolvedValue([
      'aws.amazonq.focusChat',
      'workbench.action.chat.open',
    ]);
    mockDetectCurrentPlatform.mockResolvedValue('kiro');

    await service.detectPlatform();
    const active = service.getActivePlatforms();
    expect(active).toContain('amazonq');
    expect(active).toContain('claude-code');
    expect(active).toContain('kiro');
  });

  /**
   * Property 5: Successful platform switch updates cached platform
   */
  it('Property 5: successful platform switch updates cached platform', async () => {
    const platformPairArb = fc
      .tuple(platformArb, platformArb)
      .filter(([a, b]) => a !== b);

    await fc.assert(
      fc.asyncProperty(platformPairArb, async ([source, target]) => {
        service = new PlatformService();
        (service as any).primaryPlatform = source;

        mockTransformWorkspace.mockResolvedValue({
          success: true,
          sourceDir: '',
          targetDir: '',
          filesTransformed: 0,
          errors: [],
        });

        await service.switchPlatform(target);
        expect(service.getCurrentPlatform()).toBe(target);
      }),
      { numRuns: 50 },
    );
  });

  /**
   * Property 4: Failed workspace transformation preserves previous platform
   */
  it('Property 4: failed platform switch preserves previous platform', async () => {
    const platformPairArb = fc
      .tuple(platformArb, platformArb)
      .filter(([a, b]) => a !== b);
    const errorMsgArb = fc.stringOf(fc.char(), { minLength: 1, maxLength: 50 });

    await fc.assert(
      fc.asyncProperty(
        platformPairArb,
        fc.array(errorMsgArb, { minLength: 1, maxLength: 3 }),
        async ([source, target], errors) => {
          service = new PlatformService();
          (service as any).primaryPlatform = source;

          mockTransformWorkspace.mockResolvedValue({
            success: false,
            sourceDir: '',
            targetDir: '',
            filesTransformed: 0,
            errors,
          });

          let threw = false;
          try {
            await service.switchPlatform(target);
          } catch (e) {
            threw = true;
            const msg = (e as Error).message;
            expect(msg).toContain('Platform switch failed');
            expect(errors.some(err => msg.includes(err))).toBe(true);
          }

          expect(threw).toBe(true);
          expect(service.getCurrentPlatform()).toBe(source);
        },
      ),
      { numRuns: 50 },
    );
  });
});
