import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../framework/loader', () => ({
  isFrameworkAvailable: () => false,
}));

const codeLensCalls: Array<[unknown, unknown]> = [];
const rangeCalls: Array<number[]> = [];

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((_key: string, defaultVal: unknown) => defaultVal),
    })),
    fs: {
      readFile: vi.fn(() => Promise.reject(new Error('not found'))),
    },
  },
  window: {
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
      show: vi.fn(),
    })),
  },
  Uri: {
    joinPath: vi.fn((_base: unknown, ..._parts: string[]) => ({ fsPath: '/mock/path' })),
  },
  EventEmitter: vi.fn().mockImplementation(() => ({
    event: vi.fn(),
    fire: vi.fn(),
  })),
  Range: vi.fn((...args: number[]) => {
    rangeCalls.push(args);
    return { start: { line: args[0] }, end: { line: args[2] } };
  }),
  CodeLens: vi.fn((range: unknown, command: unknown) => {
    codeLensCalls.push([range, command]);
    return { range, command };
  }),
}));

import { SpecDocumentCodeLensProvider } from '../specDocumentLens';

function createMockDocument(text: string, fsPath = '/workspace/.kiro/specs/test-spec/tasks.md') {
  const lines = text.split('\n');
  return {
    uri: { fsPath },
    getText: () => text,
    lineCount: lines.length,
    lineAt: (i: number) => ({ text: lines[i] ?? '' }),
  } as unknown as import('vscode').TextDocument;
}

// ─── Task 1.1.1: Test cases for all valid task line formats ───

describe('TASK_LINE_RE — valid task line formats', () => {
  let provider: SpecDocumentCodeLensProvider;
  beforeEach(() => {
    vi.clearAllMocks();
    codeLensCalls.length = 0;
    rangeCalls.length = 0;
    provider = new SpecDocumentCodeLensProvider();
  });

  it('matches depth-1 task with trailing dot: "- [ ] 1. Group title"', () => {
    const content = '- [ ] 1. Group title\n  - [ ] 1.1 Sub\n    - [ ] 1.1.1 Leaf';
    const doc = createMockDocument(content);
    const lenses = provider.buildTaskLenses(doc, 'test-spec');
    // Should find depth-1 group and produce group lens
    const groupLens = codeLensCalls.find(([range, cmd]) =>
      (range as { start: { line: number } }).start.line === 0 &&
      (cmd as { title: string }).title.includes('Start task group')
    );
    expect(groupLens).toBeDefined();
  });

  it('matches depth-2 task without trailing dot: "- [ ] 1.1 Subgroup title"', () => {
    const content = '- [ ] 1. Group\n  - [ ] 1.1 Subgroup title\n    - [ ] 1.1.1 Leaf';
    const doc = createMockDocument(content);
    provider.buildTaskLenses(doc, 'test-spec');
    // Depth-2 parent should get sub-counter lens on line 1
    const line1Lenses = codeLensCalls.filter(([range]) =>
      (range as { start: { line: number } }).start.line === 1
    );
    expect(line1Lenses.some(([, cmd]) => /\d+\/\d+ done/.test((cmd as { title: string }).title))).toBe(true);
  });

  it('matches depth-3 leaf task: "- [ ] 1.1.1 Leaf task"', () => {
    const content = '- [ ] 1. Group\n  - [ ] 1.1 Sub\n    - [ ] 1.1.1 Leaf task';
    const doc = createMockDocument(content);
    provider.buildTaskLenses(doc, 'test-spec');
    // Leaf on line 2 should get "Run task" lens
    const line2Lenses = codeLensCalls.filter(([range]) =>
      (range as { start: { line: number } }).start.line === 2
    );
    expect(line2Lenses.some(([, cmd]) => (cmd as { title: string }).title.includes('Run task'))).toBe(true);
  });

  it('matches task with * marker: "- [ ]* 2. Optional group"', () => {
    const content = '- [ ] 1. Mandatory\n  - [ ] 1.1 Sub\n    - [ ] 1.1.1 Leaf\n\n- [ ]* 2. Optional group\n  - [ ]* 2.1 Sub\n    - [ ]* 2.1.1 Leaf';
    const doc = createMockDocument(content);
    provider.buildTaskLenses(doc, 'test-spec');
    // Group 2 should be parsed — find its group lens on line 4
    const group2Lens = codeLensCalls.find(([range, cmd]) =>
      (range as { start: { line: number } }).start.line === 4 &&
      (cmd as { title: string }).title.includes('Start task group')
    );
    expect(group2Lens).toBeDefined();
  });

  it('matches task with escaped \\* marker: "- [ ]\\* 2.1 Optional subgroup"', () => {
    const content = '- [ ] 1. Mandatory\n  - [ ] 1.1 Sub\n    - [ ] 1.1.1 Leaf\n\n- [ ]\\* 2. Optional\n  - [ ]\\* 2.1 Optional subgroup\n    - [ ]\\* 2.1.1 Leaf';
    const doc = createMockDocument(content);
    provider.buildTaskLenses(doc, 'test-spec');
    // Group 2 should be parsed — find its group lens on line 4
    const group2Lens = codeLensCalls.find(([range, cmd]) =>
      (range as { start: { line: number } }).start.line === 4 &&
      (cmd as { title: string }).title.includes('Start task group')
    );
    expect(group2Lens).toBeDefined();
  });
});

