import * as vscode from 'vscode';
import * as specs from './services/specs';
import type { SpecSummary } from './types';

type SpecTreeElement = SpecItem | SpecDocumentItem;

class SpecItem extends vscode.TreeItem {
  constructor(public readonly spec: SpecSummary) {
    super(spec.name, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'spec';
    this.tooltip = spec.description || spec.name;
    this.iconPath = new vscode.ThemeIcon('file-directory');
  }
}

class SpecDocumentItem extends vscode.TreeItem {
  constructor(
    public readonly specName: string,
    public readonly document: 'requirements' | 'design' | 'tasks',
    label: string,
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'specDocument';
    this.iconPath = new vscode.ThemeIcon('file');
    this.command = {
      command: 'sddStudio.openDocument',
      title: 'Open Document',
      arguments: [specName, document],
    };
  }
}

export class SpecsTreeProvider implements vscode.TreeDataProvider<SpecTreeElement> {
  private _onDidChangeTreeData = new vscode.EventEmitter<SpecTreeElement | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private specsCache: SpecSummary[] = [];

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  async getChildren(element?: SpecTreeElement): Promise<SpecTreeElement[]> {
    if (!element) {
      this.specsCache = await specs.listSpecs();
      return this.specsCache.map((s) => new SpecItem(s));
    }

    if (element instanceof SpecItem) {
      return [
        new SpecDocumentItem(element.spec.name, 'requirements', 'Requirements'),
        new SpecDocumentItem(element.spec.name, 'design', 'Design'),
        new SpecDocumentItem(element.spec.name, 'tasks', 'Tasks'),
      ];
    }

    return [];
  }

  getTreeItem(element: SpecTreeElement): vscode.TreeItem {
    return element;
  }
}
