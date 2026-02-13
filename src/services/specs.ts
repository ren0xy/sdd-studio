import * as vscode from 'vscode';
import { SpecSummary, SpecStatus } from '../types';
import { isDocumentDone, countTasks, extractDescriptionFromText } from './specUtils';
import { getInstances } from '../framework/loader';
import { PlatformService } from './platform';

/**
 * Resolve the specs root URI from workspace configuration.
 */
function getSpecsRootUri(): vscode.Uri {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    throw new Error('No workspace folder open');
  }
  const config = vscode.workspace.getConfiguration('sddStudio');
  const specsPath = config.get<string>('specsPath', '.kiro/specs');
  return vscode.Uri.joinPath(workspaceFolder.uri, specsPath);
}

/**
 * Check if a file has meaningful content beyond a template header.
 */
async function hasContent(uri: vscode.Uri): Promise<boolean> {
  try {
    const raw = await vscode.workspace.fs.readFile(uri);
    const text = Buffer.from(raw).toString('utf-8');
    return isDocumentDone(text);
  } catch {
    return false;
  }
}

/**
 * Compute the status of a spec by inspecting its files.
 */
export async function getSpecStatus(specUri: vscode.Uri): Promise<SpecStatus> {
  const requirementsDone = await hasContent(vscode.Uri.joinPath(specUri, 'requirements.md'));
  const designDone = await hasContent(vscode.Uri.joinPath(specUri, 'design.md'));

  let tasksTotal = 0;
  let tasksCompleted = 0;

  try {
    const tasksUri = vscode.Uri.joinPath(specUri, 'tasks.md');
    const raw = await vscode.workspace.fs.readFile(tasksUri);
    const content = Buffer.from(raw).toString('utf-8');
    const counts = countTasks(content);
    tasksTotal = counts.tasksTotal;
    tasksCompleted = counts.tasksCompleted;
  } catch {
    // tasks.md missing or unreadable — counts stay at 0
  }

  return { requirementsDone, designDone, tasksTotal, tasksCompleted };
}

/**
 * Extract a brief description from requirements.md.
 */
async function extractDescription(specUri: vscode.Uri): Promise<string> {
  try {
    const raw = await vscode.workspace.fs.readFile(
      vscode.Uri.joinPath(specUri, 'requirements.md'),
    );
    const text = Buffer.from(raw).toString('utf-8');
    return extractDescriptionFromText(text);
  } catch {
    return '';
  }
}

/**
 * List all specs found in the specs directory.
 */
export async function listSpecs(): Promise<SpecSummary[]> {
  const specsRoot = getSpecsRootUri();

  let entries: [string, vscode.FileType][];
  try {
    entries = await vscode.workspace.fs.readDirectory(specsRoot);
  } catch {
    return [];
  }

  const specs: SpecSummary[] = [];

  for (const [name, type] of entries) {
    if (type !== vscode.FileType.Directory) continue;

    const specUri = vscode.Uri.joinPath(specsRoot, name);
    const [status, description] = await Promise.all([
      getSpecStatus(specUri),
      extractDescription(specUri),
    ]);

    specs.push({ name, description, status });
  }

  return specs;
}

/**
 * Create a new spec by delegating entirely to the framework's CreateSpecCommand.
 */
export async function createSpec(name: string, platformService?: PlatformService): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    throw new Error('No workspace folder open');
  }

  const platform = platformService?.getCurrentPlatform() ?? 'kiro';
  const { createSpecCommand } = await getInstances(workspaceFolder.uri);

  const result = await createSpecCommand.execute({
    name,
    platform,
    workspaceRoot: workspaceFolder.uri.fsPath
  });

  if (!result.success) {
    throw new Error(result.error?.message ?? `Failed to create spec: ${name}`);
  }
}

/**
 * Delete a spec folder and all its contents.
 */
export async function deleteSpec(name: string): Promise<void> {
  const specsRoot = getSpecsRootUri();
  const specUri = vscode.Uri.joinPath(specsRoot, name);
  await vscode.workspace.fs.delete(specUri, { recursive: true });
}