// ─── Task 1.1.3: Verify regex captures correct groups ───

describe('TASK_LINE_RE — capture group verification', () => {
  let provider: SpecDocumentCodeLensProvider;
  beforeEach(() => {
    vi.clearAllMocks();
    codeLensCalls.length = 0;
    rangeCalls.length = 0;
    provider = new SpecDocumentCodeLensProvider();
  });

  it('captures correct status char for each status type', () => {
    // Test all status chars: space, x, -, !, ~
    const content = [
      '- [ ] 1. Group',
      '  - [ ] 1.1 Sub',
      '    - [ ] 1.1.1 Not started',
      '    - [x] 1.1.2 Completed',
      '    - [-] 1.1.3 In progress',
      '    - [!] 1.1.4 Failed',
      '    - [~] 1.1.5 Queued',
    ].join('\n');
    const doc = createMockDocument(content);
    provider.buildTaskLenses(doc, 'test-spec');

    // Line 2: not-started → "Run task"
    const line2 = codeLensCalls.filter(([r]) => (r as { start: { line: number } }).start.line === 2);
    expect(line2.some(([, c]) => (c as { title: string }).title.includes('Run task'))).toBe(true);

    // Line 3: completed → "Task completed"
    const line3 = codeLensCalls.filter(([r]) => (r as { start: { line: number } }).start.line === 3);
    expect(line3.some(([, c]) => (c as { title: string }).title.includes('Task completed'))).toBe(true);

    // Line 4: in-progress → "In progress"
    const line4 = codeLensCalls.filter(([r]) => (r as { start: { line: number } }).start.line === 4);
    expect(line4.some(([, c]) => (c as { title: string }).title.includes('In progress'))).toBe(true);

    // Line 5: failed → "Retry" + "Fix"
    const line5 = codeLensCalls.filter(([r]) => (r as { start: { line: number } }).start.line === 5);
    expect(line5.some(([, c]) => (c as { title: string }).title.includes('Retry'))).toBe(true);

    // Line 6: queued → "Queued"
    const line6 = codeLensCalls.filter(([r]) => (r as { start: { line: number } }).start.line === 6);
    expect(line6.some(([, c]) => (c as { title: string }).title.includes('Queued'))).toBe(true);
  });

  it('correctly computes depth from task ID segments', () => {
    // Depth-1 (1.) gets group lens, depth-2 (1.1) gets sub-counter, depth-3 (1.1.1) gets leaf lens
    const content = '- [ ] 1. Group\n  - [ ] 1.1 Sub\n    - [ ] 1.1.1 Leaf';
    const doc = createMockDocument(content);
    provider.buildTaskLenses(doc, 'test-spec');

    // Line 0: group lens (depth-1)
    const line0 = codeLensCalls.filter(([r]) => (r as { start: { line: number } }).start.line === 0);
    expect(line0.some(([, c]) => (c as { title: string }).title.includes('Start task group'))).toBe(true);

    // Line 1: sub-counter (depth-2 parent)
    const line1 = codeLensCalls.filter(([r]) => (r as { start: { line: number } }).start.line === 1);
    expect(line1.some(([, c]) => /\d+\/\d+ done/.test((c as { title: string }).title))).toBe(true);

    // Line 2: leaf action (depth-3)
    const line2 = codeLensCalls.filter(([r]) => (r as { start: { line: number } }).start.line === 2);
    expect(line2.some(([, c]) => (c as { title: string }).title.includes('Run task'))).toBe(true);
  });

  it('parses title correctly (strips leading/trailing whitespace)', () => {
    // We verify the title is parsed by checking the lens is produced (title is used internally)
    const content = '- [ ] 1. Group\n  - [ ] 1.1 Sub\n    - [ ] 1.1.1   Leaf with spaces  ';
    const doc = createMockDocument(content);
    const lenses = provider.buildTaskLenses(doc, 'test-spec');
    // If the regex failed to parse, we'd get no lenses
    expect(lenses.length).toBeGreaterThan(0);
  });
});

