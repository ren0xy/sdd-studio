﻿import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockIsFrameworkAvailable = vi.fn();
vi.mock('../framework/loader', () => ({
  isFrameworkAvailable: () => mockIsFrameworkAvailable(),
}));

const codeLensCalls: Array<[unknown, unknown]> = [];
const rangeCalls: Array<number[]> = [];
let emitterFireFn = vi.fn();

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
    fire: (...args: unknown[]) => emitterFireFn(...args),
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

import {
  buildRefineInstruction,
  buildStartTaskGroupInstruction,
  buildRunTaskInstruction,
  buildRetryTaskInstruction,
  buildFixTaskInstruction,
  SpecDocumentCodeLensProvider,
} from '../specDocumentLens';

function createMockDocument(text: string, fsPath = '/workspace/.kiro/specs/test-spec/tasks.md') {
  const lines = text.split('\n');
  return {
    uri: { fsPath },
    getText: () => text,
    lineCount: lines.length,
    lineAt: (i: number) => ({ text: lines[i] ?? '' }),
  } as unknown as import('vscode').TextDocument;
}

describe('buildRefineInstruction', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it('returns instruction containing spec name and doc type when framework available', () => {
    mockIsFrameworkAvailable.mockReturnValue(true);
    const result = buildRefineInstruction('my-spec', 'requirements');
    expect(result).toContain('refine-spec');
    expect(result).toContain('my-spec');
    expect(result).toContain('requirements');
  });
  it('falls back to local string when framework unavailable', () => {
    mockIsFrameworkAvailable.mockReturnValue(false);
    const result = buildRefineInstruction('my-spec', 'design');
    expect(result).toBe('Use the refine-spec skill on the design document of spec "my-spec".');
  });
  it('produces consistent output for all doc types', () => {
    mockIsFrameworkAvailable.mockReturnValue(false);
    for (const docType of ['requirements', 'design', 'tasks'] as const) {
      const result = buildRefineInstruction('test-spec', docType);
      expect(result).toContain('refine-spec');
      expect(result).toContain('test-spec');
      expect(result).toContain(docType);
    }
  });
});

describe('buildStartTaskGroupInstruction', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it('returns instruction containing spec name and group ID when framework available', () => {
    mockIsFrameworkAvailable.mockReturnValue(true);
    const result = buildStartTaskGroupInstruction('my-spec', '1');
    expect(result).toContain('start-task-group');
    expect(result).toContain('my-spec');
    expect(result).toContain('1');
  });
  it('falls back to local string when framework unavailable', () => {
    mockIsFrameworkAvailable.mockReturnValue(false);
    const result = buildStartTaskGroupInstruction('my-spec', '2');
    expect(result).toBe('Use the start-task-group skill on group 2 of spec "my-spec".');
  });
  it('includes both specName and groupId in output regardless of framework state', () => {
    for (const available of [true, false]) {
      mockIsFrameworkAvailable.mockReturnValue(available);
      const result = buildStartTaskGroupInstruction('test-spec', '3');
      expect(result).toContain('test-spec');
      expect(result).toContain('3');
    }
  });
});

describe('buildRunTaskInstruction', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it('returns instruction containing run-task, specName, and taskId when framework available', () => {
    mockIsFrameworkAvailable.mockReturnValue(true);
    const result = buildRunTaskInstruction('my-spec', '1.2.3');
    expect(result).toContain('run-task');
    expect(result).toContain('my-spec');
    expect(result).toContain('1.2.3');
  });
  it('falls back to local string containing specName and taskId when framework unavailable', () => {
    mockIsFrameworkAvailable.mockReturnValue(false);
    const result = buildRunTaskInstruction('my-spec', '2.1');
    expect(result).toBe('Use the run-task skill to execute task 2.1 from spec "my-spec".');
  });
});

