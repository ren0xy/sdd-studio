import { parseTaskMarkdown } from '../parsers/taskParser';

/**
 * Determine if text content represents a "done" document.
 * A document is considered "done" if it has more than just a single heading line.
 */
export function isDocumentDone(text: string): boolean {
  const lines = text.trim().split('\n').filter(l => l.trim().length > 0);
  return lines.length > 1;
}

/**
 * Count total and completed tasks from parsed task markdown content.
 */
export function countTasks(tasksContent: string): { tasksTotal: number; tasksCompleted: number } {
  const result = parseTaskMarkdown(tasksContent);
  let tasksTotal = 0;
  let tasksCompleted = 0;

  if (result.ok) {
    const walk = (nodes: { status: string; children: typeof nodes }[]) => {
      for (const node of nodes) {
        tasksTotal++;
        if (node.status === 'completed') tasksCompleted++;
        walk(node.children);
      }
    };
    walk(result.tasks);
  }

  return { tasksTotal, tasksCompleted };
}

/**
 * Extract a brief description from requirements text (first non-heading, non-empty line).
 */
export function extractDescriptionFromText(text: string): string {
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      return trimmed.length > 120 ? trimmed.slice(0, 120) + '…' : trimmed;
    }
  }
  return '';
}