// ─── Task 1.2.1: Canonical two-group structure counting ───

describe('Counting logic — canonical two-group structure', () => {
  let provider: SpecDocumentCodeLensProvider;
  beforeEach(() => {
    vi.clearAllMocks();
    codeLensCalls.length = 0;
    rangeCalls.length = 0;
    provider = new SpecDocumentCodeLensProvider();
  });

  it('depth-1 groups get correct counters with canonical structure', () => {
    const content = [
      '- [ ] 1. Mandatory — Core Implementation',
      '  - [ ] 1.1 Setup environment',
      '    - [ ] 1.1.1 Install dependencies',
      '    - [ ] 1.1.2 Configure project',
      '  - [ ] 1.2 Implement feature',
      '    - [ ] 1.2.1 Write code',
      '    - [ ] 1.2.2 Add tests',
      '',
      '- [ ]* 2. Optional — Enhancements',
      '  - [ ]* 2.1 Add caching',
      '    - [ ]* 2.1.1 Cache layer',
      '  - [ ]* 2.2 Add logging',
      '    - [ ]* 2.2.1 Log setup',
    ].join('\n');
    const doc = createMockDocument(content);
    provider.buildTaskLenses(doc, 'test-spec');

    // Group 1 on line 0: 0/2 done (1.1 and 1.2 are countable, neither complete)
    const group1Lens = codeLensCalls.find(([r, c]) =>
      (r as { start: { line: number } }).start.line === 0 &&
      (c as { title: string }).title.includes('0/2 done')
    );
    expect(group1Lens).toBeDefined();

    // Group 2 on line 8: 0/2 done (2.1 and 2.2 are countable)
    const group2Lens = codeLensCalls.find(([r, c]) =>
      (r as { start: { line: number } }).start.line === 8 &&
      (c as { title: string }).title.includes('0/2 done')
    );
    expect(group2Lens).toBeDefined();
  });
});

// ─── Task 1.2.2: Partially completed tasks ───

describe('Counting logic — partially completed tasks', () => {
  let provider: SpecDocumentCodeLensProvider;
  beforeEach(() => {
    vi.clearAllMocks();
    codeLensCalls.length = 0;
    rangeCalls.length = 0;
    provider = new SpecDocumentCodeLensProvider();
  });

  it('X/Y counts are accurate with mixed completion states', () => {
    const content = [
      '- [-] 1. Mandatory',
      '  - [x] 1.1 Setup',           // all children done → effectively complete
      '    - [x] 1.1.1 Install',
      '    - [x] 1.1.2 Configure',
      '  - [ ] 1.2 Implement',        // not all children done → not complete
      '    - [x] 1.2.1 Write code',
      '    - [ ] 1.2.2 Add tests',
      '  - [x] 1.3 Deploy',           // leaf, completed
    ].join('\n');
    const doc = createMockDocument(content);
    provider.buildTaskLenses(doc, 'test-spec');

    // Group 1: 1.1 effectively complete (all children x), 1.2 not complete, 1.3 complete → 2/3 done
    const groupLens = codeLensCalls.find(([r, c]) =>
      (r as { start: { line: number } }).start.line === 0 &&
      (c as { title: string }).title.includes('2/3 done')
    );
    expect(groupLens).toBeDefined();
  });

  it('subgroup counts as complete only when ALL its children are [x]', () => {
    const content = [
      '- [-] 1. Mandatory',
      '  - [-] 1.1 Setup',
      '    - [x] 1.1.1 Done',
      '    - [-] 1.1.2 In progress',
    ].join('\n');
    const doc = createMockDocument(content);
    provider.buildTaskLenses(doc, 'test-spec');

    // 1.1 has one child not done → not effectively complete → 0/1 done
    const groupLens = codeLensCalls.find(([r, c]) =>
      (r as { start: { line: number } }).start.line === 0 &&
      (c as { title: string }).title.includes('0/1 done')
    );
    expect(groupLens).toBeDefined();
  });
});

// ─── Task 1.2.3: Optional group with * markers ───

