import * as vscode from 'vscode';
import { log } from './log';
import { isFrameworkAvailable } from './framework/loader';
import { composeSkillInstruction } from './sdd-framework';

type DocType = 'requirements' | 'design' | 'tasks';

interface SpecDocInfo {
  specName: string;
  docType: DocType;
}

const DOC_LABELS: Record<DocType, { index: number; label: string }> = {
  requirements: { index: 1, label: 'Requirements' },
  design: { index: 2, label: 'Design' },
  tasks: { index: 3, label: 'Task list' },
};

/**
 * Parse a spec document URI to extract spec name and document type.
 */
function parseSpecUri(uri: vscode.Uri): SpecDocInfo | undefined {
  const config = vscode.workspace.getConfiguration('sddStudio');
  const specsPath = config.get<string>('specsPath', '.kiro/specs');
  const normalised = uri.fsPath.replace(/\\/g, '/');
  const specsNorm = specsPath.replace(/\\/g, '/');

  const idx = normalised.indexOf(specsNorm);
  if (idx === -1) {
    log(`parseSpecUri: specsPath "${specsNorm}" not found in "${normalised}"`);
    return undefined;
  }

  const relative = normalised.slice(idx + specsNorm.length + 1);
  const parts = relative.split('/');
  if (parts.length !== 2) {
    log(`parseSpecUri: unexpected path depth (${parts.length} parts) for "${relative}"`);
    return undefined;
  }

  const specName = parts[0];
  const fileName = parts[1];
  const docType = fileName.replace('.md', '') as DocType;
  if (!DOC_LABELS[docType]) {
    log(`parseSpecUri: unrecognised doc type "${docType}" from file "${fileName}"`);
    return undefined;
  }

  return { specName, docType };
}

/**
 * Regex matching a task line — same pattern as taskParser.ts.
 * Captures: [1] indent, [2] status char, [3] optional marker, [4] task ID, [5] title
 */
const TASK_LINE_RE = /^(\s*)- \[([ x\-!~])\](\\\*|\*)?\s+(\d+(?:\.\d+)*)[.\s]\s*(.*)/;

/** Status character to display label mapping for leaf task CodeLens */
const STATUS_LABELS: Record<string, string> = {
  'x': '✓ Task completed',
  '-': '→ In progress',
  '!': '✗ Failed',
  '~': '⏳ Queued',
};

/** Regex to extract requirement references from detail lines */
const REQ_REF_RE = /^\s*-\s*_Requirements:\s*(.+?)_/;

/** Regex to match requirement heading IDs in requirements.md (e.g., "### Requirement 1:" or numbered items "1." "2.") */
const REQ_HEADING_RE = /^###\s+Requirement\s+(\d+)/;
const REQ_ITEM_RE = /^(\d+)\.\s/;

/** Parsed info for a single task line */
interface TaskLineInfo {
  line: number;
  id: string;
  statusChar: string;
  depth: number;
  title: string;
  requirementRefs: string[];
}

