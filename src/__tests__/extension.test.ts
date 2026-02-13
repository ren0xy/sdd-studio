import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode
vi.mock('vscode', () => {
  class TreeItem {
    label: string;
    collapsibleState: number;
    constructor(label: string, collapsibleState?: number) {
      this.label = label;
      this.collapsibleState = collapsibleState ?? 0;
    }
  }
  return {
    TreeItem,
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
    workspace: {
      workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
      fs: { readFile: vi.fn(), writeFile: vi.fn(), readDirectory: vi.fn(), stat: vi.fn() },
      getConfiguration: vi.fn(() => ({
        get: vi.fn((_k: string, d: unknown) => d),
        update: vi.fn(),
      })),
    },
    Uri: {
      joinPath: vi.fn((base: { fsPath: string }, ...parts: string[]) => ({
        fsPath: [base.fsPath, ...parts].join('/'),
      })),
      file: vi.fn((p: string) => ({ fsPath: p })),
    },
    FileType: { File: 1, Directory: 2 },
    commands: { getCommands: vi.fn(async () => []), registerCommand: vi.fn() },
    ConfigurationTarget: { Workspace: 2 },
    window: {
      createOutputChannel: vi.fn(() => ({ appendLine: vi.fn(), show: vi.fn() })),
      registerWebviewViewProvider: vi.fn(),
      createTreeView: vi.fn(() => ({ onDidChangeVisibility: vi.fn() })),
      createStatusBarItem: vi.fn(() => ({ show: vi.fn(), hide: vi.fn(), dispose: vi.fn() })),
    },
    StatusBarAlignment: { Left: 1 },
    EventEmitter: vi.fn().mockImplementation(() => ({ event: vi.fn(), fire: vi.fn() })),
    languages: { registerCodeLensProvider: vi.fn() },
    ThemeIcon: vi.fn(),
  };
});

// Mock framework loader
vi.mock('../framework/loader', () => ({
  loadFramework: vi.fn(async () => ({})),
  isFrameworkAvailable: vi.fn(() => true),
  getInstances: vi.fn(async () => ({})),
}));

// Mock log
vi.mock('../log', () => ({
  log: vi.fn(),
  showLog: vi.fn(),
}));

import { autoInstallSkills } from '../extension';
import { buildRefineInstruction, buildStartTaskGroupInstruction, buildRunTaskInstruction, buildRetryTaskInstruction, buildFixTaskInstruction } from '../specDocumentLens';
import type { SkillsService } from '../services/skills';
import * as vscode from 'vscode';

function createMockSkillsService(overrides: {
  installed?: { name: string }[];
  available?: { name: string }[];
  installError?: string;
} = {}): SkillsService {
  const { installed = [], available = [], installError } = overrides;
  return {
    listInstalled: vi.fn(async () => installed),
    listAvailable: vi.fn(async () => available),
    installSkill: installError
      ? vi.fn(async () => { throw new Error(installError); })
      : vi.fn(async () => {}),
    uninstallSkill: vi.fn(),
    getSkillContent: vi.fn(),
  } as unknown as SkillsService;
}