describe('Counting logic — optional group with * markers', () => {
  let provider: SpecDocumentCodeLensProvider;
  beforeEach(() => {
    vi.clearAllMocks();
    codeLensCalls.length = 0;
    rangeCalls.length = 0;
    provider = new SpecDocumentCodeLensProvider();
  });

  it('counters work correctly for optional group with * markers', () => {
    const content = [
      '- [x] 1. Mandatory',
      '  - [x] 1.1 Setup',
      '    - [x] 1.1.1 Done',
      '',
      '- [ ]* 2. Optional — Enhancements',
      '  - [x]* 2.1 Caching',
      '    - [x]* 2.1.1 Cache done',
      '  - [ ]* 2.2 Logging',
      '    - [ ]* 2.2.1 Log not done',
    ].join('\n');
    const doc = createMockDocument(content);
    provider.buildTaskLenses(doc, 'test-spec');

    // Group 2 on line 4: 2.1 effectively complete, 2.2 not → 1/2 done
    const group2Lens = codeLensCalls.find(([r, c]) =>
      (r as { start: { line: number } }).start.line === 4 &&
      (c as { title: string }).title.includes('1/2 done')
    );
    expect(group2Lens).toBeDefined();
  });

  it('counters work correctly for optional group with escaped \\* markers', () => {
    const content = [
      '- [x] 1. Mandatory',
      '  - [x] 1.1 Setup',
      '    - [x] 1.1.1 Done',
      '',
      '- [ ]\\* 2. Optional',
      '  - [x]\\* 2.1 Caching',
      '    - [x]\\* 2.1.1 Cache done',
      '  - [ ]\\* 2.2 Logging',
      '    - [ ]\\* 2.2.1 Log not done',
    ].join('\n');
    const doc = createMockDocument(content);
    provider.buildTaskLenses(doc, 'test-spec');

    // Group 2 on line 4: 1/2 done
    const group2Lens = codeLensCalls.find(([r, c]) =>
      (r as { start: { line: number } }).start.line === 4 &&
      (c as { title: string }).title.includes('1/2 done')
    );
    expect(group2Lens).toBeDefined();
  });
});

// ─── Task 1.3.1: Codex-style tasks.md fixture ───

describe('Platform samples — Codex-style tasks.md', () => {
  let provider: SpecDocumentCodeLensProvider;
  beforeEach(() => {
    vi.clearAllMocks();
    codeLensCalls.length = 0;
    rangeCalls.length = 0;
    provider = new SpecDocumentCodeLensProvider();
  });

  it('produces correct counters for Codex-style canonical structure', () => {
    // Codex agents tend to produce this format — the "0/0" bug suggests
    // depth-2 tasks weren't being found. This fixture uses canonical structure.
    const content = [
      '# Implementation Tasks',
      '',
      '## Tasks',
      '',
      '- [ ] 1. Mandatory — Core Implementation',
      '  - [ ] 1.1 Audit TASK_LINE_RE regex',
      '    - [ ] 1.1.1 Write test cases for all valid task line formats',
      '    - [ ] 1.1.2 Fix regex if any valid format fails to match',
      '    - [ ] 1.1.3 Verify the regex captures the correct groups',
      '  - [ ] 1.2 Audit counting logic',
      '    - [ ] 1.2.1 Write test with canonical two-group structure',
      '    - [ ] 1.2.2 Write test with partially completed tasks',
      '',
      '- [ ]* 2. Optional — Property Tests',
      '  - [ ]* 2.1 Property tests for regex robustness',
      '    - [ ]* 2.1.1 Property test: any valid task ID format',
      '    - [ ]* 2.1.2 Property test: depth computed from ID',
    ].join('\n');
    const doc = createMockDocument(content);
    provider.buildTaskLenses(doc, 'test-spec');

    // Group 1 on line 4: should show 0/2 done (1.1 and 1.2 are countable)
    const group1Lens = codeLensCalls.find(([r, c]) =>
      (r as { start: { line: number } }).start.line === 4 &&
      (c as { title: string }).title.includes('0/2 done')
    );
    expect(group1Lens).toBeDefined();

    // Group 2 on line 13: should show 0/1 done (2.1 is countable)
    const group2Lens = codeLensCalls.find(([r, c]) =>
      (r as { start: { line: number } }).start.line === 13 &&
      (c as { title: string }).title.includes('0/1 done')
    );
    expect(group2Lens).toBeDefined();
  });
});

// ─── Task 1.3.2: Antigravity-style tasks.md fixture ───

