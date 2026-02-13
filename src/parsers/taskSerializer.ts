import { TaskNode, TaskStatusValue } from '../types';

const STATUS_TO_MARKER: Record<TaskStatusValue, string> = {
  not_started: ' ',
  in_progress: '-',
  completed: 'x',
  failed: '!',
  queued: '~',
};

function serializeNode(node: TaskNode, depth: number): string {
  const indent = '  '.repeat(depth);
  const marker = STATUS_TO_MARKER[node.status];
  const optional = node.isOptional ? '*' : '';
  const separator = depth === 0 ? '.' : '';
  const line = `${indent}- [${marker}]${optional} ${node.id}${separator} ${node.title}`;

  const childLines = node.children.map(child => serializeNode(child, depth + 1));

  return [line, ...childLines].join('\n');
}

/**
 * Serialize a TaskNode[] tree back to tasks.md markdown format.
 */
export function serializeTaskTree(tasks: TaskNode[]): string {
  return tasks.map(task => serializeNode(task, 0)).join('\n\n');
}
