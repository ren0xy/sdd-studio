/**
 * TaskGroupResolver - Parses tasks.md into structured task groups
 *
 * Provides programmatic access to task group hierarchy, aggregate status,
 * requirements references, and dependency/blocking state. Consumed by
 * both the CLI (StartGroupCommand) and the sdd-studio extension.
 *
 * Parsing uses regex patterns consistent with TaskTracker to avoid
 * status drift between the two modules.
 */

import { TaskStatus } from '../types';

/** Aggregate status of a task group */
export type TaskGroupStatus = 'not_started' | 'in_progress' | 'completed' | 'failed' | 'partial';

/** A parsed task with its metadata */
export interface ParsedTask {
  id: string;
  text: string;
  status: TaskStatus;
  isOptional: boolean;
  requirements: string[];
  isBlocked: boolean;
  depth: number; // 1 = group, 2 = subgroup, 3 = leaf
}

/** A subgroup within a task group */
export interface TaskSubgroup {
  id: string;
  title: string;
  status: TaskGroupStatus;
  tasks: ParsedTask[];
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
}

/** A parsed task group from tasks.md */
export interface TaskGroup {
  id: string;
  title: string;
  status: TaskGroupStatus;
  isOptional: boolean;
  tasks: ParsedTask[];
  subgroups: TaskSubgroup[];
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
}

/** Result of requirements validation */
export interface RequirementsValidation {
  valid: boolean;
  unresolvedReferences: Array<{
    taskId: string;
    requirementIds: string[];
  }>;
}

// ── Regex patterns (consistent with TaskTracker) ────────────────────────────

/** Matches a task line: `- [x]* 1.2.3 Some text` */
const TASK_LINE_RE = /^(\s*)- \[([ x\-!~])\](\*|\\?\*)?\s+(\d+(?:\.\d+)*)\s+(.*)/;

/** Matches a requirements detail line: `_Requirements: 1.1, 1.2_` */
const REQUIREMENTS_RE = /_Requirements:\s*(.+?)_/;

/**
 * Map a checkbox character to a TaskStatus.
 */
function charToStatus(ch: string): TaskStatus {
  switch (ch) {
    case 'x': return 'completed';
    case '-': return 'in_progress';
    case '!': return 'failed';
    case '~': return 'queued';
    default:  return 'not_started';
  }
}

/**
 * Compute the aggregate TaskGroupStatus from a list of individual statuses.
 */
function computeAggregateStatus(statuses: TaskStatus[]): TaskGroupStatus {
  if (statuses.length === 0) return 'not_started';

  // Normalize: treat 'queued' as 'not_started' for aggregation
  const normalized = statuses.map(s => s === 'queued' ? 'not_started' as TaskStatus : s);

  const hasCompleted  = normalized.some(s => s === 'completed');
  const hasFailed     = normalized.some(s => s === 'failed');
  const hasInProgress = normalized.some(s => s === 'in_progress');
  const hasNotStarted = normalized.some(s => s === 'not_started');

  if (hasFailed) return 'failed';
  if (hasInProgress) return 'in_progress';
  if (hasCompleted && !hasNotStarted) return 'completed';
  if (hasCompleted && hasNotStarted) return 'partial';
  return 'not_started';
}

/**
 * Determine the depth of a task ID by counting its dot-separated segments.
 * "1" → 1, "1.1" → 2, "1.1.1" → 3
 */
function idDepth(id: string): number {
  return id.split('.').length;
}

