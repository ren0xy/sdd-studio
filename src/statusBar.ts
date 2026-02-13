import * as vscode from 'vscode';
import { PlatformId, PLATFORM_CONFIGS } from './types';
import { PlatformService } from './services/platform';

/**
 * Manages the VS Code status bar item that displays the current platform
 * and triggers the platform switch quick picker on click.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */
export class PlatformStatusBar implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;

  constructor(private platformService: PlatformService) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      50,
    );
    this.statusBarItem.command = 'sddStudio.switchPlatform';
    this.statusBarItem.tooltip = 'Click to switch AI coding agent platform';
    this.update();
    this.statusBarItem.show();
  }

  /**
   * Update the status bar text to reflect the current platform.
   */
  update(): void {
    const platform = this.platformService.getCurrentPlatform();
    if (platform) {
      const config = PLATFORM_CONFIGS[platform];
      this.statusBarItem.text = `$(symbol-misc) SDD: ${config.displayName}`;
    } else {
      this.statusBarItem.text = '$(symbol-misc) SDD: Detecting…';
    }
  }

  /**
   * Show a quick picker with all supported platforms, then confirm and execute the switch.
   * Displays a progress indicator during transformation and handles rollback on failure.
   *
   * Requirements: 6.2, 6.3, 6.4, 6.5, 6.6
   */
  async showPlatformSwitcher(): Promise<void> {
    const currentPlatform = this.platformService.getCurrentPlatform();

    const items: vscode.QuickPickItem[] = Object.values(PLATFORM_CONFIGS).map((config) => ({
      label: config.displayName,
      description: config.id === currentPlatform ? '(current)' : undefined,
      detail: `Steering: ${config.steeringPath} · Skills: ${config.skillsPath}`,
    }));

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a target platform',
      title: 'Switch AI Coding Agent Platform',
    });

    if (!picked) {
      return;
    }

    // Resolve the selected platform id
    const target = Object.values(PLATFORM_CONFIGS).find(
      (c) => c.displayName === picked.label,
    );
    if (!target) {
      return;
    }

    if (target.id === currentPlatform) {
      vscode.window.showInformationMessage(`Already on ${target.displayName}.`);
      return;
    }

    // Confirmation dialog describing the changes (Requirement 6.3)
    const confirm = await vscode.window.showWarningMessage(
      `Switch from ${currentPlatform ? PLATFORM_CONFIGS[currentPlatform].displayName : 'unknown'} to ${target.displayName}?\n\n` +
      `This will create the ${target.displayName} directory structure ` +
      `(steering at "${target.steeringPath}", skills at "${target.skillsPath}"). ` +
      `Your specs in .kiro/specs/ will not be modified.`,
      { modal: true },
      'Switch',
    );

    if (confirm !== 'Switch') {
      return;
    }

    // Progress indicator during transformation (Requirement 6.5)
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Switching to ${target.displayName}…`,
        cancellable: false,
      },
      async () => {
        try {
          await this.platformService.switchPlatform(target.id);
          this.update();
          vscode.window.showInformationMessage(
            `Switched to ${target.displayName} successfully.`,
          );
        } catch (error) {
          // Error notification with rollback info (Requirement 6.6)
          const message = error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(
            `Platform switch failed: ${message}`,
          );
        }
      },
    );
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}
