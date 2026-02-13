import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parseTaskMarkdown } from '../taskParser';
import { serializeTaskTree } from '../taskSerializer';
import { TaskNode, TaskStatusValue } from '../../types';
import { TaskTracker } from 'sdd-framework';
import type { TaskStatus } from 'sdd-framework';

const statusArb: fc.Arbitrary<TaskStatusValue> = fc.constantFrom(
  'not_started', 'in_progress', 'completed', 'failed',
);

function taskLeafArb(parentId: string, index: number): fc.Arbitrary<TaskNode> {
  const id = parentId ? `${parentId}.${index}` : `${index}`;
  return fc.record({
    id: fc.constant(id),
    title: fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,29}[A-Za-z0-9]$/),
    status: statusArb,
    children: fc.constant([] as TaskNode[]),
    isOptional: fc.constant(false),
  });
}

function taskWithChildrenArb(parentIndex: number): fc.Arbitrary<TaskNode> {
  const parentId = `${parentIndex}`;
  return fc
    .integer({ min: 1, max: 3 })
    .chain((numChildren) => {
      const childArbs = Array.from({ length: numChildren }, (_, i) =>
        taskLeafArb(parentId, i + 1),
      );
      return fc.tuple(
        fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,29}[A-Za-z0-9]$/),
        statusArb,
        fc.tuple(...childArbs),
      );
    })
    .map(([title, status, children]) => ({
      id: parentId,
      title,
      status,
      isOptional: false,
      children: children as TaskNode[],
    }));
}

const taskTreeArb: fc.Arbitrary<TaskNode[]> = fc
  .integer({ min: 1, max: 3 })
  .chain((numRoots) => {
    const rootArbs = Array.from({ length: numRoots }, (_, i) =>
      taskWithChildrenArb(i + 1),
    );
    return fc.tuple(...rootArbs);
  })
  .map((roots) => roots as TaskNode[]);

describe('Property Tests: Task Status', () => {
  const tracker = new TaskTracker();

  /**
   * Property 8: Task status update reflects in parsed tree
   * For any valid task tree and any task ID within that tree, after
   * TaskTracker.replaceTaskStatus() changes the status and the content
   * is re-parsed by parseTaskMarkdown(), the corresponding TaskNode
   * has the new status value.
   *
   * **Validates: Requirements 7.2**
   */
  it('Property 8: Task status update reflects in parsed tree', () => {
    fc.assert(
      fc.property(taskTreeArb, statusArb, (tasks, newStatus) => {
        // Collect all leaf task IDs (children)
        const allIds: string[] = [];
        const collectIds = (nodes: TaskNode[]) => {
          for (const n of nodes) {
            allIds.push(n.id);
            collectIds(n.children);
          }
        };
        collectIds(tasks);
        if (allIds.length === 0) return;

        // Pick the last task ID
        const targetId = allIds[allIds.length - 1];

        // Serialize the tree to markdown
        const markdown = serializeTaskTree(tasks);

        // Use TaskTracker to replace the status
        const updated = tracker.replaceTaskStatus(markdown, targetId, newStatus as TaskStatus);

        // Re-parse the updated markdown
        const result = parseTaskMarkdown(updated);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        // Find the target task in the parsed tree
        const findTask = (nodes: TaskNode[], id: string): TaskNode | undefined => {
          for (const n of nodes) {
            if (n.id === id) return n;
            const found = findTask(n.children, id);
            if (found) return found;
          }
          return undefined;
        };

        const targetTask = findTask(result.tasks, targetId);
        expect(targetTask).toBeDefined();
        expect(targetTask!.status).toBe(newStatus);
      }),
      { numRuns: 100 },
    );
  });
});