describe('buildTaskLenses', () => {
  let provider: SpecDocumentCodeLensProvider;
  beforeEach(() => {
    vi.clearAllMocks();
    codeLensCalls.length = 0;
    rangeCalls.length = 0;
    provider = new SpecDocumentCodeLensProvider();
  });
  it('returns group and leaf task lenses for a simple task structure', () => {
    const content = '# Tasks\n\n- [ ] 1. Mandatory\n  - [ ] 1.1 Setup\n    - [x] 1.1.1 Create file\n    - [-] 1.1.2 Write code\n    - [ ] 1.1.3 Test it';
    const doc = createMockDocument(content);
    const lenses = provider.buildTaskLenses(doc, 'test-spec');
    // group lens + sub-counter for 1.1 + leaf lenses for 1.1.1 (completed), 1.1.2 (in progress), 1.1.3 (▶ Run task) = 5
    expect(lenses.length).toBe(5);
  });
  it('shows Group complete when all leaf tasks are done', () => {
    const content = '- [x] 1. Mandatory\n  - [x] 1.1 Setup\n    - [x] 1.1.1 Create file\n    - [x] 1.1.2 Write code';
    const doc = createMockDocument(content);
    const lenses = provider.buildTaskLenses(doc, 'test-spec');
    // group lens + sub-counter for 1.1 + 2 leaf status lenses = 4
    expect(lenses.length).toBe(4);
    const groupLens = codeLensCalls.find(([, cmd]) => (cmd as { title: string })?.title?.includes('Group complete'));
    expect(groupLens).toBeDefined();
  });
  it('places group lens at the correct line position', () => {
    const content = '# Tasks\n\n- [ ] 1. Mandatory\n  - [ ] 1.1 Setup\n    - [ ] 1.1.1 Create file';
    const doc = createMockDocument(content);
    provider.buildTaskLenses(doc, 'test-spec');
    const groupRange = rangeCalls.find(args => args[0] === 2);
    expect(groupRange).toBeDefined();
  });
  it('returns empty array when document has no task lines', () => {
    const doc = createMockDocument('# Tasks\n\nNo tasks here.');
    const lenses = provider.buildTaskLenses(doc, 'test-spec');
    expect(lenses).toEqual([]);
  });
  it('handles multiple groups correctly', () => {
    const content = '- [ ] 1. Mandatory\n  - [ ] 1.1 Setup\n    - [x] 1.1.1 Done task\n\n- [ ] 2. Optional\n  - [ ] 2.1 Tests\n    - [ ] 2.1.1 Write tests';
    const doc = createMockDocument(content);
    const lenses = provider.buildTaskLenses(doc, 'test-spec');
    // 2 group lenses + 2 sub-counters (1.1 with ✓, 2.1 with counter) + 1 "Start subgroup" for 2.1 + 1 leaf status (1.1.1 completed) + 1 leaf run task (2.1.1) = 7
    expect(lenses.length).toBe(7);
  });
  it('depth-2 parent tasks get sub-counter lenses (not leaf action lenses)', () => {
    const content = '- [ ] 1. Mandatory\n  - [ ] 1.1 Subgroup A\n    - [x] 1.1.1 Task A1\n  - [ ] 1.2 Subgroup B\n    - [-] 1.2.1 Task B1';
    const doc = createMockDocument(content);
    provider.buildTaskLenses(doc, 'test-spec');
    // Depth-2 parents (1.1, 1.2) get sub-counter lenses on their lines
    const line1Lenses = codeLensCalls.filter(([range]) =>
      (range as { start: { line: number } }).start.line === 1
    );
    const line3Lenses = codeLensCalls.filter(([range]) =>
      (range as { start: { line: number } }).start.line === 3
    );
    // They should have sub-counter lenses (N/M done), not action lenses
    expect(line1Lenses.some(([, cmd]) => /\d+\/\d+ done/.test((cmd as { title: string }).title))).toBe(true);
    expect(line3Lenses.some(([, cmd]) => /\d+\/\d+ done/.test((cmd as { title: string }).title))).toBe(true);
  });
  it('produces synthetic group lenses for heading-based groups (non-conforming resilience)', () => {
    const content = '# Tasks\n\n### 1. Setup & Preparation\n- [ ] 1.1 Verify Node.js\n  - Requirements: 2.1\n\n### 2. Core Implementation\n- [ ] 2.1 Create script.js\n- [ ] 2.2 Implement console output';
    const doc = createMockDocument(content);
    const lenses = provider.buildTaskLenses(doc, 'test-spec');
    // Synthetic groups inferred from non-conforming structure → lenses produced
    expect(lenses.length).toBeGreaterThan(0);
  });
  it('produces Start task group for heading-based groups via synthetic inference', () => {
    const content = '### 1. Setup\n- [ ] 1.1 Task A\n- [ ] 1.2 Task B';
    const doc = createMockDocument(content);
    provider.buildTaskLenses(doc, 'test-spec');
    const startLens = codeLensCalls.find(([, cmd]) => (cmd as { title: string })?.title?.includes('Start task group'));
    expect(startLens).toBeDefined();
  });
  it('produces Group complete for heading-based groups via synthetic inference when all done', () => {
    const content = '### 1. Setup\n- [x] 1.1 Task A\n- [x] 1.2 Task B';
    const doc = createMockDocument(content);
    provider.buildTaskLenses(doc, 'test-spec');
    const completeLens = codeLensCalls.find(([, cmd]) => (cmd as { title: string })?.title?.includes('Group complete'));
    expect(completeLens).toBeDefined();
  });
});

