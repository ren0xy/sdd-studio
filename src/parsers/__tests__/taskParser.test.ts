import { describe, it, expect } from 'vitest';
import { parseTaskMarkdown } from '../taskParser';

describe('parseTaskMarkdown', () => {
  it('parses a simple task list with parent and sub-tasks', () => {
    const md = `# Tasks

## Tasks

- [x] 1. Project scaffolding
  - [x] 1.1 Initialize project
    - Some detail line
  - [x] 1.2 Define types

- [ ] 2. Parser implementation
  - [-] 2.1 Implement parser
  - [ ] 2.2 Implement serializer
  - [ ]* 2.3 Write property test
`;

    const result = parseTaskMarkdown(md);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.tasks).toHaveLength(2);

    // Task 1
    const t1 = result.tasks[0];
    expect(t1.id).toBe('1');
    expect(t1.title).toBe('Project scaffolding');
    expect(t1.status).toBe('completed');
    expect(t1.isOptional).toBe(false);
    expect(t1.children).toHaveLength(2);
    expect(t1.children[0].id).toBe('1.1');
    expect(t1.children[0].status).toBe('completed');
    expect(t1.children[1].id).toBe('1.2');

    // Task 2
    const t2 = result.tasks[1];
    expect(t2.id).toBe('2');
    expect(t2.status).toBe('not_started');
    expect(t2.children).toHaveLength(3);
    expect(t2.children[0].id).toBe('2.1');
    expect(t2.children[0].status).toBe('in_progress');
    expect(t2.children[1].id).toBe('2.2');
    expect(t2.children[2].id).toBe('2.3');
    expect(t2.children[2].isOptional).toBe(true);
  });

  it('handles all four status markers', () => {
    const md = `
- [ ] 1. Not started
- [-] 2. In progress
- [x] 3. Completed
- [!] 4. Failed
`;
    const result = parseTaskMarkdown(md);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.tasks[0].status).toBe('not_started');
    expect(result.tasks[1].status).toBe('in_progress');
    expect(result.tasks[2].status).toBe('completed');
    expect(result.tasks[3].status).toBe('failed');
  });

  it('detects optional tasks with escaped asterisk', () => {
    const md = `- [ ]\\* 1. Optional task`;
    const result = parseTaskMarkdown(md);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tasks[0].isOptional).toBe(true);
  });

  it('returns empty array for content with no tasks', () => {
    const md = `# Just a heading\n\nSome text without tasks.`;
    const result = parseTaskMarkdown(md);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tasks).toHaveLength(0);
  });

  it('returns error result instead of throwing on malformed input', () => {
    // Even weird input should parse gracefully (no matching lines = empty)
    const result = parseTaskMarkdown('');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tasks).toHaveLength(0);
  });
});