export class SpecDocumentCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChange.event;

  /** Cached requirements.md content per spec, populated asynchronously */
  private _requirementsCache = new Map<string, string>();

  /** Last logged signature to suppress duplicate log lines */
  private _lastLogSignature = '';

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const info = parseSpecUri(document.uri);
    if (!info) {
      log(`CodeLens: parseSpecUri returned undefined for ${document.uri.fsPath}`);
      return [];
    }
    const range = new vscode.Range(0, 0, 0, 0);
    const lenses: vscode.CodeLens[] = [];

    lenses.push(new vscode.CodeLens(range, {
      title: `📋 ${info.specName}`,
      command: '',
      arguments: [],
    }));

    for (const [type, meta] of Object.entries(DOC_LABELS) as [DocType, { index: number; label: string }][]) {
      const isCurrent = type === info.docType;
      lenses.push(new vscode.CodeLens(range, {
        title: isCurrent ? `【${meta.index}  ${meta.label}】` : `${meta.index}  ${meta.label}`,
        command: isCurrent ? '' : 'sddStudio.openDocument',
        arguments: isCurrent ? [] : [info.specName, type],
      }));
    }

    lenses.push(new vscode.CodeLens(range, {
      title: '↻ Refine',
      command: 'sddStudio.refineDocument',
      arguments: [info.specName, info.docType],
    }));

    // Task-level lenses for tasks.md documents
    if (info.docType === 'tasks') {
      // Trigger async requirements load (will refresh CodeLens when ready)
      this.ensureRequirementsLoaded(document.uri, info.specName);
      lenses.push(...this.buildTaskLenses(document, info.specName));
    }

    return lenses;
  }

  /**
   * Build per-group and per-task CodeLens for a tasks.md document.
   *
   * Supports checkbox-based groups: `- [ ] 1 Group Title` with depth-1 task IDs.
   *
   * Returns [] if no depth-1 tasks found (graceful degradation).
   */
  buildTaskLenses(document: vscode.TextDocument, specName: string): vscode.CodeLens[] {
    const lenses: vscode.CodeLens[] = [];

    // Parse all task lines from the document
    const taskLines: TaskLineInfo[] = [];
    let lastTask: TaskLineInfo | undefined;

    for (let i = 0; i < document.lineCount; i++) {
      const text = document.lineAt(i).text;
      const taskMatch = text.match(TASK_LINE_RE);
      if (taskMatch) {
        const id = taskMatch[4];
        lastTask = {
          line: i,
          id,
          statusChar: taskMatch[2],
          depth: id.split('.').length,
          title: taskMatch[5].trim(),
          requirementRefs: [],
        };
        taskLines.push(lastTask);
      } else if (lastTask) {
        // Check for requirement reference detail lines below the last task
        const reqMatch = text.match(REQ_REF_RE);
        if (reqMatch) {
          const refs = reqMatch[1].split(',').map(r => r.trim());
          lastTask.requirementRefs.push(...refs);
        }
      }
    }

    const hasDepth1Tasks = taskLines.some(t => t.depth === 1);

    // Use original tasks if depth-1 groups exist, otherwise infer synthetic groups
    const effectiveTaskLines = hasDepth1Tasks ? taskLines :
      (taskLines.length > 0 ? this.inferSyntheticGroups(taskLines) : taskLines);

    if (effectiveTaskLines.some(t => t.depth === 1)) {
      // Build parent IDs set for dynamic leaf detection
      const parentIds = new Set<string>();
      for (const task of effectiveTaskLines) {
        for (const other of effectiveTaskLines) {
          if (other.id !== task.id && other.id.startsWith(task.id + '.')) {
            parentIds.add(task.id);
            break;
          }
        }
      }

      this.buildCheckboxGroupLenses(effectiveTaskLines, parentIds, specName, lenses);
    }

    // Only log when results change to avoid spam from repeated provideCodeLenses calls
    const sig = `${specName}|${taskLines.length}|${hasDepth1Tasks}|${lenses.length}`;
    if (sig !== this._lastLogSignature) {
      this._lastLogSignature = sig;
      log(`CodeLens: spec="${specName}" tasks=${taskLines.length} depth1=${hasDepth1Tasks} → ${lenses.length} lenses`);
    }

    return lenses;
  }

  /**
   * Infer synthetic depth-1 group entries when no explicit depth-1 tasks exist.
   * Groups tasks by their first ID segment and creates a virtual group header for each.
   */
  private inferSyntheticGroups(taskLines: TaskLineInfo[]): TaskLineInfo[] {
    const groups = new Map<string, TaskLineInfo[]>();

    for (const task of taskLines) {
      const firstSegment = task.id.split('.')[0];
      if (!groups.has(firstSegment)) {
        groups.set(firstSegment, []);
      }
      groups.get(firstSegment)!.push(task);
    }

    const augmented: TaskLineInfo[] = [];
    for (const [groupId, children] of groups) {
      // Compute aggregate status from children
      const allDone = children.every(t => t.statusChar === 'x');
      const anyFailed = children.some(t => t.statusChar === '!');
      const anyInProgress = children.some(t => t.statusChar === '-');
      let statusChar = ' ';
      if (allDone) {
        statusChar = 'x';
      } else if (anyFailed) {
        statusChar = '!';
      } else if (anyInProgress) {
        statusChar = '-';
      }

      augmented.push({
        id: groupId,
        depth: 1,
        line: children[0].line,
        statusChar,
        title: `Group ${groupId}`,
        requirementRefs: [],
      });
      augmented.push(...children);
    }

    return augmented;
  }


  /**
   * Build lenses for checkbox-based group format (depth-1 tasks as group headers).
   */
  private buildCheckboxGroupLenses(
    taskLines: TaskLineInfo[],
    parentIds: Set<string>,
    specName: string,
    lenses: vscode.CodeLens[],
  ): void {
    let currentGroup: { info: TaskLineInfo; allTasks: TaskLineInfo[]; countableTasks: TaskLineInfo[]; leafTasks: TaskLineInfo[] } | null = null;

    for (const task of taskLines) {
      if (task.depth === 1) {
        // Flush previous group
        if (currentGroup) {
          lenses.push(...this.buildGroupLens(currentGroup.info, currentGroup.countableTasks, currentGroup.leafTasks, currentGroup.allTasks, specName, parentIds));
        }
        currentGroup = { info: task, allTasks: [], countableTasks: [], leafTasks: [] };
      } else if (currentGroup) {
        currentGroup.allTasks.push(task);
        // Depth-2 tasks are the group's countable children (for N/M done counter)
        if (task.depth === 2) {
          currentGroup.countableTasks.push(task);
        }
        // Leaf tasks are those with no children (for per-task CodeLens)
        if (!parentIds.has(task.id)) {
          currentGroup.leafTasks.push(task);
        }
      }
    }

    // Flush last group
    if (currentGroup) {
      lenses.push(...this.buildGroupLens(currentGroup.info, currentGroup.countableTasks, currentGroup.leafTasks, currentGroup.allTasks, specName, parentIds));
    }
  }

  /**
   * Build CodeLens for a single group header + its leaf task status indicators.
   */
  private buildGroupLens(
    group: TaskLineInfo,
    countableTasks: TaskLineInfo[],
    leafTasks: TaskLineInfo[],
    allTasks: TaskLineInfo[],
    specName: string,
    parentIds: Set<string>,
  ): vscode.CodeLens[] {
    const lenses: vscode.CodeLens[] = [];
    const range = new vscode.Range(group.line, 0, group.line, 0);

    // Group counter uses countable tasks (depth-2 immediate children)
    // A depth-2 task is "effectively complete" if:
    //   - it has no children and status is 'x', OR
    //   - it has children and ALL its children (in allTasks) are completed
    const completed = countableTasks.filter(t => {
      if (!parentIds.has(t.id)) {
        // Leaf: just check its own status
        return t.statusChar === 'x';
      }
      // Parent: check all children are completed
      const children = allTasks.filter(c => c.id.startsWith(t.id + '.') && c.id.split('.').length === t.id.split('.').length + 1);
      return children.length > 0 && children.every(c => c.statusChar === 'x');
    }).length;
    const total = countableTasks.length;
    const allDone = total > 0 && completed === total;

    // Collect validation warnings
    const warnings: string[] = [];

    // Requirements validation
    const reqContent = this._requirementsCache.get(specName);
    if (reqContent) {
      const availableReqIds = this.parseRequirementIds(reqContent);
      const allRefs = allTasks.flatMap(t => t.requirementRefs);
      const unresolved = allRefs.filter(ref => !availableReqIds.has(ref));
      if (unresolved.length > 0) {
        const unique = [...new Set(unresolved)];
        warnings.push(`⚠ ${unique.length} unresolved req${unique.length > 1 ? 's' : ''}`);
      }
    }

    // Blocked task detection: a leaf task is blocked if a prior sibling (same subgroup) failed
    const blockedBy = this.findBlockedBy(leafTasks);
    if (blockedBy) {
      warnings.push(`🚫 Blocked by failed task ${blockedBy}`);
    }

    const warningStr = warnings.length > 0 ? ` │ ${warnings.join(' │ ')}` : '';

    const groupStatusChar = group.statusChar;

    if (groupStatusChar === '!') {
      lenses.push(new vscode.CodeLens(range, {
        title: `✗ Group failed │ ${completed}/${total} done${warningStr}`,
        command: '',
        arguments: [],
      }));
    } else if (groupStatusChar === '-') {
      lenses.push(new vscode.CodeLens(range, {
        title: `→ Group in progress │ ${completed}/${total} done${warningStr}`,
        command: '',
        arguments: [],
      }));
    } else if (allDone) {
      lenses.push(new vscode.CodeLens(range, {
        title: `✓ Group complete (${total}/${total})`,
        command: '',
        arguments: [],
      }));
    } else {
      const groupId = group.id;
      lenses.push(new vscode.CodeLens(range, {
        title: `⚡ Start task group${warningStr} │ ${completed}/${total} done`,
        command: 'sddStudio.startTaskGroup',
        arguments: [specName, groupId],
      }));
    }

    // Subgroup sub-counter CodeLens for depth-2 parent tasks (status-aware)
    for (const task of countableTasks) {
      if (parentIds.has(task.id)) {
        const children = allTasks.filter(t =>
          t.id.startsWith(task.id + '.') && t.id.split('.').length === task.id.split('.').length + 1
        );
        const childCompleted = children.filter(t => t.statusChar === 'x').length;
        const childFailed = children.some(t => t.statusChar === '!');
        const childInProgress = children.some(t => t.statusChar === '-');
        const allChildrenDone = children.length > 0 && childCompleted === children.length;
        const taskRange = new vscode.Range(task.line, 0, task.line, 0);

        if (allChildrenDone) {
          lenses.push(new vscode.CodeLens(taskRange, {
            title: `✓ ${childCompleted}/${children.length} done`,
            command: '',
            arguments: [],
          }));
        } else if (childFailed) {
          lenses.push(new vscode.CodeLens(taskRange, {
            title: `✗ ${childCompleted}/${children.length} done`,
            command: '',
            arguments: [],
          }));
        } else if (childInProgress) {
          lenses.push(new vscode.CodeLens(taskRange, {
            title: `→ ${childCompleted}/${children.length} done`,
            command: '',
            arguments: [],
          }));
        } else {
          lenses.push(new vscode.CodeLens(taskRange, {
            title: `${childCompleted}/${children.length} done`,
            command: '',
            arguments: [],
          }));
          lenses.push(new vscode.CodeLens(taskRange, {
            title: '▶ Start subgroup',
            command: 'sddStudio.startTaskGroup',
            arguments: [specName, task.id],
          }));
        }
      }
    }

    // Task-level status lenses for leaf tasks
    for (const task of leafTasks) {
      const taskRange = new vscode.Range(task.line, 0, task.line, 0);

      if (task.statusChar === '!') {
        const taskGroupId = task.id.split('.')[0];
        lenses.push(new vscode.CodeLens(taskRange, {
          title: '🔄 Retry',
          command: 'sddStudio.retryTask',
          arguments: [specName, task.id],
        }));
        lenses.push(new vscode.CodeLens(taskRange, {
          title: '🔧 Fix',
          command: 'sddStudio.fixTask',
          arguments: [specName, taskGroupId, task.id],
        }));
      } else if (task.statusChar === '~') {
        lenses.push(new vscode.CodeLens(taskRange, {
          title: '⏳ Queued',
          command: '',
          arguments: [],
        }));
      } else if (task.statusChar === ' ') {
        lenses.push(new vscode.CodeLens(taskRange, {
          title: '▶ Run task',
          command: 'sddStudio.runTask',
          arguments: [specName, task.id],
        }));
      } else {
        const label = STATUS_LABELS[task.statusChar];
        if (label) {
          lenses.push(new vscode.CodeLens(taskRange, {
            title: label,
            command: '',
            arguments: [],
          }));
        }
      }
    }

    return lenses;
  }

  /**
   * Parse requirement IDs from requirements.md content.
   * Looks for "### Requirement N:" headings and numbered acceptance criteria items.
   */
  private parseRequirementIds(content: string): Set<string> {
    const ids = new Set<string>();
    let currentReqNum: string | undefined;

    for (const line of content.split('\n')) {
      const headingMatch = line.match(REQ_HEADING_RE);
      if (headingMatch) {
        currentReqNum = headingMatch[1];
        continue;
      }
      if (currentReqNum) {
        const itemMatch = line.match(REQ_ITEM_RE);
        if (itemMatch) {
          ids.add(`${currentReqNum}.${itemMatch[1]}`);
        }
      }
    }

    return ids;
  }

  /**
   * Find the first failed task that blocks subsequent siblings in the same subgroup.
   * Returns the failed task ID, or undefined if no blocking detected.
   */
  private findBlockedBy(leafTasks: TaskLineInfo[]): string | undefined {
    const bySubgroup = new Map<string, TaskLineInfo[]>();
    for (const task of leafTasks) {
      const parts = task.id.split('.');
      const subgroupId = parts.slice(0, 2).join('.');
      const group = bySubgroup.get(subgroupId) ?? [];
      group.push(task);
      bySubgroup.set(subgroupId, group);
    }

    for (const tasks of bySubgroup.values()) {
      for (let i = 0; i < tasks.length; i++) {
        if (tasks[i].statusChar === '!' && i < tasks.length - 1) {
          return tasks[i].id;
        }
      }
    }

    return undefined;
  }

  /**
   * Asynchronously load requirements.md for a spec and cache it.
   * Triggers a CodeLens refresh when the content is loaded.
   */
  private ensureRequirementsLoaded(tasksUri: vscode.Uri, specName: string): void {
    if (this._requirementsCache.has(specName)) {
      return;
    }

    const reqUri = vscode.Uri.joinPath(tasksUri, '..', 'requirements.md');
    vscode.workspace.fs.readFile(reqUri).then(
      (raw) => {
        this._requirementsCache.set(specName, Buffer.from(raw).toString('utf-8'));
        this._onDidChange.fire();
      },
      () => {
        // requirements.md not found — skip validation silently
      },
    );
  }

  /**
   * Force a CodeLens refresh. Called by the file watcher when tasks.md changes.
   * Also clears the requirements cache so validation data is re-read.
   */
  refresh(): void {
    this._requirementsCache.clear();
    this._lastLogSignature = '';
    this._onDidChange.fire();
  }
}

