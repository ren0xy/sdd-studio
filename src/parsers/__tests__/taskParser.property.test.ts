import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parseTaskMarkdown } from '../taskParser';
import { serializeTaskTree } from '../taskSerializer';
import { TaskNode, TaskStatusValue, STATUS_MAP } from '../../types';

// --- Arbitraries ---

const statusArb: fc.Arbitrary<TaskStatusValue> = fc.constantFrom(
  'not_started',
  'in_progress',
  'completed',
  'failed',
);

/**
 * Generate a valid TaskNode leaf (no children).
 * parentId is used to build hierarchical ids like "1.2".
 */
function taskLeafArb(parentId: string, index: number): fc.Arbitrary<TaskNode> {
  const id = parentId ? `${parentId}.${index}` : `${index}`;
  return fc.record({
    id: fc.constant(id),
    title: fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,29}[A-Za-z0-9]$/),
    status: statusArb,
    children: fc.constant([] as TaskNode[]),
    isOptional: fc.boolean(),
  });
}

/**
 * Generate a valid TaskNode tree with 1-level nesting (parent + children).
 */
function taskWithChildrenArb(parentIndex: number): fc.Arbitrary<TaskNode> {
  const parentId = `${parentIndex}`;
  return fc
    .integer({ min: 0, max: 4 })
    .chain((numChildren) => {
      const childArbs = Array.from({ length: numChildren }, (_, i) =>
        taskLeafArb(parentId, i + 1),
      );
      return fc.tuple(
        fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,29}[A-Za-z0-9]$/),
        statusArb,
        fc.boolean(),
        childArbs.length > 0 ? fc.tuple(...childArbs) : fc.constant([] as TaskNode[]),
      );
    })
    .map(([title, status, isOptional, children]) => ({
      id: parentId,
      title,
      status,
      isOptional,
      children: Array.isArray(children) ? (children as TaskNode[]) : [],
    }));
}

/**
 * Generate a valid TaskNode[] tree with 1-5 root tasks, each with 0-4 children.
 */
const taskTreeArb: fc.Arbitrary<TaskNode[]> = fc
  .integer({ min: 1, max: 5 })
  .chain((numRoots) => {
    const rootArbs = Array.from({ length: numRoots }, (_, i) =>
      taskWithChildrenArb(i + 1),
    );
    return fc.tuple(...rootArbs);
  })
  .map((roots) => roots as TaskNode[]);

// --- Property Tests ---

describe('Property Tests: Task Parser', () => {
  /**
   * Property 3: Task markdown parsing round-trip
   * For any valid task tree, serialize → parse produces an equivalent tree.
   */
  it('Property 3: serialize → parse round-trip preserves the task tree', () => {
    fc.assert(
      fc.property(taskTreeArb, (tasks) => {
        const markdown = serializeTaskTree(tasks);
        const result = parseTaskMarkdown(markdown);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.tasks).toEqual(tasks);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 4: Task status mapping is total and injective
   * All four checkbox strings map to unique status values.
   */
  it('Property 4: status mapping is total and injective', () => {
    const checkboxStrings = ['[ ]', '[-]', '[x]', '[!]'];
    const mappedValues = checkboxStrings.map((cb) => STATUS_MAP[cb]);

    // Total: every checkbox string maps to a defined value
    for (const val of mappedValues) {
      expect(val).toBeDefined();
      expect(['not_started', 'in_progress', 'completed', 'failed']).toContain(val);
    }

    // Injective: no two checkbox strings map to the same value
    const uniqueValues = new Set(mappedValues);
    expect(uniqueValues.size).toBe(checkboxStrings.length);
  });

  /**
   * Property 5: Task status update persists correctly
   * Update a random task's status, re-parse, verify only that task changed.
   */
  it('Property 5: updating a single task status changes only that task', () => {
    fc.assert(
      fc.property(taskTreeArb, statusArb, (tasks, newStatus) => {
        // Collect all task ids
        const allIds: string[] = [];
        const collectIds = (nodes: TaskNode[]) => {
          for (const n of nodes) {
            allIds.push(n.id);
            collectIds(n.children);
          }
        };
        collectIds(tasks);

        if (allIds.length === 0) return;

        // Pick a random task to update (deterministic from the generated data)
        const targetId = allIds[allIds.length - 1];

        // Deep clone and update the target task's status
        const cloned: TaskNode[] = JSON.parse(JSON.stringify(tasks));
        const updateInTree = (nodes: TaskNode[]) => {
          for (const n of nodes) {
            if (n.id === targetId) {
              n.status = newStatus;
              return;
            }
            updateInTree(n.children);
          }
        };
        updateInTree(cloned);

        // Serialize the modified tree, then re-parse
        const markdown = serializeTaskTree(cloned);
        const result = parseTaskMarkdown(markdown);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        // Verify the target task has the new status
        const findTask = (nodes: TaskNode[], id: string): TaskNode | undefined => {
          for (const n of nodes) {
            if (n.id === id) return n;
            const found = findTask(n.children, id);
            if (found) return found;
          }
          return undefined;
        };

        const updatedTask = findTask(result.tasks, targetId);
        expect(updatedTask?.status).toBe(newStatus);

        // Verify all other tasks are unchanged from the cloned (modified) tree
        const verifyOthers = (original: TaskNode[], parsed: TaskNode[]) => {
          expect(parsed.length).toBe(original.length);
          for (let i = 0; i < original.length; i++) {
            expect(parsed[i].id).toBe(original[i].id);
            expect(parsed[i].title).toBe(original[i].title);
            expect(parsed[i].isOptional).toBe(original[i].isOptional);
            expect(parsed[i].status).toBe(original[i].status);
            verifyOthers(original[i].children, parsed[i].children);
          }
        };
        verifyOthers(cloned, result.tasks);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 15: Graceful parse failure on malformed specs
   * Random strings never cause the parser to throw — it always returns a ParseResult.
   */
  it('Property 15: parser never throws on arbitrary input', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = parseTaskMarkdown(input);
        // Must always return a valid ParseResult (ok: true or ok: false)
        expect(typeof result.ok).toBe('boolean');
        if (result.ok) {
          expect(Array.isArray(result.tasks)).toBe(true);
        } else {
          expect(typeof result.error).toBe('string');
        }
      }),
      { numRuns: 200 },
    );
  });
});