describe('graceful degradation when framework unavailable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    codeLensCalls.length = 0;
    rangeCalls.length = 0;
  });
  it('provideCodeLenses returns document-level and task lenses for tasks.md', () => {
    mockIsFrameworkAvailable.mockReturnValue(false);
    const provider = new SpecDocumentCodeLensProvider();
    const content = '- [ ] 1. Mandatory\n  - [ ] 1.1 Setup\n    - [x] 1.1.1 Create file';
    const doc = createMockDocument(content);
    const lenses = provider.provideCodeLenses(doc);
    // 5 doc-level lenses (spec name, 3 doc tabs, refine) + group lens + sub-counter for 1.1 + leaf status = 8
    expect(lenses.length).toBe(8);
  });
  it('buildStartTaskGroupInstruction returns fallback when framework unavailable', () => {
    mockIsFrameworkAvailable.mockReturnValue(false);
    const result = buildStartTaskGroupInstruction('my-spec', '1');
    expect(result).toBe('Use the start-task-group skill on group 1 of spec "my-spec".');
  });
});

describe('SpecDocumentCodeLensProvider.refresh', () => {
  beforeEach(() => { emitterFireFn = vi.fn(); });
  it('fires _onDidChange event when refresh is called', () => {
    const provider = new SpecDocumentCodeLensProvider();
    provider.refresh();
    expect(emitterFireFn).toHaveBeenCalled();
  });
});


describe('buildRetryTaskInstruction', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls composeSkillInstruction("run-task", ...) and returns framework output when available', () => {
    mockIsFrameworkAvailable.mockReturnValue(true);
    const result = buildRetryTaskInstruction('my-spec', '1.2.3');
    expect(result).toContain('run-task');
    expect(result).toContain('my-spec');
    expect(result).toContain('1.2.3');
  });

  it('returns local fallback string containing task ID and spec name when framework unavailable', () => {
    mockIsFrameworkAvailable.mockReturnValue(false);
    const result = buildRetryTaskInstruction('my-spec', '1.2.3');
    expect(result).toContain('1.2.3');
    expect(result).toContain('my-spec');
    expect(result).toContain('mark it as in-progress');
  });
});

