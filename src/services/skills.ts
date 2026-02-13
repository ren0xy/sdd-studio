import * as vscode from 'vscode';
import { PlatformId, SkillInfo } from '../types';
import { getInstances } from '../framework/loader';

/**
 * SkillsService manages skill installation and discovery for the active platform.
 *
 * Delegates listAvailable() and installSkill() to the framework's SkillRegistry.
 * Retains VscodeFS-based scanning for listInstalled(), getSkillContent(), and uninstallSkill().
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */
export class SkillsService {
  private getWorkspaceRoot(): vscode.Uri {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('No workspace folder open');
    }
    return workspaceFolder.uri;
  }

  /**
   * List installed skills by scanning the platform-specific skills directory.
   * Enriches results with metadata from the framework's SkillRegistry.
   */
  async listInstalled(platform: PlatformId): Promise<SkillInfo[]> {
    const root = this.getWorkspaceRoot();
    const { skillRegistry, adapters } = await getInstances(root);
    const adapter = adapters.get(platform);
    if (!adapter) { return []; }
    const skillsUri = vscode.Uri.joinPath(root, adapter.skillsPath);

    let entries: [string, vscode.FileType][];
    try {
      // Check directory exists before readDirectory to avoid noisy ENOENT console errors
      await vscode.workspace.fs.stat(skillsUri);
      entries = await vscode.workspace.fs.readDirectory(skillsUri);
    } catch {
      return [];
    }

    // Get registry metadata for enrichment
    const registrySkills = skillRegistry.listForPlatform(platform);
    const registryMap = new Map(registrySkills.map(s => [s.name, s]));

    const installed: SkillInfo[] = [];
    for (const [fileName, type] of entries) {
      if (type !== vscode.FileType.File || !fileName.endsWith('.md')) {
        continue;
      }

      const skillName = fileName.replace(/\.md$/, '');
      const meta = registryMap.get(skillName);

      installed.push({
        name: skillName,
        description: meta?.description ?? '',
        supportedPlatforms: meta?.supportedPlatforms ?? [platform],
        installed: true,
      });
    }

    return installed;
  }

  /**
   * List available skills from the framework's SkillRegistry for the given platform.
   */
  async listAvailable(platform: PlatformId): Promise<SkillInfo[]> {
    const root = this.getWorkspaceRoot();
    const { skillRegistry } = await getInstances(root);
    const installed = await this.listInstalled(platform);
    const installedNames = new Set(installed.map(s => s.name));

    return skillRegistry.listForPlatform(platform).map(meta => ({
      name: meta.name,
      description: meta.description,
      supportedPlatforms: meta.supportedPlatforms,
      installed: installedNames.has(meta.name),
    }));
  }

  /**
   * Install a skill via the framework's SkillRegistry.install().
   */
  async installSkill(platform: PlatformId, name: string): Promise<void> {
    const root = this.getWorkspaceRoot();
    const { skillRegistry, adapters, fsBridge } = await getInstances(root);
    const adapter = adapters.get(platform);
    if (!adapter) { throw new Error(`No adapter for platform: ${platform}`); }

    const result = await skillRegistry.install(name, adapter, fsBridge);
    if (!result.success) {
      throw new Error(result.error ?? `Failed to install skill: ${name}`);
    }
  }

  /**
   * Uninstall a skill by removing it from the platform-specific skills directory.
   */
  async uninstallSkill(platform: PlatformId, name: string): Promise<void> {
    const root = this.getWorkspaceRoot();
    const { adapters } = await getInstances(root);
    const adapter = adapters.get(platform);
    if (!adapter) { throw new Error(`No adapter for platform: ${platform}`); }
    const fileUri = vscode.Uri.joinPath(root, adapter.skillsPath, `${name}.md`);
    await vscode.workspace.fs.delete(fileUri);
  }

  /**
   * Get the content of an installed skill file.
   */
  async getSkillContent(platform: PlatformId, name: string): Promise<string> {
    const root = this.getWorkspaceRoot();
    const { adapters } = await getInstances(root);
    const adapter = adapters.get(platform);
    if (!adapter) { throw new Error(`No adapter for platform: ${platform}`); }
    const fileUri = vscode.Uri.joinPath(root, adapter.skillsPath, `${name}.md`);
    const raw = await vscode.workspace.fs.readFile(fileUri);
    return Buffer.from(raw).toString('utf-8');
  }
}
