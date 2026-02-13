import { describe, it, expect } from 'vitest';
import { serializeTaskTree } from '../taskSerializer';
import { parseTaskMarkdown } from '../taskParser';
import { TaskNode } from '../../types';

describe('serializeTaskTree', () => {
  it('serializes a flat list of tasks', () => {
    const tasks: TaskNode[] = [
      { id: '1', title: 'First task', status: 'completed', children: [], isOptional: false },
      { id: '2', title: 'Second task', status: 'not_started', children: [], isOptional: false },
    ];

    const md = serializeTaskTree(tasks);
    expect(md).toBe('- [x] 1. First task\n\n- [ ] 2. Second task');
  });

  it('serializes tasks with children', () => {
    const tasks: TaskNode[] = [
      {
        id: '1', title: 'Parent', status: 'in_progress', children: [
          { id: '1.1', title: 'Child A', status: 'completed', children: [], isOptional: false },
          { id: '1.2', title: 'Child B', status: 'not_started', children: [], isOptional: true },
        ], isOptional: false,
      },
    ];

    const md = serializeTaskTree(tasks);
    expect(md).toContain('- [-] 1. Parent');
    expect(md).toContain('  - [x] 1.1 Child A');
    expect(md).toContain('  - [ ]* 1.2 Child B');
  });

  it('preserves the failed status marker', () => {
    const tasks: TaskNode[] = [
      { id: '1', title: 'Broken', status: 'failed', children: [], isOptional: false },
    ];
    expect(serializeTaskTree(tasks)).toBe('- [!] 1. Broken');
  });

  it('round-trips: serialize then parse produces equivalent tree', () => {
    const original: TaskNode[] = [
      {
        id: '1', title: 'Setup', status: 'completed', isOptional: false, children: [
          { id: '1.1', title: 'Init project', status: 'completed', isOptional: false, children: [] },
          { id: '1.2', title: 'Add deps', status: 'completed', isOptional: true, children: [] },
        ],
      },
      {
        id: '2', title: 'Implement', status: 'in_progress', isOptional: false, children: [
          { id: '2.1', title: 'Parser', status: 'in_progress', isOptional: false, children: [] },
          { id: '2.2', title: 'Serializer', status: 'not_started', isOptional: false, children: [] },
        ],
      },
    ];

    const md = serializeTaskTree(original);
    const result = parseTaskMarkdown(md);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tasks).toEqual(original);
  });
});
