import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlatformStatusBar } from '../statusBar';
import { PlatformService } from '../services/platform';

// Mock vscode module
vi.mock('vscode', () => {
  const statusBarItem = {
    text: '',
    command: '',
    tooltip: '',
    show: vi.fn(),
    dispose: vi.fn(),
  };

  return {
    window: {
      createStatusBarItem: vi.fn(() => statusBarItem),
      showQuickPick: vi.fn(),
      showWarningMessage: vi.fn(),
      showInformationMessage: vi.fn(),
      showErrorMessage: vi.fn(),
      withProgress: vi.fn(async (_opts: unknown, task: () => Promise<void>) => task()),
    },
    StatusBarAlignment: { Left: 1, Right: 2 },
    ProgressLocation: { Notification: 15 },
  };
});

function createMockPlatformService(currentPlatform: string | null = 'kiro'): PlatformService {
  return {
    getCurrentPlatform: vi.fn().mockReturnValue(currentPlatform),
    detectPlatform: vi.fn().mockResolvedValue('kiro'),
    switchPlatform: vi.fn().mockResolvedValue(undefined),
  } as unknown as PlatformService;
}

describe('PlatformStatusBar', () => {
  let vscode: typeof import('vscode');

  beforeEach(async () => {
    vi.clearAllMocks();
    vscode = await import('vscode');
  });

  it('creates a status bar item on construction', () => {
    const service = createMockPlatformService();
    const bar = new PlatformStatusBar(service);

    expect(vscode.window.createStatusBarItem).toHaveBeenCalledWith(
      vscode.StatusBarAlignment.Left,
      50,
    );
    bar.dispose();
  });

  it('displays the current platform name', () => {
    const service = createMockPlatformService('kiro');
    const bar = new PlatformStatusBar(service);

    const item = (vscode.window.createStatusBarItem as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(item.text).toBe('$(symbol-misc) SDD: Kiro');
    bar.dispose();
  });

  it('displays detecting text when platform is null', () => {
    const service = createMockPlatformService(null);
    const bar = new PlatformStatusBar(service);

    const item = (vscode.window.createStatusBarItem as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(item.text).toBe('$(symbol-misc) SDD: Detecting…');
    bar.dispose();
  });

  it('sets the command to sddStudio.switchPlatform', () => {
    const service = createMockPlatformService();
    const bar = new PlatformStatusBar(service);

    const item = (vscode.window.createStatusBarItem as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(item.command).toBe('sddStudio.switchPlatform');
    bar.dispose();
  });

  it('shows the status bar item', () => {
    const service = createMockPlatformService();
    const bar = new PlatformStatusBar(service);

    const item = (vscode.window.createStatusBarItem as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(item.show).toHaveBeenCalled();
    bar.dispose();
  });

  it('update() refreshes the text when platform changes', () => {
    const service = createMockPlatformService('kiro');
    const bar = new PlatformStatusBar(service);

    (service.getCurrentPlatform as ReturnType<typeof vi.fn>).mockReturnValue('codex');
    bar.update();

    const item = (vscode.window.createStatusBarItem as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(item.text).toBe('$(symbol-misc) SDD: Codex');
    bar.dispose();
  });

  it('dispose() disposes the status bar item', () => {
    const service = createMockPlatformService();
    const bar = new PlatformStatusBar(service);

    const item = (vscode.window.createStatusBarItem as ReturnType<typeof vi.fn>).mock.results[0].value;
    bar.dispose();
    expect(item.dispose).toHaveBeenCalled();
  });

  describe('showPlatformSwitcher', () => {
    it('does nothing when user cancels the quick pick', async () => {
      const service = createMockPlatformService();
      (vscode.window.showQuickPick as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const bar = new PlatformStatusBar(service);
      await bar.showPlatformSwitcher();

      expect(service.switchPlatform).not.toHaveBeenCalled();
      bar.dispose();
    });

    it('shows info message when selecting the current platform', async () => {
      const service = createMockPlatformService('kiro');
      (vscode.window.showQuickPick as ReturnType<typeof vi.fn>).mockResolvedValue({
        label: 'Kiro',
      });

      const bar = new PlatformStatusBar(service);
      await bar.showPlatformSwitcher();

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Already on Kiro.');
      expect(service.switchPlatform).not.toHaveBeenCalled();
      bar.dispose();
    });

    it('does nothing when user cancels the confirmation dialog', async () => {
      const service = createMockPlatformService('kiro');
      (vscode.window.showQuickPick as ReturnType<typeof vi.fn>).mockResolvedValue({
        label: 'Codex',
      });
      (vscode.window.showWarningMessage as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const bar = new PlatformStatusBar(service);
      await bar.showPlatformSwitcher();

      expect(service.switchPlatform).not.toHaveBeenCalled();
      bar.dispose();
    });

    it('switches platform on confirmation and shows success', async () => {
      const service = createMockPlatformService('kiro');
      (vscode.window.showQuickPick as ReturnType<typeof vi.fn>).mockResolvedValue({
        label: 'Claude Code',
      });
      (vscode.window.showWarningMessage as ReturnType<typeof vi.fn>).mockResolvedValue('Switch');

      const bar = new PlatformStatusBar(service);
      await bar.showPlatformSwitcher();

      expect(service.switchPlatform).toHaveBeenCalledWith('claude-code');
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Switched to Claude Code successfully.',
      );
      bar.dispose();
    });

    it('shows error message when switch fails', async () => {
      const service = createMockPlatformService('kiro');
      (service.switchPlatform as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Platform switch failed, changes rolled back: disk full'),
      );
      (vscode.window.showQuickPick as ReturnType<typeof vi.fn>).mockResolvedValue({
        label: 'Codex',
      });
      (vscode.window.showWarningMessage as ReturnType<typeof vi.fn>).mockResolvedValue('Switch');

      const bar = new PlatformStatusBar(service);
      await bar.showPlatformSwitcher();

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'Platform switch failed: Platform switch failed, changes rolled back: disk full',
      );
      bar.dispose();
    });
  });
});

import * as fc from 'fast-check';
import { PlatformId, PLATFORM_CONFIGS } from '../types';

const allPlatforms: PlatformId[] = ['kiro', 'claude-code', 'codex', 'antigravity', 'amazonq'];
const platformArb: fc.Arbitrary<PlatformId> = fc.constantFrom(...allPlatforms);

describe('Property Tests: PlatformStatusBar', () => {
  /**
   * Property 2: Status bar text reflects platform display name
   * For any PlatformId, when that platform is the current platform,
   * the status bar text shall contain the displayName from PLATFORM_CONFIGS.
   *
   * **Feature: amazonq-platform-support, Property 2: Status bar text reflects platform display name**
   * **Validates: Requirements 7.1**
   */
  it('Property 2: Status bar text reflects platform display name', async () => {
    const vscode = await import('vscode');

    fc.assert(
      fc.property(platformArb, (platform) => {
        vi.clearAllMocks();
        const service = createMockPlatformService(platform);
        const bar = new PlatformStatusBar(service);

        const item = (vscode.window.createStatusBarItem as ReturnType<typeof vi.fn>).mock.results[0].value;
        const expectedName = PLATFORM_CONFIGS[platform].displayName;
        expect(item.text).toContain(expectedName);
        expect(item.text).toBe(`$(symbol-misc) SDD: ${expectedName}`);

        bar.dispose();
      }),
      { numRuns: 100 },
    );
  });
});

describe('Unit Tests: Platform switcher includes Amazon Q', () => {
  /**
   * Verify the platform switcher quick pick includes Amazon Q.
   * _Requirements: 7.2_
   */
  it('showPlatformSwitcher includes Amazon Q in quick pick items', async () => {
    const vscode = await import('vscode');
    const service = createMockPlatformService('kiro');
    (vscode.window.showQuickPick as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const bar = new PlatformStatusBar(service);
    await bar.showPlatformSwitcher();

    const quickPickCall = (vscode.window.showQuickPick as ReturnType<typeof vi.fn>).mock.calls[0];
    const items = quickPickCall[0] as Array<{ label: string }>;
    const labels = items.map((i: { label: string }) => i.label);
    expect(labels).toContain('Amazon Q');

    bar.dispose();
  });
});