export class TaskGroupResolver {
  /**
   * Parse tasks.md content into structured task groups.
   */
  parseGroups(content: string): TaskGroup[] {
    const lines = content.split('\n');
    const groups: TaskGroup[] = [];

    let currentGroup: TaskGroup | undefined;
    let currentSubgroup: TaskSubgroup | undefined;
    let lastParsedTask: ParsedTask | undefined;

    for (const line of lines) {
      // Try to match a task line
      const taskMatch = line.match(TASK_LINE_RE);
      if (taskMatch) {
        const [, , statusChar, optionalMarker, id, text] = taskMatch;
        const depth = idDepth(id);
        const status = charToStatus(statusChar);
        const isOptional = !!optionalMarker;

        const task: ParsedTask = {
          id,
          text: text.trim(),
          status,
          isOptional,
          requirements: [],
          isBlocked: false,
          depth,
        };

        if (depth === 1) {
          // Top-level group
          currentGroup = {
            id,
            title: text.trim(),
            status: 'not_started',
            isOptional,
            tasks: [task],
            subgroups: [],
            totalTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
          };
          groups.push(currentGroup);
          currentSubgroup = undefined;
        } else if (depth === 2 && currentGroup) {
          // Subgroup
          currentSubgroup = {
            id,
            title: text.trim(),
            status: 'not_started',
            tasks: [],
            totalTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
          };
          currentGroup.subgroups.push(currentSubgroup);
          currentGroup.tasks.push(task);
        } else if (depth >= 3 && currentGroup) {
          // Leaf task (or deeper)
          if (currentSubgroup) {
            currentSubgroup.tasks.push(task);
          }
          currentGroup.tasks.push(task);
        }

        lastParsedTask = task;
        continue;
      }

      // Check for requirements reference on non-task lines (detail lines)
      if (lastParsedTask) {
        const reqMatch = line.match(REQUIREMENTS_RE);
        if (reqMatch) {
          const refs = reqMatch[1].split(',').map(r => r.trim()).filter(r => r.length > 0);
          lastParsedTask.requirements.push(...refs);
        }
      }
    }

    // Post-process: compute blocking, aggregate status, and counts
    for (const group of groups) {
      this.computeBlocking(group);
      this.computeCounts(group);
      this.computeStatuses(group);
    }

    return groups;
  }

  /**
   * Get a specific group by its ID.
   */
  getGroup(content: string, groupId: string): TaskGroup | undefined {
    return this.parseGroups(content).find(g => g.id === groupId);
  }

  /**
   * Validate requirement references against requirements.md content.
   */
  validateRequirements(group: TaskGroup, requirementsContent: string): RequirementsValidation {
    const unresolvedReferences: RequirementsValidation['unresolvedReferences'] = [];

    for (const task of group.tasks) {
      if (task.requirements.length === 0) continue;

      const unresolved = task.requirements.filter(
        reqId => !this.requirementExists(reqId, requirementsContent)
      );

      if (unresolved.length > 0) {
        unresolvedReferences.push({ taskId: task.id, requirementIds: unresolved });
      }
    }

    return {
      valid: unresolvedReferences.length === 0,
      unresolvedReferences,
    };
  }

  /**
   * Find the next executable task in a group
   * (first incomplete, non-blocked leaf task).
   */
  findNextExecutableTask(group: TaskGroup): ParsedTask | undefined {
    // Look through leaf tasks (depth >= 3) in order
    const leafTasks = group.tasks.filter(t => t.depth >= 3);
    return leafTasks.find(t => (t.status === 'not_started' || t.status === 'queued') && !t.isBlocked);
  }