describe('buildFixTaskInstruction', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls composeSkillInstruction("analyze-task-failure", ...) and returns framework output when available', () => {
    mockIsFrameworkAvailable.mockReturnValue(true);
    const result = buildFixTaskInstruction('my-spec', '1', '1.2.3');
    expect(result).toContain('analyze-task-failure');
    expect(result).toContain('my-spec');
    expect(result).toContain('1.2.3');
  });

  it('returns local fallback string containing task ID, group ID, and spec name when framework unavailable', () => {
    mockIsFrameworkAvailable.mockReturnValue(false);
    const result = buildFixTaskInstruction('my-spec', '2', '2.1.1');
    expect(result).toContain('2.1.1');
    expect(result).toContain('2');
    expect(result).toContain('my-spec');
    expect(result).toContain('Analyze the failure');
  });
});

describe('buildGroupLens — group checkbox status', () => {
  let provider: SpecDocumentCodeLensProvider;
  beforeEach(() => {
    vi.clearAllMocks();
    codeLensCalls.length = 0;
    rangeCalls.length = 0;
    provider = new SpecDocumentCodeLensProvider();
  });

  it('shows "Group failed" with no clickable command when group checkbox is [!]', () => {
    const content = '- [!] 1. Mandatory\n  - [!] 1.1 Setup\n    - [!] 1.1.1 Create file\n    - [x] 1.1.2 Write code';
    const doc = createMockDocument(content);
    provider.buildTaskLenses(doc, 'test-spec');
    const failedLens = codeLensCalls.find(([, cmd]) => (cmd as { title: string })?.title?.includes('Group failed'));
    expect(failedLens).toBeDefined();
    expect((failedLens![1] as { command: string }).command).toBe('');
  });

  it('shows "Group in progress" with no clickable command when group checkbox is [-]', () => {
    const content = '- [-] 1. Mandatory\n  - [-] 1.1 Setup\n    - [x] 1.1.1 Create file\n    - [-] 1.1.2 Write code';
    const doc = createMockDocument(content);
    provider.buildTaskLenses(doc, 'test-spec');
    const progressLens = codeLensCalls.find(([, cmd]) => (cmd as { title: string })?.title?.includes('Group in progress'));
    expect(progressLens).toBeDefined();
    expect((progressLens![1] as { command: string }).command).toBe('');
  });

  it('shows "Start task group" when group checkbox is [ ]', () => {
    const content = '- [ ] 1. Mandatory\n  - [ ] 1.1 Setup\n    - [ ] 1.1.1 Create file\n    - [ ] 1.1.2 Write code';
    const doc = createMockDocument(content);
    provider.buildTaskLenses(doc, 'test-spec');
    const startLens = codeLensCalls.find(([, cmd]) => (cmd as { title: string })?.title?.includes('Start task group'));
    expect(startLens).toBeDefined();
    expect((startLens![1] as { command: string }).command).toBe('sddStudio.startTaskGroup');
  });

  it('shows "Group complete" when group checkbox is [x] and all leaf tasks done', () => {
    const content = '- [x] 1. Mandatory\n  - [x] 1.1 Setup\n    - [x] 1.1.1 Create file\n    - [x] 1.1.2 Write code';
    const doc = createMockDocument(content);
    provider.buildTaskLenses(doc, 'test-spec');
    const completeLens = codeLensCalls.find(([, cmd]) => (cmd as { title: string })?.title?.includes('Group complete'));
    expect(completeLens).toBeDefined();
  });
});

