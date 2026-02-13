import { TaskNode, TaskStatusValue, STATUS_MAP } from '../types';

export type ParseResult =
  | { ok: true; tasks: TaskNode[] }
  | { ok: false; error: string };

/**
 * Regex matching a task line:
 * - Captures indent, status marker, optional marker, id, and title
 * Examples:
 *   "- [x] 1. Project scaffolding"
 *   "  - [ ]* 2.3 Write property test"
 *   "  - [-] 1.1 Implement parser"
 */
const TASK_LINE_RE = /^(\s*)- \[([ x\-!])\](\\\*|\*)?\s+(\d+(?:\.\d+)?)[.\s]\s*(.*)/;

function parseStatus(marker: string): TaskStatusValue {
  const key = `[${marker}]`;
  return STATUS_MAP[key] ?? 'not_started';
}

function getTaskDepth(id: string): number {
  return id.split('.').length;
}

/**
 * Parse tasks.md markdown content into a TaskNode[] tree.
 * Returns a ParseResult with either the parsed tree or an error.
 */
export function parseTaskMarkdown(content: string): ParseResult {
  try {
    const lines = content.split('\n');
    const rootTasks: TaskNode[] = [];
    const stack: TaskNode[] = [];

    for (const line of lines) {
      const match = line.match(TASK_LINE_RE);
      if (!match) continue;

      const [, , statusChar, optionalMarker, id, title] = match;

      const node: TaskNode = {
        id,
        title: title.trim(),
        status: parseStatus(statusChar),
        children: [],
        isOptional: optionalMarker === '*' || optionalMarker === '\\*',
      };

      const depth = getTaskDepth(id);

      if (depth === 1) {
        rootTasks.push(node);
        stack.length = 0;
        stack.push(node);
      } else {
        // Pop stack until we find the parent (depth - 1)
        while (stack.length > 0 && getTaskDepth(stack[stack.length - 1].id) >= depth) {
          stack.pop();
        }

        if (stack.length > 0) {
          stack[stack.length - 1].children.push(node);
        } else {
          // Orphan sub-task with no parent — treat as root
          rootTasks.push(node);
        }
        stack.push(node);
      }
    }

    return { ok: true, tasks: rootTasks };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