describe('autoInstallSkills', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips when empty platforms array passed', async () => {
    const ss = createMockSkillsService();

    await autoInstallSkills(ss, []);

    expect(ss.listInstalled).not.toHaveBeenCalled();
  });

  it('skips installation when all skills are already installed', async () => {
    const skills = [{ name: 'create-spec' }, { name: 'refine-spec' }];
    const ss = createMockSkillsService({ installed: skills, available: skills });

    await autoInstallSkills(ss, ['kiro']);

    expect(ss.installSkill).not.toHaveBeenCalled();
  });

  it('installs missing skills', async () => {
    const installed = [{ name: 'create-spec' }];
    const available = [{ name: 'create-spec' }, { name: 'refine-spec' }, { name: 'run-task' }];
    const ss = createMockSkillsService({ installed, available });

    await autoInstallSkills(ss, ['kiro']);

    expect(ss.installSkill).toHaveBeenCalledTimes(2);
    expect(ss.installSkill).toHaveBeenCalledWith('kiro', 'refine-spec');
    expect(ss.installSkill).toHaveBeenCalledWith('kiro', 'run-task');
  });

  it('continues installing remaining skills when one fails', async () => {
    const available = [{ name: 'skill-a' }, { name: 'skill-b' }];
    const installFn = vi.fn()
      .mockRejectedValueOnce(new Error('write failed'))
      .mockResolvedValueOnce(undefined);
    const ss = {
      listInstalled: vi.fn(async () => []),
      listAvailable: vi.fn(async () => available),
      installSkill: installFn,
    } as unknown as SkillsService;

    await autoInstallSkills(ss, ['kiro']);

    // Both skills attempted despite first failure
    expect(installFn).toHaveBeenCalledTimes(2);
  });

  it('calls installSkill for all 5 platforms when using default', async () => {
    const available = [{ name: 'create-spec' }];
    const ss = createMockSkillsService({ installed: [], available });

    // Call without explicit platforms — should default to all 5
    await autoInstallSkills(ss);

    const allPlatforms = ['kiro', 'claude-code', 'codex', 'antigravity', 'amazonq'];
    // listInstalled called once per platform
    expect(ss.listInstalled).toHaveBeenCalledTimes(5);
    for (const platform of allPlatforms) {
      expect(ss.listInstalled).toHaveBeenCalledWith(platform);
      expect(ss.installSkill).toHaveBeenCalledWith(platform, 'create-spec');
    }
    expect(ss.installSkill).toHaveBeenCalledTimes(5);
  });

  it('skips already-installed skills without overwriting', async () => {
    const installed = [{ name: 'create-spec' }, { name: 'refine-spec' }];
    const available = [{ name: 'create-spec' }, { name: 'refine-spec' }];
    const ss = createMockSkillsService({ installed, available });

    await autoInstallSkills(ss);

    // All skills already installed on every platform — installSkill never called
    expect(ss.installSkill).not.toHaveBeenCalled();
  });
});

describe('package.json validation', () => {
  it('has no references to sddStudio.mainView', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const pkgPath = path.resolve(__dirname, '..', '..', 'package.json');
    const pkgContent = fs.readFileSync(pkgPath, 'utf-8');
    expect(pkgContent).not.toContain('sddStudio.mainView');
  });
});

describe('sddStudio command handlers — clipboard-only', () => {
  let mockClipboard: { writeText: ReturnType<typeof vi.fn> };
  let mockShowInfo: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClipboard = { writeText: vi.fn() };
    (vscode as Record<string, unknown>).env = { clipboard: mockClipboard };
    mockShowInfo = vi.fn();
    (vscode.window as Record<string, unknown>).showInformationMessage = mockShowInfo;
  });

  const NOTIFICATION_MSG = 'Prompt copied to clipboard — paste it into your AI chat panel.';

  it('refineDocument copies prompt to clipboard and shows notification', async () => {
    const prompt = buildRefineInstruction('my-spec', 'requirements');
    await mockClipboard.writeText(prompt);
    mockShowInfo(NOTIFICATION_MSG);

    expect(mockClipboard.writeText).toHaveBeenCalledWith(prompt);
    expect(mockShowInfo).toHaveBeenCalledWith(NOTIFICATION_MSG);
  });

  it('startTaskGroup copies prompt to clipboard and shows notification', async () => {
    const prompt = buildStartTaskGroupInstruction('my-spec', '1');
    await mockClipboard.writeText(prompt);
    mockShowInfo(NOTIFICATION_MSG);

    expect(mockClipboard.writeText).toHaveBeenCalledWith(prompt);
    expect(mockShowInfo).toHaveBeenCalledWith(NOTIFICATION_MSG);
  });

  it('runTask copies prompt to clipboard and shows notification', async () => {
    const prompt = buildRunTaskInstruction('my-spec', '1.1');
    await mockClipboard.writeText(prompt);
    mockShowInfo(NOTIFICATION_MSG);

    expect(mockClipboard.writeText).toHaveBeenCalledWith(prompt);
    expect(mockShowInfo).toHaveBeenCalledWith(NOTIFICATION_MSG);
  });

  it('retryTask copies prompt to clipboard and shows notification', async () => {
    const prompt = buildRetryTaskInstruction('my-spec', '1.1');
    await mockClipboard.writeText(prompt);
    mockShowInfo(NOTIFICATION_MSG);

    expect(mockClipboard.writeText).toHaveBeenCalledWith(prompt);
    expect(mockShowInfo).toHaveBeenCalledWith(NOTIFICATION_MSG);
  });

  it('fixTask copies prompt to clipboard and shows notification', async () => {
    const prompt = buildFixTaskInstruction('my-spec', '1', '1.1');
    await mockClipboard.writeText(prompt);
    mockShowInfo(NOTIFICATION_MSG);

    expect(mockClipboard.writeText).toHaveBeenCalledWith(prompt);
    expect(mockShowInfo).toHaveBeenCalledWith(NOTIFICATION_MSG);
  });
});
