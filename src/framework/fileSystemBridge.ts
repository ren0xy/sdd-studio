import * as vscode from 'vscode';
import type { WorkspaceFileSystem } from '../sdd-framework';
import type { FileSystem } from '../sdd-framework';
import type { FileSystemOperations } from '../sdd-framework';

/**
 * Bridges the framework's file system interfaces to vscode.workspace.fs.
 * Implements WorkspaceFileSystem, FileSystem, and FileSystemOperations
 * by resolving relative paths against the workspace root URI.
 */
export class FileSystemBridge implements WorkspaceFileSystem, FileSystem, FileSystemOperations {
  constructor(private workspaceRoot: vscode.Uri) {}

  /** Resolve a relative path against the workspace root. */
  resolve(relativePath: string): vscode.Uri {
    return vscode.Uri.joinPath(this.workspaceRoot, relativePath);
  }

  async exists(path: string): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(this.resolve(path));
      return true;
    } catch {
      return false;
    }
  }

  async mkdir(path: string): Promise<void> {
    await vscode.workspace.fs.createDirectory(this.resolve(path));
  }

  async readFile(path: string): Promise<string> {
    const data = await vscode.workspace.fs.readFile(this.resolve(path));
    return new TextDecoder('utf-8').decode(data);
  }

  async writeFile(path: string, content: string): Promise<void> {
    const data = new TextEncoder().encode(content);
    await vscode.workspace.fs.writeFile(this.resolve(path), data);
  }

  async readdir(path: string): Promise<string[]> {
    const entries = await vscode.workspace.fs.readDirectory(this.resolve(path));
    return entries.map(([name]) => name);
  }

  async copyDirectory(source: string, target: string): Promise<void> {
    await vscode.workspace.fs.copy(this.resolve(source), this.resolve(target), { overwrite: false });
  }

  async isDirectory(path: string): Promise<boolean> {
    try {
      const stat = await vscode.workspace.fs.stat(this.resolve(path));
      return stat.type === vscode.FileType.Directory;
    } catch {
      return false;
    }
  }
}