describe('dynamic leaf detection', () => {
  let provider: SpecDocumentCodeLensProvider;
  beforeEach(() => {
    vi.clearAllMocks();
    codeLensCalls.length = 0;
    rangeCalls.length = 0;
    provider = new SpecDocumentCodeLensProvider();
  });

  it('depth-2 task with no children is detected as leaf and gets CodeLens', () => {
    // 2.1.1: A depth-2 task with no depth-3 children should get a status CodeLens
    const content = '- [ ] 1. Mandatory\n  - [x] 1.1 Setup alone';
    const doc = createMockDocument(content);
    const lenses = provider.buildTaskLenses(doc, 'test-spec');
    // Should have group lens + leaf task lens for 1.1
    const leafLenses = codeLensCalls.filter(([range]) =>
      (range as { start: { line: number } }).start.line === 1
    );
    const commands = leafLenses.map(([, cmd]) => cmd as { title: string; command: string });
    expect(commands.some(c => c.title.includes('Task completed'))).toBe(true);
  });

  it('task with children is detected as parent and does NOT get leaf CodeLens', () => {
    // 2.1.2: A depth-2 task that has depth-3 children should not get leaf action lenses
    const content = '- [ ] 1. Mandatory\n  - [ ] 1.1 Setup\n    - [ ] 1.1.1 Child task';
    const doc = createMockDocument(content);
    provider.buildTaskLenses(doc, 'test-spec');
    // 1.1 is on line 1 — it's a parent, so it should get a sub-counter, not a leaf status lens
    const line1Lenses = codeLensCalls.filter(([range]) =>
      (range as { start: { line: number } }).start.line === 1
    );
    const commands = line1Lenses.map(([, cmd]) => cmd as { title: string; command: string });
    // Should NOT have leaf status labels like "Task completed", "In progress", etc.
    expect(commands.some(c => c.title.includes('Task completed'))).toBe(false);
    expect(commands.some(c => c.command === 'sddStudio.retryTask')).toBe(false);
  });

  it('depth-4 task with no children is detected as leaf and gets CodeLens', () => {
    // 2.1.3: A depth-4 task (e.g., 1.1.1.1) with no deeper children gets leaf CodeLens
    const content = '- [ ] 1. Mandatory\n  - [ ] 1.1 Setup\n    - [ ] 1.1.1 Sub\n      - [x] 1.1.1.1 Deep leaf';
    const doc = createMockDocument(content);
    provider.buildTaskLenses(doc, 'test-spec');
    // 1.1.1.1 is on line 3 — should get a leaf status lens
    const line3Lenses = codeLensCalls.filter(([range]) =>
      (range as { start: { line: number } }).start.line === 3
    );
    const commands = line3Lenses.map(([, cmd]) => cmd as { title: string; command: string });
    expect(commands.some(c => c.title.includes('Task completed'))).toBe(true);
  });
});

describe('group counter counts immediate children', () => {
  let provider: SpecDocumentCodeLensProvider;
  beforeEach(() => {
    vi.clearAllMocks();
    codeLensCalls.length = 0;
    rangeCalls.length = 0;
    provider = new SpecDocumentCodeLensProvider();
  });

  it('group with 2 depth-2 tasks (no depth-3) shows correct total', () => {
    // 2.2.1: Group counter should count depth-2 tasks as total
    const content = '- [ ] 1. Mandatory\n  - [x] 1.1 First task\n  - [ ] 1.2 Second task';
    const doc = createMockDocument(content);
    provider.buildTaskLenses(doc, 'test-spec');
    const groupLens = codeLensCalls.find(([range, cmd]) =>
      (range as { start: { line: number } }).start.line === 0 &&
      (cmd as { title: string }).title.includes('/2 done')
    );
    expect(groupLens).toBeDefined();
    // 1.1 is completed, 1.2 is not → 1/2 done
    expect((groupLens![1] as { title: string }).title).toContain('1/2 done');
  });

  it('group with depth-2 parent tasks derives effective completion from children', () => {
    // 2.2.2: A depth-2 parent task is "effectively complete" when all its children are completed
    const content = '- [ ] 1. Mandatory\n  - [ ] 1.1 Setup\n    - [x] 1.1.1 Child A\n    - [x] 1.1.2 Child B\n  - [x] 1.2 Standalone';
    const doc = createMockDocument(content);
    provider.buildTaskLenses(doc, 'test-spec');
    // 1.1 has all children completed → effectively complete. 1.2 is completed. → 2/2 → Group complete
    const groupLens = codeLensCalls.find(([range, cmd]) =>
      (range as { start: { line: number } }).start.line === 0 &&
      (cmd as { title: string }).title.includes('Group complete')
    );
    expect(groupLens).toBeDefined();
    expect((groupLens![1] as { title: string }).title).toContain('2/2');
  });
});

