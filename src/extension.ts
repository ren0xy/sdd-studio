import * as vscode from 'vscode';
import { PlatformService } from './services/platform';
import { SkillsService } from './services/skills';
import { PlatformStatusBar } from './statusBar';
import { SpecsTreeProvider } from './specsTreeProvider';
import { SpecDocumentCodeLensProvider, buildRefineInstruction, buildStartTaskGroupInstruction, buildRunTaskInstruction, buildRetryTaskInstruction, buildFixTaskInstruction } from './specDocumentLens';
import { log, showLog } from './log';
import { loadFramework, isFrameworkAvailable } from './framework/loader';
import { copyPromptToClipboard } from './services/clipboard';
import type { PlatformId } from './types';

const ALL_PLATFORMS: PlatformId[] = ['kiro', 'claude-code', 'codex', 'antigravity', 'amazonq'];

/**
 * Auto-install missing core skills for all platforms.
 * Logs results and continues on per-skill errors.
 */
export async function autoInstallSkills(
  skillsService: SkillsService,
  platforms: PlatformId[] = ALL_PLATFORMS
): Promise<void> {
  if (platforms.length === 0) {
    log('autoInstallSkills: no platforms specified, skipping');
    return;
  }

  for (const platform of platforms) {
    try {
      const installed = await skillsService.listInstalled(platform);
      const installedNames = new Set(installed.map(s => s.name));
      const available = await skillsService.listAvailable(platform);
      const missing = available.filter(s => !installedNames.has(s.name));

      if (missing.length === 0) {
        log(`autoInstallSkills: ${platform} — all skills up to date`);
        continue;
      }

      for (const skill of missing) {
        try {
          await skillsService.installSkill(platform, skill.name);
          log(`autoInstallSkills: ${platform} — installed "${skill.name}"`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          log(`autoInstallSkills: ${platform} — failed to install "${skill.name}": ${msg}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`autoInstallSkills: ${platform} — error listing skills: ${msg}`);
    }
  }
}

/**
 * Activate the SDD Studio extension.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  log('=== SDD Studio activating ===');

  // Eagerly attempt to load the framework
  try {
    await loadFramework();
    log('Framework loaded successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Framework load FAILED: ${message}`);
    console.error('SDD Studio: Failed to load sdd-framework:', message);
    vscode.window.showErrorMessage(
      'SDD Studio: The sdd-framework package failed to load. ' +
      'Framework-dependent features are disabled. ' +
      `Error: ${message}`,
    );
  }

  // Initialize services
  const platformService = new PlatformService();
  const skillsService = new SkillsService();
  log('Services initialized');

  // Create and register the specs tree view
  const specsTreeProvider = new SpecsTreeProvider();
  context.subscriptions.push(
    vscode.window.createTreeView('sddStudio.specsView', {
      treeDataProvider: specsTreeProvider,
      showCollapseAll: true,
    }),
  );
  log('Specs tree view registered');

  // Register CodeLens provider for spec documents
  const specLensProvider = new SpecDocumentCodeLensProvider();
  const config = vscode.workspace.getConfiguration('sddStudio');
  const specsPath = config.get<string>('specsPath', '.kiro/specs');
  const lensPattern = `**/${specsPath}/*/{requirements,design,tasks}.md`;
  log(`CodeLens registered with pattern: ${lensPattern}`);
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { pattern: lensPattern },
      specLensProvider,
    ),
  );

  // Watch tasks.md files for live CodeLens status refresh
  const tasksWatchPattern = `**/${specsPath}/*/tasks.md`;
  const tasksWatcher = vscode.workspace.createFileSystemWatcher(tasksWatchPattern);
  tasksWatcher.onDidChange(() => specLensProvider.refresh());
  tasksWatcher.onDidCreate(() => specLensProvider.refresh());
  tasksWatcher.onDidDelete(() => specLensProvider.refresh());
  context.subscriptions.push(tasksWatcher);
  log(`Tasks file watcher registered with pattern: ${tasksWatchPattern}`);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('sddStudio.showLog', () => showLog()),

    vscode.commands.registerCommand('sddStudio.createSpec', async () => {
      log('Command: sddStudio.createSpec');
      const name = await vscode.window.showInputBox({
        prompt: 'Enter a feature name for the new spec',
        placeHolder: 'my-feature',
        validateInput: (value) => {
          if (!value || !value.trim()) {
            return 'Feature name is required';
          }
          if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.trim())) {
            return 'Use kebab-case (e.g., my-feature)';
          }
          return undefined;
        },
      });
      if (name) {
        const specs = await import('./services/specs');
        await specs.createSpec(name.trim(), platformService);
        specsTreeProvider.refresh();
        log(`Spec created: ${name.trim()}`);
      }
    }),

    vscode.commands.registerCommand('sddStudio.deleteSpec', async () => {
      log('Command: sddStudio.deleteSpec');
      const specList = await import('./services/specs').then((m) => m.listSpecs());
      if (specList.length === 0) {
        vscode.window.showInformationMessage('No specs found to delete.');
        return;
      }
      const picked = await vscode.window.showQuickPick(
        specList.map((s) => s.name),
        { placeHolder: 'Select a spec to delete' },
      );
      if (picked) {
        const confirm = await vscode.window.showWarningMessage(
          `Delete spec "${picked}" and all its files?`,
          { modal: true },
          'Delete',
        );
        if (confirm === 'Delete') {
          const specs = await import('./services/specs');
          await specs.deleteSpec(picked);
          specsTreeProvider.refresh();
          log(`Spec deleted: ${picked}`);
        }
      }
    }),

    vscode.commands.registerCommand('sddStudio.openDocument', async (specName: string, document: string) => {
      log(`Command: sddStudio.openDocument spec="${specName}" doc="${document}"`);
      const cfg = vscode.workspace.getConfiguration('sddStudio');
      const sp = cfg.get<string>('specsPath', '.kiro/specs');
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        log('openDocument: no workspace folder');
        return;
      }
      const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, sp, specName, `${document}.md`);
      log(`openDocument: opening ${fileUri.fsPath}`);
      await vscode.window.showTextDocument(fileUri);
    }),

    vscode.commands.registerCommand('sddStudio.refreshSpecs', () => {
      log('Command: sddStudio.refreshSpecs');
      specsTreeProvider.refresh();
    }),

    vscode.commands.registerCommand('sddStudio.refineDocument', async (specName: string, docType: string) => {
      log(`Command: sddStudio.refineDocument spec="${specName}" doc="${docType}"`);
      const prompt = buildRefineInstruction(specName, docType as 'requirements' | 'design' | 'tasks');
      await copyPromptToClipboard(prompt);
      log('refineDocument: prompt copied to clipboard');
    }),

    vscode.commands.registerCommand('sddStudio.startTaskGroup', async (specName: string, groupId: string) => {
      log(`Command: sddStudio.startTaskGroup spec="${specName}" group="${groupId}"`);
      const prompt = buildStartTaskGroupInstruction(specName, groupId);
      await copyPromptToClipboard(prompt);
      log('startTaskGroup: prompt copied to clipboard');
    }),

    vscode.commands.registerCommand('sddStudio.runTask', async (specName: string, taskId: string) => {
      log(`Command: sddStudio.runTask spec="${specName}" task="${taskId}"`);
      const prompt = buildRunTaskInstruction(specName, taskId);
      await copyPromptToClipboard(prompt);
      log('runTask: prompt copied to clipboard');
    }),

    vscode.commands.registerCommand('sddStudio.retryTask', async (specName: string, taskId: string) => {
      log(`Command: sddStudio.retryTask spec="${specName}" task="${taskId}"`);
      const prompt = buildRetryTaskInstruction(specName, taskId);
      await copyPromptToClipboard(prompt);
      log('retryTask: prompt copied to clipboard');
    }),

    vscode.commands.registerCommand('sddStudio.fixTask', async (specName: string, groupId: string, taskId: string) => {
      log(`Command: sddStudio.fixTask spec="${specName}" group="${groupId}" task="${taskId}"`);
      const prompt = buildFixTaskInstruction(specName, groupId, taskId);
      await copyPromptToClipboard(prompt);
      log('fixTask: prompt copied to clipboard');
    }),

  );
  log('All commands registered');

  // Detect platform on activation
  try {
    const detected = await platformService.detectPlatform();
    log(`Platform detected: ${detected}`);

    // Auto-install missing skills after platform detection (only if framework loaded)
    if (isFrameworkAvailable()) {
      try {
        await autoInstallSkills(skillsService);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`Skill auto-installation failed: ${msg}`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Platform detection failed: ${message}`);
    vscode.window.showWarningMessage(`SDD Studio: Failed to detect platform — ${message}`);
  }

  // Create status bar item showing current platform
  const platformStatusBar = new PlatformStatusBar(platformService);
  context.subscriptions.push(platformStatusBar);

  // Register the switch platform command
  context.subscriptions.push(
    vscode.commands.registerCommand('sddStudio.switchPlatform', async () => {
      await platformStatusBar.showPlatformSwitcher();
    }),
  );

  log('=== SDD Studio activation complete ===');
}

/**
 * Deactivate the SDD Studio extension.
 */
export function deactivate(): void {
  // Disposables handled by context.subscriptions
}