  /**
   * Check if a group has at least one executable task.
   */
  isGroupExecutable(group: TaskGroup): boolean {
    return this.findNextExecutableTask(group) !== undefined;
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  /**
   * Within each subgroup, mark tasks after a failed sibling as blocked.
   */
  private computeBlocking(group: TaskGroup): void {
    for (const subgroup of group.subgroups) {
      let blocked = false;
      for (const task of subgroup.tasks) {
        if (blocked) {
          task.isBlocked = true;
        }
        if (task.status === 'failed') {
          blocked = true;
        }
      }
    }
  }

  /**
   * Compute totalTasks, completedTasks, failedTasks for a group and its subgroups.
   * Group counts its immediate children (depth-2 tasks).
   * Each subgroup counts its immediate children (depth-3 tasks).
   * For depth-2 tasks with depth-3 children, derive effective status from children.
   */
  private computeCounts(group: TaskGroup): void {
    // Each subgroup counts its immediate children (depth === 3)
    for (const subgroup of group.subgroups) {
      const depth3Tasks = subgroup.tasks.filter(t => t.depth === 3);
      subgroup.totalTasks = depth3Tasks.length;
      subgroup.completedTasks = depth3Tasks.filter(t => t.status === 'completed').length;
      subgroup.failedTasks = depth3Tasks.filter(t => t.status === 'failed').length;
    }

    // Build subgroup map for effective status derivation
    const subgroupMap = new Map<string, TaskSubgroup>();
    for (const subgroup of group.subgroups) {
      subgroupMap.set(subgroup.id, subgroup);
    }

    // Group counts immediate children (depth === 2)
    const depth2Tasks = group.tasks.filter(t => t.depth === 2);
    group.totalTasks = depth2Tasks.length;

    // For counting, derive effective status from children when they exist
    group.completedTasks = depth2Tasks.filter(t => {
      const sg = subgroupMap.get(t.id);
      if (sg && sg.tasks.filter(c => c.depth === 3).length > 0) {
        return sg.totalTasks > 0 && sg.completedTasks === sg.totalTasks;
      }
      return t.status === 'completed';
    }).length;

    group.failedTasks = depth2Tasks.filter(t => {
      const sg = subgroupMap.get(t.id);
      if (sg && sg.tasks.filter(c => c.depth === 3).length > 0) {
        return sg.failedTasks > 0;
      }
      return t.status === 'failed';
    }).length;
  }

  /**
   * Compute aggregate status for each subgroup and the group itself.
   * Group aggregates from depth-2 task statuses.
   * For depth-2 tasks with depth-3 children, derive effective status from children's aggregate.
   */
  private computeStatuses(group: TaskGroup): void {
    // First, compute each subgroup's status from its depth-3 children
    for (const subgroup of group.subgroups) {
      const childStatuses = subgroup.tasks.filter(t => t.depth === 3).map(t => t.status);
      subgroup.status = childStatuses.length > 0
        ? computeAggregateStatus(childStatuses)
        : computeAggregateStatus([]);
    }

    // Build a map from subgroup ID to its computed aggregate status
    const subgroupStatusMap = new Map<string, TaskGroupStatus>();
    for (const subgroup of group.subgroups) {
      subgroupStatusMap.set(subgroup.id, subgroup.status);
    }

    // Group status aggregates from depth-2 tasks.
    // For depth-2 tasks that have depth-3 children (i.e., are subgroups),
    // use the subgroup's aggregate status instead of the task's own checkbox.
    const depth2Tasks = group.tasks.filter(t => t.depth === 2);
    if (depth2Tasks.length > 0) {
      const effectiveStatuses: TaskStatus[] = depth2Tasks.map(t => {
        const subgroupStatus = subgroupStatusMap.get(t.id);
        if (subgroupStatus !== undefined) {
          // Map TaskGroupStatus back to TaskStatus for aggregation
          switch (subgroupStatus) {
            case 'completed': return 'completed' as TaskStatus;
            case 'failed': return 'failed' as TaskStatus;
            case 'in_progress': return 'in_progress' as TaskStatus;
            case 'partial': return 'in_progress' as TaskStatus;
            default: return 'not_started' as TaskStatus;
          }
        }
        // No children — use own checkbox status
        return t.status;
      });
      group.status = computeAggregateStatus(effectiveStatuses);
    } else {
      // Fallback: use group-level task status
      group.status = computeAggregateStatus(group.tasks.filter(t => t.depth === 1).map(t => t.status));
    }
  }

  /**
   * Check if a requirement ID exists in requirements.md content.
   * Looks for headings or numbered items matching the ID pattern.
   */
  private requirementExists(reqId: string, content: string): boolean {
    if (!content) return false;
    // Match patterns like "### Requirement 1.1" or "1.1 " or "1.1:" at line starts
    const escaped = reqId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      `(^|\\n).*(?:Requirement\\s+${escaped}|\\b${escaped}\\b)`,
      'm'
    );
    return pattern.test(content);
  }
}