describe('subgroup sub-counter CodeLens', () => {
  let provider: SpecDocumentCodeLensProvider;
  beforeEach(() => {
    vi.clearAllMocks();
    codeLensCalls.length = 0;
    rangeCalls.length = 0;
    provider = new SpecDocumentCodeLensProvider();
  });

  it('depth-2 parent task gets sub-counter CodeLens showing children progress', () => {
    // 2.3.1: A depth-2 task with children should get a sub-counter lens
    const content = '- [ ] 1. Mandatory\n  - [ ] 1.1 Setup\n    - [x] 1.1.1 Done\n    - [ ] 1.1.2 Not done\n    - [x] 1.1.3 Also done';
    const doc = createMockDocument(content);
    provider.buildTaskLenses(doc, 'test-spec');
    // 1.1 is on line 1 — should get a sub-counter "2/3 done"
    const line1Lenses = codeLensCalls.filter(([range]) =>
      (range as { start: { line: number } }).start.line === 1
    );
    const subCounter = line1Lenses.find(([, cmd]) =>
      (cmd as { title: string }).title.includes('2/3 done')
    );
    expect(subCounter).toBeDefined();
  });

  it('depth-2 leaf task does NOT get sub-counter CodeLens', () => {
    // 2.3.2: A depth-2 task without children should NOT get a sub-counter
    const content = '- [ ] 1. Mandatory\n  - [x] 1.1 Standalone leaf\n  - [ ] 1.2 Another leaf';
    const doc = createMockDocument(content);
    provider.buildTaskLenses(doc, 'test-spec');
    // 1.1 is on line 1 — should get a leaf status lens, NOT a sub-counter
    const line1Lenses = codeLensCalls.filter(([range]) =>
      (range as { start: { line: number } }).start.line === 1
    );
    const commands = line1Lenses.map(([, cmd]) => cmd as { title: string });
    // Should have a status label, not a "N/M done" sub-counter
    const hasSubCounter = commands.some(c => /\d+\/\d+ done/.test(c.title));
    expect(hasSubCounter).toBe(false);
    expect(commands.some(c => c.title.includes('Task completed'))).toBe(true);
  });
});

describe('leaf task lenses', () => {
  let provider: SpecDocumentCodeLensProvider;
  beforeEach(() => {
    vi.clearAllMocks();
    codeLensCalls.length = 0;
    rangeCalls.length = 0;
    provider = new SpecDocumentCodeLensProvider();
  });

  it('shows exactly two lenses (Retry + Fix) with correct commands for failed [!] leaf task', () => {
    const content = '- [!] 1. Mandatory\n  - [!] 1.1 Setup\n    - [!] 1.1.1 Create file';
    const doc = createMockDocument(content);
    const lenses = provider.buildTaskLenses(doc, 'test-spec');
    // Filter lenses on the leaf task line (line 2)
    const leafLenses = codeLensCalls.filter(([range]) => (range as { start: { line: number } }).start.line === 2);
    const commands = leafLenses.map(([, cmd]) => cmd as { title: string; command: string; arguments: unknown[] });
    const retryLens = commands.find(c => c.title.includes('Retry'));
    const fixLens = commands.find(c => c.title.includes('Fix'));
    expect(retryLens).toBeDefined();
    expect(retryLens!.command).toBe('sddStudio.retryTask');
    expect(retryLens!.arguments).toEqual(['test-spec', '1.1.1']);
    expect(fixLens).toBeDefined();
    expect(fixLens!.command).toBe('sddStudio.fixTask');
    expect(fixLens!.arguments).toEqual(['test-spec', '1', '1.1.1']);
    expect(commands.filter(c => c.command !== '').length).toBe(2);
  });

  it('shows exactly one non-clickable lens with "Queued" for [~] leaf task', () => {
    const content = '- [-] 1. Mandatory\n  - [-] 1.1 Setup\n    - [~] 1.1.1 Create file';
    const doc = createMockDocument(content);
    provider.buildTaskLenses(doc, 'test-spec');
    const leafLenses = codeLensCalls.filter(([range]) => (range as { start: { line: number } }).start.line === 2);
    const commands = leafLenses.map(([, cmd]) => cmd as { title: string; command: string });
    expect(commands.length).toBe(1);
    expect(commands[0].title).toContain('Queued');
    expect(commands[0].command).toBe('');
  });

  it('Fix action derives group ID as first segment of task ID (task 2.3.1 → group 2)', () => {
    const content = '- [!] 2. Optional\n  - [!] 2.3 Tests\n    - [!] 2.3.1 Write tests';
    const doc = createMockDocument(content);
    provider.buildTaskLenses(doc, 'test-spec');
    const leafLenses = codeLensCalls.filter(([range]) => (range as { start: { line: number } }).start.line === 2);
    const fixLens = leafLenses.map(([, cmd]) => cmd as { title: string; command: string; arguments: unknown[] })
      .find(c => c.title.includes('Fix'));
    expect(fixLens).toBeDefined();
    expect(fixLens!.arguments![1]).toBe('2');
  });
});