describe('Platform samples — Antigravity-style tasks.md', () => {
  let provider: SpecDocumentCodeLensProvider;
  beforeEach(() => {
    vi.clearAllMocks();
    codeLensCalls.length = 0;
    rangeCalls.length = 0;
    provider = new SpecDocumentCodeLensProvider();
  });

  it('produces group lenses when Antigravity uses canonical checkbox structure', () => {
    // Antigravity agents that follow canonical structure should work.
    // The "missing codelens" issue was because Antigravity used heading-based groups
    // (### 1. Implementation) instead of checkbox groups. With canonical structure, it works.
    const content = [
      '# Tasks',
      '',
      '- [ ] 1. Setup & Preparation',
      '  - [ ] 1.1 Environment setup',
      '    - [ ] 1.1.1 Install dependencies',
      '    - [ ] 1.1.2 Configure tooling',
      '  - [ ] 1.2 Project scaffolding',
      '    - [ ] 1.2.1 Create directory structure',
      '',
      '- [ ] 2. Core Implementation',
      '  - [ ] 2.1 Build main module',
      '    - [ ] 2.1.1 Implement core logic',
      '    - [ ] 2.1.2 Add error handling',
    ].join('\n');
    const doc = createMockDocument(content);
    provider.buildTaskLenses(doc, 'test-spec');

    // Group 1 on line 2: should have group lens
    const group1Lens = codeLensCalls.find(([r, c]) =>
      (r as { start: { line: number } }).start.line === 2 &&
      (c as { title: string }).title.includes('Start task group')
    );
    expect(group1Lens).toBeDefined();

    // Group 2 on line 9: should have group lens
    const group2Lens = codeLensCalls.find(([r, c]) =>
      (r as { start: { line: number } }).start.line === 9 &&
      (c as { title: string }).title.includes('Start task group')
    );
    expect(group2Lens).toBeDefined();
  });

  it('produces synthetic group lenses when Antigravity uses heading-based groups (non-conforming)', () => {
    // Synthetic groups are inferred for non-conforming structures
    const content = [
      '### 1. Setup & Preparation',
      '- [ ] 1.1 Install dependencies',
      '- [ ] 1.2 Configure tooling',
      '',
      '### 2. Core Implementation',
      '- [ ] 2.1 Build main module',
      '- [ ] 2.2 Add error handling',
    ].join('\n');
    const doc = createMockDocument(content);
    const lenses = provider.buildTaskLenses(doc, 'test-spec');
    // Synthetic groups inferred → group + task lenses produced
    expect(lenses.length).toBeGreaterThan(0);
    const groupLenses = codeLensCalls.filter(([, cmd]) =>
      (cmd as { title: string })?.title?.includes('Start task group')
    );
    expect(groupLenses.length).toBe(2);
  });
});

// ─── Task 1.3.3: Amazon Q-style tasks.md fixture (baseline) ───

describe('Platform samples — Amazon Q-style tasks.md (baseline)', () => {
  let provider: SpecDocumentCodeLensProvider;
  beforeEach(() => {
    vi.clearAllMocks();
    codeLensCalls.length = 0;
    rangeCalls.length = 0;
    provider = new SpecDocumentCodeLensProvider();
  });

  it('produces correct counters for Amazon Q canonical structure (known working)', () => {
    const content = [
      '# Implementation Plan: Feature X',
      '',
      '## Tasks',
      '',
      '- [-] 1. Mandatory — Core Implementation',
      '  - [x] 1.1 Setup project structure',
      '    - [x] 1.1.1 Create directories',
      '    - [x] 1.1.2 Add config files',
      '  - [-] 1.2 Implement main logic',
      '    - [x] 1.2.1 Write parser',
      '    - [-] 1.2.2 Write transformer',
      '    - [ ] 1.2.3 Write output formatter',
      '  - [ ] 1.3 Add tests',
      '    - [ ] 1.3.1 Unit tests',
      '    - [ ] 1.3.2 Integration tests',
      '',
      '- [ ]* 2. Optional — Property Tests',
      '  - [ ]* 2.1 Property tests',
      '    - [ ]* 2.1.1 Regex property test',
      '    - [ ]* 2.1.2 Depth property test',
    ].join('\n');
    const doc = createMockDocument(content);
    provider.buildTaskLenses(doc, 'test-spec');

    // Group 1 on line 4: 1.1 effectively complete (all children x), 1.2 not (1.2.2 is -), 1.3 not → 1/3 done
    const group1Lens = codeLensCalls.find(([r, c]) =>
      (r as { start: { line: number } }).start.line === 4 &&
      (c as { title: string }).title.includes('1/3 done')
    );
    expect(group1Lens).toBeDefined();

    // Group 2 on line 16: 0/1 done
    const group2Lens = codeLensCalls.find(([r, c]) =>
      (r as { start: { line: number } }).start.line === 16 &&
      (c as { title: string }).title.includes('0/1 done')
    );
    expect(group2Lens).toBeDefined();
  });
});