/**
 * Build the short instruction that gets injected into the agent panel.
 *
 * Uses the framework's Instruction Composer when available, falling back
 * to a local string if the framework hasn't loaded.
 */
export function buildRefineInstruction(specName: string, docType: DocType): string {
  if (isFrameworkAvailable()) {
    try {
      return composeSkillInstruction('refine-spec', { specName, docType });
    } catch {
      // Fall through to local fallback
    }
  }
  return `Use the refine-spec skill on the ${docType} document of spec "${specName}".`;
}

/**
 * Build the instruction for starting a task group, injected into the agent panel.
 *
 * Uses the framework's Instruction Composer when available, falling back
 * to a local string if the framework hasn't loaded or lacks the template.
 */
export function buildStartTaskGroupInstruction(specName: string, groupId: string): string {
  if (isFrameworkAvailable()) {
    try {
      return composeSkillInstruction('start-task-group', { specName, groupId });
    } catch {
      // Fall through to local fallback
    }
  }
  return `Use the start-task-group skill on group ${groupId} of spec "${specName}".`;
}

export function buildRunTaskInstruction(specName: string, taskId: string): string {
  if (isFrameworkAvailable()) {
    try {
      return composeSkillInstruction('run-task', { taskId, specName });
    } catch {
      // Fall through to local fallback
    }
  }
  return `Use the run-task skill to execute task ${taskId} from spec "${specName}".`;
}