describe('new CodeLens behavior — task 2.8', () => {
  let provider: SpecDocumentCodeLensProvider;
  beforeEach(() => {
    vi.clearAllMocks();
    codeLensCalls.length = 0;
    rangeCalls.length = 0;
    provider = new SpecDocumentCodeLensProvider();
  });

  it('not-started leaf task produces "Run task" lens with sddStudio.runTask command and correct arguments', () => {
    const content = '- [ ] 1. Mandatory\n  - [ ] 1.1 Setup\n    - [ ] 1.1.1 Create file';
    const doc = createMockDocument(content);
    provider.buildTaskLenses(doc, 'my-spec');
    // 1.1.1 is on line 2 — a not-started leaf task
    const line2Lenses = codeLensCalls.filter(([range]) =>
      (range as { start: { line: number } }).start.line === 2
    );
    const commands = line2Lenses.map(([, cmd]) => cmd as { title: string; command: string; arguments: unknown[] });
    const runLens = commands.find(c => c.title.includes('Run task'));
    expect(runLens).toBeDefined();
    expect(runLens!.command).toBe('sddStudio.runTask');
    expect(runLens!.arguments).toEqual(['my-spec', '1.1.1']);
  });

  it('depth-2 parent with incomplete children shows sub-counter and "Start subgroup" action', () => {
    const content = '- [ ] 1. Mandatory\n  - [ ] 1.1 Setup\n    - [x] 1.1.1 Done\n    - [ ] 1.1.2 Not done';
    const doc = createMockDocument(content);
    provider.buildTaskLenses(doc, 'test-spec');
    const line1Lenses = codeLensCalls.filter(([range]) =>
      (range as { start: { line: number } }).start.line === 1
    );
    const commands = line1Lenses.map(([, cmd]) => cmd as { title: string; command: string; arguments: unknown[] });
    // Should have a sub-counter "1/2 done"
    const counter = commands.find(c => c.title.includes('1/2 done'));
    expect(counter).toBeDefined();
    // Should have a "Start subgroup" action
    const startSubgroup = commands.find(c => c.title.includes('Start subgroup'));
    expect(startSubgroup).toBeDefined();
    expect(startSubgroup!.command).toBe('sddStudio.startTaskGroup');
    expect(startSubgroup!.arguments).toEqual(['test-spec', '1.1']);
  });

  it('completed subgroup shows "✓ N/N done" without action', () => {
    const content = '- [x] 1. Mandatory\n  - [x] 1.1 Setup\n    - [x] 1.1.1 Done A\n    - [x] 1.1.2 Done B';
    const doc = createMockDocument(content);
    provider.buildTaskLenses(doc, 'test-spec');
    const line1Lenses = codeLensCalls.filter(([range]) =>
      (range as { start: { line: number } }).start.line === 1
    );
    const commands = line1Lenses.map(([, cmd]) => cmd as { title: string; command: string });
    const completeLens = commands.find(c => c.title.includes('✓') && c.title.includes('2/2 done'));
    expect(completeLens).toBeDefined();
    expect(completeLens!.command).toBe('');
    // No "Start subgroup" action
    expect(commands.some(c => c.title.includes('Start subgroup'))).toBe(false);
  });

  it('failed subgroup shows "✗ N/M done" without action', () => {
    const content = '- [!] 1. Mandatory\n  - [!] 1.1 Setup\n    - [!] 1.1.1 Failed task\n    - [x] 1.1.2 Done task';
    const doc = createMockDocument(content);
    provider.buildTaskLenses(doc, 'test-spec');
    const line1Lenses = codeLensCalls.filter(([range]) =>
      (range as { start: { line: number } }).start.line === 1
    );
    const commands = line1Lenses.map(([, cmd]) => cmd as { title: string; command: string });
    const failedLens = commands.find(c => c.title.includes('✗') && c.title.includes('1/2 done'));
    expect(failedLens).toBeDefined();
    expect(failedLens!.command).toBe('');
    // No "Start subgroup" action
    expect(commands.some(c => c.title.includes('Start subgroup'))).toBe(false);
  });
});


