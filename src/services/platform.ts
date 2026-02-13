import * as vscode from 'vscode';
import { PlatformId } from '../types';
import { getInstances, isFrameworkAvailable } from '../framework/loader';
import { log } from '../log';

/**
 * Known VS Code commands that indicate a platform extension is installed and active.
 * Each platform maps to one or more commands to probe.
 */
const PLATFORM_COMMAND_MARKERS: Record<PlatformId, string[]> = {
  amazonq: ['aws.amazonq.focusChat'],
  'claude-code': ['workbench.action.chat.open'],
  kiro: [],      // Kiro is the host IDE — always present when running inside Kiro
  codex: [],     // No known VS Code command yet
  antigravity: [],
};

/**
 * PlatformService wraps the SDD Framework's WorkspaceAdapter to provide
 * platform detection via VS Code command probing, multi-platform awareness,
 * and cached platform state.
 *
 * Requirements: 1.2, 6.4, 6.6, 6.7
 */
export class PlatformService {
  private primaryPlatform: PlatformId | null = null;
  private activePlatforms: PlatformId[] = [];

  /**
   * Detect all active platforms by probing registered VS Code commands,
   * then pick a primary. Also consults the framework's workspace-marker
   * detection as a secondary signal.
   */
  async detectPlatform(): Promise<PlatformId> {
    const detected: PlatformId[] = [];

    // 1. Probe VS Code commands for evidence of installed extensions
    const allCommands = await vscode.commands.getCommands(true);

    for (const [platform, markers] of Object.entries(PLATFORM_COMMAND_MARKERS) as [PlatformId, string[]][]) {
      if (markers.length === 0) continue;
      if (markers.some(cmd => allCommands.includes(cmd))) {
        detected.push(platform);
        log(`Platform probe: "${platform}" detected via command marker`);
      }
    }

    // 2. Consult framework workspace-marker detection (directory-based)
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder && isFrameworkAvailable()) {
      try {
        const { workspaceAdapter, fsBridge } = await getInstances(workspaceFolder.uri);
        const markerPlatform = await workspaceAdapter.detectCurrentPlatform(fsBridge);
        if (markerPlatform && !detected.includes(markerPlatform)) {
          detected.push(markerPlatform);
          log(`Platform probe: "${markerPlatform}" detected via workspace markers`);
        }
      } catch (err) {
        log(`Platform probe: framework detection failed: ${err}`);
      }
    }

    // 3. Fall back to VS Code configuration if nothing was detected
    if (detected.length === 0) {
      const config = vscode.workspace.getConfiguration('sddStudio');
      const configured = config.get<PlatformId>('activePlatform', 'kiro');
      detected.push(configured);
      log(`Platform probe: no markers found, falling back to config "${configured}"`);
    }

    this.activePlatforms = detected;

    // Primary = first detected (command-based takes priority)
    this.primaryPlatform = detected[0];
    log(`Platform detection complete: primary="${this.primaryPlatform}", all=[${detected.join(', ')}]`);
    return this.primaryPlatform;
  }

  /**
   * Return the cached primary platform id.
   * Returns null if detectPlatform() hasn't been called.
   */
  getCurrentPlatform(): PlatformId | null {
    return this.primaryPlatform;
  }

  /**
   * Return all detected active platforms.
   */
  getActivePlatforms(): PlatformId[] {
    return this.activePlatforms;
  }

  /**
   * Switch to a target platform by delegating to the framework's
   * WorkspaceAdapter.transformWorkspace().
   *
   * Requirements: 6.4, 6.6, 6.7
   */
  async switchPlatform(target: PlatformId): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('No workspace folder open');
    }

    const source = this.primaryPlatform;
    if (!source) {
      throw new Error('Current platform not detected. Call detectPlatform() first.');
    }

    if (source === target) {
      return;
    }

    const { workspaceAdapter, fsBridge } = await getInstances(workspaceFolder.uri);
    const result = await workspaceAdapter.transformWorkspace(source, target, fsBridge);

    if (!result.success) {
      throw new Error(`Platform switch failed: ${result.errors.join(', ')}`);
    }

    this.primaryPlatform = target;

    const config = vscode.workspace.getConfiguration('sddStudio');
    await config.update('activePlatform', target, vscode.ConfigurationTarget.Workspace);
  }
}