/**
 * Build the instruction for retrying a failed task, injected into the agent panel.
 *
 * Uses the framework's Instruction Composer when available, falling back
 * to a local string if the framework hasn't loaded or lacks the template.
 */
export function buildRetryTaskInstruction(specName: string, taskId: string): string {
  if (isFrameworkAvailable()) {
    try {
      return composeSkillInstruction('run-task', { taskId, specName });
    } catch {
      // Fall through to local fallback
    }
  }
  return `Run task ${taskId} from spec "${specName}" — mark it as in-progress, execute it, then mark as completed or failed.`;
}

/**
 * Build the instruction for analyzing a failed task, injected into the agent panel.
 *
 * Uses the framework's Instruction Composer when available, falling back
 * to a local string if the framework hasn't loaded or lacks the template.
 */
export function buildFixTaskInstruction(specName: string, groupId: string, taskId: string): string {
  if (isFrameworkAvailable()) {
    try {
      return composeSkillInstruction('analyze-task-failure', { specName, groupId, failedTaskId: taskId });
    } catch {
      // Fall through to local fallback
    }
  }
  return `Analyze the failure of task ${taskId} in group ${groupId} of spec "${specName}". Read the task description, requirements, and design document. Suggest resolution tasks that can be inserted before the failed task. Format them using the same checkbox convention.`;
}