describe('synthetic group inference for non-conforming structures', () => {
  let provider: SpecDocumentCodeLensProvider;
  beforeEach(() => {
    vi.clearAllMocks();
    codeLensCalls.length = 0;
    rangeCalls.length = 0;
    provider = new SpecDocumentCodeLensProvider();
  });

  it('flat 1.1, 1.2, 1.3 numbering produces group lens and task lenses', () => {
    const content = '- [ ] 1.1 First task\n- [ ] 1.2 Second task\n- [ ] 1.3 Third task';
    const doc = createMockDocument(content);
    const lenses = provider.buildTaskLenses(doc, 'test-spec');
    // Should produce at least one group lens and task lenses
    expect(lenses.length).toBeGreaterThan(0);
    const groupLens = codeLensCalls.find(([, cmd]) =>
      (cmd as { title: string })?.title?.includes('Start task group')
    );
    expect(groupLens).toBeDefined();
    // Should have task lenses for each leaf task
    const runLenses = codeLensCalls.filter(([, cmd]) =>
      (cmd as { title: string })?.title?.includes('Run task')
    );
    expect(runLenses.length).toBe(3);
  });

  it('two flat groups 1.1, 1.2, 2.1, 2.2 produces two group lenses', () => {
    const content = '- [ ] 1.1 Task A\n- [ ] 1.2 Task B\n- [ ] 2.1 Task C\n- [ ] 2.2 Task D';
    const doc = createMockDocument(content);
    const lenses = provider.buildTaskLenses(doc, 'test-spec');
    expect(lenses.length).toBeGreaterThan(0);
    const groupLenses = codeLensCalls.filter(([, cmd]) =>
      (cmd as { title: string })?.title?.includes('Start task group')
    );
    expect(groupLenses.length).toBe(2);
  });

  it('mixed depths 1.1, 1.1.1, 1.2 produces correct group and leaf lenses', () => {
    const content = '- [ ] 1.1 Setup\n  - [ ] 1.1.1 Sub-task\n- [ ] 1.2 Another task';
    const doc = createMockDocument(content);
    const lenses = provider.buildTaskLenses(doc, 'test-spec');
    expect(lenses.length).toBeGreaterThan(0);
    // Should have a group lens for synthetic group 1
    const groupLens = codeLensCalls.find(([, cmd]) =>
      (cmd as { title: string })?.title?.includes('Start task group')
    );
    expect(groupLens).toBeDefined();
    // 1.1.1 is a leaf task (depth-3), 1.2 is a leaf (depth-2 with no children)
    const runLenses = codeLensCalls.filter(([, cmd]) =>
      (cmd as { title: string })?.title?.includes('Run task')
    );
    expect(runLenses.length).toBeGreaterThanOrEqual(1);
  });
});
