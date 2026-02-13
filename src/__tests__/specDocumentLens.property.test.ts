import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

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

import { SpecDocumentCodeLensProvider, buildRunTaskInstruction } from '../specDocumentLens';

function createMockDocument(text: string, fsPath = '/workspace/.kiro/specs/test-spec/tasks.md') {
  const lines = text.split('\n');
  return {
    uri: { fsPath },
    getText: () => text,
    lineCount: lines.length,
    lineAt: (i: number) => ({ text: lines[i] ?? '' }),
  } as unknown as import('vscode').TextDocument;
}

/** Arbitrary for a valid task ID segment count (1-4 segments) */
const taskIdArb = fc.tuple(
  fc.integer({ min: 1, max: 9 }),
  fc.integer({ min: 1, max: 9 }),
  fc.integer({ min: 1, max: 9 }),
).map(([a, b, c]) => `${a}.${b}.${c}`);

/** Arbitrary for a spec name */
const specNameArb = fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz-'.split('')), { minLength: 1, maxLength: 15 });

/** Arbitrary for a task title */
const titleArb = fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz '.split('')), { minLength: 1, maxLength: 20 });

describe('Property Tests: Task Lifecycle CodeLens', () => {
  let provider: SpecDocumentCodeLensProvider;
  beforeEach(() => {
    vi.clearAllMocks();
    codeLensCalls.length = 0;
    rangeCalls.length = 0;
    provider = new SpecDocumentCodeLensProvider();
  });

  /**
   * Property 1: Failed tasks always get both Retry and Fix lenses
   *
   * For any tasks.md content where a leaf task has status [!], the CodeLens provider
   * SHALL produce exactly two clickable lenses for that task line: one with command
   * sddStudio.retryTask and one with command sddStudio.fixTask.
   *
   * **Validates: Requirements 1.1, 2.1**
   */
  it('Property 1: any leaf task with [!] always produces exactly 2 clickable lenses (Retry + Fix)', () => {
    fc.assert(
      fc.property(taskIdArb, titleArb, (taskId, title) => {
        codeLensCalls.length = 0;
        rangeCalls.length = 0;
        provider = new SpecDocumentCodeLensProvider();

        const groupId = taskId.split('.')[0];
        const subId = taskId.split('.').slice(0, 2).join('.');
        const content = `- [!] ${groupId}. Group\n  - [!] ${subId} Sub\n    - [!] ${taskId} ${title}`;
        const doc = createMockDocument(content);
        provider.buildTaskLenses(doc, 'test-spec');

        // Leaf task is on line 2
        const leafLenses = codeLensCalls.filter(([range]) =>
          (range as { start: { line: number } }).start.line === 2
        );
        const commands = leafLenses.map(([, cmd]) => cmd as { title: string; command: string });
        const clickable = commands.filter(c => c.command !== '');

        expect(clickable.length).toBe(2);
        expect(clickable.some(c => c.command === 'sddStudio.retryTask')).toBe(true);
        expect(clickable.some(c => c.command === 'sddStudio.fixTask')).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 2: Queued tasks get exactly one non-clickable lens
   *
   * For any tasks.md content where a leaf task has status [~], the CodeLens provider
   * SHALL produce exactly one lens for that task line with an empty command string
   * and title containing "Queued".
   *
   * **Validates: Requirements 3.1, 3.2**
   */
  it('Property 2: any leaf task with [~] always produces exactly 1 non-clickable lens', () => {
    fc.assert(
      fc.property(taskIdArb, titleArb, (taskId, title) => {
        codeLensCalls.length = 0;
        rangeCalls.length = 0;
        provider = new SpecDocumentCodeLensProvider();

        const groupId = taskId.split('.')[0];
        const subId = taskId.split('.').slice(0, 2).join('.');
        const content = `- [-] ${groupId}. Group\n  - [-] ${subId} Sub\n    - [~] ${taskId} ${title}`;
        const doc = createMockDocument(content);
        provider.buildTaskLenses(doc, 'test-spec');

        const leafLenses = codeLensCalls.filter(([range]) =>
          (range as { start: { line: number } }).start.line === 2
        );
        const commands = leafLenses.map(([, cmd]) => cmd as { title: string; command: string });

        expect(commands.length).toBe(1);
        expect(commands[0].command).toBe('');
        expect(commands[0].title).toContain('Queued');
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 3: Group CodeLens reflects checkbox status
   *
   * For any group with checkbox [!] or [-], the group CodeLens SHALL NOT have a
   * clickable "Start task group" command.
   *
   * **Validates: Requirements 4.1, 4.2**
   */
  it('Property 3: group checkbox [!] or [-] never produces a clickable "Start task group" command', () => {
    const groupStatusArb = fc.constantFrom('!' as const, '-' as const);

    fc.assert(
      fc.property(groupStatusArb, fc.integer({ min: 1, max: 9 }), titleArb, (status, groupNum, title) => {
        codeLensCalls.length = 0;
        rangeCalls.length = 0;
        provider = new SpecDocumentCodeLensProvider();

        const content = `- [${status}] ${groupNum}. ${title}\n  - [${status}] ${groupNum}.1 Sub\n    - [x] ${groupNum}.1.1 Task A\n    - [ ] ${groupNum}.1.2 Task B`;
        const doc = createMockDocument(content);
        provider.buildTaskLenses(doc, 'test-spec');

        // Group lens is on line 0
        const groupLenses = codeLensCalls.filter(([range]) =>
          (range as { start: { line: number } }).start.line === 0
        );
        const commands = groupLenses.map(([, cmd]) => cmd as { title: string; command: string });

        // No group lens should have the startTaskGroup command
        expect(commands.some(c => c.command === 'sddStudio.startTaskGroup')).toBe(false);

        if (status === '!') {
          expect(commands.some(c => c.title.includes('failed'))).toBe(true);
        } else {
          expect(commands.some(c => c.title.includes('in progress'))).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 4: Fix action group ID is always the first segment of the task ID
   *
   * For any failed leaf task with ID X.Y.Z, the Fix CodeLens SHALL pass group ID X
   * as the second argument to the sddStudio.fixTask command.
   *
   * **Validates: Requirement 2.5**
   */
  it('Property 4: Fix action group ID is always the first segment of the task ID', () => {
    fc.assert(
      fc.property(taskIdArb, titleArb, specNameArb, (taskId, title, specName) => {
        codeLensCalls.length = 0;
        rangeCalls.length = 0;
        provider = new SpecDocumentCodeLensProvider();

        const expectedGroupId = taskId.split('.')[0];
        const subId = taskId.split('.').slice(0, 2).join('.');
        const content = `- [!] ${expectedGroupId}. Group\n  - [!] ${subId} Sub\n    - [!] ${taskId} ${title}`;
        const doc = createMockDocument(content, `/workspace/.kiro/specs/${specName}/tasks.md`);
        provider.buildTaskLenses(doc, specName);

        // Find the Fix lens on the leaf task line (line 2)
        const leafLenses = codeLensCalls.filter(([range]) =>
          (range as { start: { line: number } }).start.line === 2
        );
        const fixLens = leafLenses
          .map(([, cmd]) => cmd as { title: string; command: string; arguments: unknown[] })
          .find(c => c.command === 'sddStudio.fixTask');

        expect(fixLens).toBeDefined();
        // arguments: [specName, groupId, taskId]
        expect(fixLens!.arguments[1]).toBe(expectedGroupId);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 1 (Design): Not-started leaf tasks produce a clickable "Run task" action
   *
   * For any task tree containing a leaf task with status [ ], the CodeLens provider
   * SHALL produce exactly one lens on that task's line with command sddStudio.runTask
   * and title containing "Run task", with arguments [specName, taskId].
   *
   * **Validates: Requirements 1.1, 2.8**
   */
  it('Property 1 (Design): not-started leaf tasks produce a clickable "Run task" action', () => {
    fc.assert(
      fc.property(taskIdArb, titleArb, specNameArb, (taskId, title, specName) => {
        codeLensCalls.length = 0;
        rangeCalls.length = 0;
        provider = new SpecDocumentCodeLensProvider();

        const groupId = taskId.split('.')[0];
        const subId = taskId.split('.').slice(0, 2).join('.');
        // Group and sub are not-started, leaf is not-started [ ]
        const content = `- [ ] ${groupId}. Group\n  - [ ] ${subId} Sub\n    - [ ] ${taskId} ${title}`;
        const doc = createMockDocument(content, `/workspace/.kiro/specs/${specName}/tasks.md`);
        provider.buildTaskLenses(doc, specName);

        // Leaf task is on line 2
        const leafLenses = codeLensCalls.filter(([range]) =>
          (range as { start: { line: number } }).start.line === 2
        );
        const commands = leafLenses.map(([, cmd]) => cmd as { title: string; command: string; arguments: unknown[] });

        // Should have exactly one lens with "Run task"
        const runTaskLenses = commands.filter(c => c.command === 'sddStudio.runTask');
        expect(runTaskLenses.length).toBe(1);
        expect(runTaskLenses[0].title).toContain('Run task');
        expect(runTaskLenses[0].arguments).toEqual([specName, taskId]);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 8: buildRunTaskInstruction output contains specName and taskId
   *
   * For any specName and taskId, buildRunTaskInstruction(specName, taskId) SHALL
   * return a string containing both the specName and taskId, regardless of whether
   * the sdd-framework is available.
   *
   * **Validates: Requirements 3.2, 3.3**
   */
  it('Property 8: buildRunTaskInstruction output always contains specName and taskId', () => {
    fc.assert(
      fc.property(specNameArb, taskIdArb, (specName, taskId) => {
        const result = buildRunTaskInstruction(specName, taskId);
        expect(result).toContain(specName);
        expect(result).toContain(taskId);
      }),
      { numRuns: 100 },
    );
  });
});

describe('Property 5: Depth-2 parent sub-counter reflects children aggregate status', () => {
  let provider: SpecDocumentCodeLensProvider;
  beforeEach(() => {
    vi.clearAllMocks();
    codeLensCalls.length = 0;
    rangeCalls.length = 0;
    provider = new SpecDocumentCodeLensProvider();
  });

  /** Arbitrary for child status characters */
  const childStatusArb = fc.constantFrom(' ', 'x', '-', '!', '~');

  /**
   * Property 5: Depth-2 parent sub-counter reflects children's aggregate status
   *
   * For any depth-2 parent task (has children), the sub-counter CodeLens SHALL show:
   * - `✓ N/N done` when all children complete
   * - `✗ N/M done` when any child failed
   * - `→ N/M done` when any child in-progress (and none failed)
   * - `N/M done` + `▶ Start subgroup` action when actionable (no failures, no in-progress)
   *
   * **Validates: Requirements 1.3, 4.1, 4.2, 4.3**
   */
  it('Property 5: depth-2 parent sub-counter reflects children aggregate status', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9 }),
        fc.array(childStatusArb, { minLength: 1, maxLength: 5 }),
        specNameArb,
        (groupNum, childStatuses, specName) => {
          codeLensCalls.length = 0;
          rangeCalls.length = 0;
          provider = new SpecDocumentCodeLensProvider();

          const subId = `${groupNum}.1`;
          // Build children lines
          const childLines = childStatuses.map((s, i) =>
            `    - [${s}] ${subId}.${i + 1} Child ${i + 1}`
          ).join('\n');

          // Determine group status based on children
          const anyFailed = childStatuses.some(s => s === '!');
          const anyInProgress = childStatuses.some(s => s === '-');
          const allComplete = childStatuses.every(s => s === 'x');
          let groupStatus = ' ';
          if (anyFailed) groupStatus = '!';
          else if (anyInProgress) groupStatus = '-';
          else if (allComplete) groupStatus = 'x';

          const content = `- [${groupStatus}] ${groupNum}. Group\n  - [${groupStatus}] ${subId} Sub\n${childLines}`;
          const doc = createMockDocument(content, `/workspace/.kiro/specs/${specName}/tasks.md`);
          provider.buildTaskLenses(doc, specName);

          // Sub-counter lens is on line 1 (the depth-2 parent)
          const subLenses = codeLensCalls.filter(([range]) =>
            (range as { start: { line: number } }).start.line === 1
          );
          const commands = subLenses.map(([, cmd]) => cmd as { title: string; command: string; arguments: unknown[] });

          const completedCount = childStatuses.filter(s => s === 'x').length;
          const totalCount = childStatuses.length;

          if (allComplete) {
            // ✓ N/N done, no action
            expect(commands.some(c => c.title === `✓ ${completedCount}/${totalCount} done`)).toBe(true);
            expect(commands.some(c => c.command === 'sddStudio.startTaskGroup')).toBe(false);
          } else if (anyFailed) {
            // ✗ N/M done, no action
            expect(commands.some(c => c.title === `✗ ${completedCount}/${totalCount} done`)).toBe(true);
            expect(commands.some(c => c.command === 'sddStudio.startTaskGroup')).toBe(false);
          } else if (anyInProgress) {
            // → N/M done, no action
            expect(commands.some(c => c.title === `→ ${completedCount}/${totalCount} done`)).toBe(true);
            expect(commands.some(c => c.command === 'sddStudio.startTaskGroup')).toBe(false);
          } else {
            // N/M done + ▶ Start subgroup action
            expect(commands.some(c => c.title === `${completedCount}/${totalCount} done`)).toBe(true);
            const startSubgroup = commands.find(c => c.command === 'sddStudio.startTaskGroup');
            expect(startSubgroup).toBeDefined();
            expect(startSubgroup!.title).toContain('Start subgroup');
            expect(startSubgroup!.arguments).toEqual([specName, subId]);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});


describe('Property 6: "Run task" lens arguments match specName and taskId', () => {
  let provider: SpecDocumentCodeLensProvider;
  beforeEach(() => {
    vi.clearAllMocks();
    codeLensCalls.length = 0;
    rangeCalls.length = 0;
    provider = new SpecDocumentCodeLensProvider();
  });

  /** Arbitrary for a valid task ID segment count (1-4 segments) */
  const taskIdArb = fc.tuple(
    fc.integer({ min: 1, max: 9 }),
    fc.integer({ min: 1, max: 9 }),
    fc.integer({ min: 1, max: 9 }),
  ).map(([a, b, c]) => `${a}.${b}.${c}`);

  /** Arbitrary for a spec name */
  const specNameArb = fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz-'.split('')), { minLength: 1, maxLength: 15 });

  /** Arbitrary for a task title */
  const titleArb = fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz '.split('')), { minLength: 1, maxLength: 20 });

  /**
   * Property 6: "Run task" lens arguments match specName and taskId
   *
   * For any specName and taskId combination, the ▶ Run task CodeLens on a not-started
   * leaf task SHALL pass [specName, taskId] as the command arguments to sddStudio.runTask.
   *
   * **Validates: Requirements 1.5**
   */
  it('Property 6: "Run task" lens arguments match specName and taskId', () => {
    fc.assert(
      fc.property(taskIdArb, titleArb, specNameArb, (taskId, title, specName) => {
        codeLensCalls.length = 0;
        rangeCalls.length = 0;
        provider = new SpecDocumentCodeLensProvider();

        const groupId = taskId.split('.')[0];
        const subId = taskId.split('.').slice(0, 2).join('.');
        const content = `- [ ] ${groupId}. Group\n  - [ ] ${subId} Sub\n    - [ ] ${taskId} ${title}`;
        const doc = createMockDocument(content, `/workspace/.kiro/specs/${specName}/tasks.md`);
        provider.buildTaskLenses(doc, specName);

        // Find the Run task lens on the leaf task line (line 2)
        const leafLenses = codeLensCalls.filter(([range]) =>
          (range as { start: { line: number } }).start.line === 2
        );
        const runTaskLens = leafLenses
          .map(([, cmd]) => cmd as { title: string; command: string; arguments: unknown[] })
          .find(c => c.command === 'sddStudio.runTask');

        expect(runTaskLens).toBeDefined();
        expect(runTaskLens!.arguments).toHaveLength(2);
        expect(runTaskLens!.arguments[0]).toBe(specName);
        expect(runTaskLens!.arguments[1]).toBe(taskId);
      }),
      { numRuns: 100 },
    );
  });
});



describe('Property 7: "Start subgroup" lens passes subgroup ID as groupId', () => {
  let provider: SpecDocumentCodeLensProvider;
  beforeEach(() => {
    vi.clearAllMocks();
    codeLensCalls.length = 0;
    rangeCalls.length = 0;
    provider = new SpecDocumentCodeLensProvider();
  });

  /** Arbitrary for a group number */
  const groupNumArb = fc.integer({ min: 1, max: 9 });

  /** Arbitrary for a subgroup number */
  const subNumArb = fc.integer({ min: 1, max: 9 });

  /** Arbitrary for a spec name */
  const specNameArb = fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz-'.split('')), { minLength: 1, maxLength: 15 });

  /** Arbitrary for number of incomplete children */
  const childCountArb = fc.integer({ min: 1, max: 5 });

  /**
   * Property 7: "Start subgroup" lens passes subgroup ID as groupId
   *
   * For any depth-2 parent task with ID X.Y that has incomplete children,
   * the ▶ Start subgroup CodeLens SHALL invoke sddStudio.startTaskGroup
   * with the subgroup's task ID (e.g., "1.2") as the groupId argument.
   *
   * **Validates: Requirements 4.4**
   */
  it('Property 7: "Start subgroup" lens passes subgroup ID as groupId', () => {
    fc.assert(
      fc.property(groupNumArb, subNumArb, childCountArb, specNameArb, (groupNum, subNum, childCount, specName) => {
        codeLensCalls.length = 0;
        rangeCalls.length = 0;
        provider = new SpecDocumentCodeLensProvider();

        const subId = `${groupNum}.${subNum}`;
        // All children are not-started so the subgroup is actionable
        const childLines = Array.from({ length: childCount }, (_, i) =>
          `    - [ ] ${subId}.${i + 1} Child ${i + 1}`
        ).join('\n');

        const content = `- [ ] ${groupNum}. Group\n  - [ ] ${subId} Sub\n${childLines}`;
        const doc = createMockDocument(content, `/workspace/.kiro/specs/${specName}/tasks.md`);
        provider.buildTaskLenses(doc, specName);

        // Sub-counter lens is on line 1 (the depth-2 parent)
        const subLenses = codeLensCalls.filter(([range]) =>
          (range as { start: { line: number } }).start.line === 1
        );
        const commands = subLenses.map(([, cmd]) => cmd as { title: string; command: string; arguments: unknown[] });

        const startSubgroup = commands.find(c => c.command === 'sddStudio.startTaskGroup');
        expect(startSubgroup).toBeDefined();
        expect(startSubgroup!.title).toContain('Start subgroup');
        expect(startSubgroup!.arguments).toHaveLength(2);
        expect(startSubgroup!.arguments[0]).toBe(specName);
        expect(startSubgroup!.arguments[1]).toBe(subId);
      }),
      { numRuns: 100 },
    );
  });
});


describe('Property Tests: Regex Robustness (Spec 010)', () => {
  let provider: SpecDocumentCodeLensProvider;
  beforeEach(() => {
    vi.clearAllMocks();
    codeLensCalls.length = 0;
    rangeCalls.length = 0;
    provider = new SpecDocumentCodeLensProvider();
  });

  /** Arbitrary for valid status characters */
  const statusCharArb = fc.constantFrom(' ', 'x', '-', '!', '~');

  /** Arbitrary for optional marker (none, *, \*) */
  const markerArb = fc.constantFrom('', '*', '\\*');

  /** Arbitrary for a task title */
  const titleArb = fc.stringOf(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz '.split('')),
    { minLength: 1, maxLength: 20 },
  );

  /** Arbitrary for a spec name */
  const specNameArb = fc.stringOf(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz-'.split('')),
    { minLength: 1, maxLength: 15 },
  );

  /**
   * Arbitrary that produces a valid task ID at a given depth:
   * depth 1 → "N", depth 2 → "N.N", depth 3 → "N.N.N"
   */
  const taskIdOfDepthArb = (depth: number) =>
    fc.tuple(...Array.from({ length: depth }, () => fc.integer({ min: 1, max: 9 })))
      .map(segments => segments.join('.'));

  /**
   * Property test 2.1.1: any valid task ID format (N, N.N, N.N.N) with any
   * status char produces a match.
   *
   * For any combination of depth (1-3), valid status character, and optional
   * marker, a well-formed task line SHALL be parsed by buildTaskLenses and
   * produce at least one CodeLens on that line.
   *
   * **Validates: Requirements 1, 2, 3**
   */
  it('2.1.1 any valid task ID format with any status char produces a regex match', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3 }),
        statusCharArb,
        markerArb,
        titleArb,
        specNameArb,
        (depth, status, marker, title, specName) => {
          codeLensCalls.length = 0;
          rangeCalls.length = 0;
          provider = new SpecDocumentCodeLensProvider();

          // Build a valid task ID for the requested depth
          const segments = Array.from({ length: depth }, (_, i) => i + 1);
          const taskId = segments.join('.');

          // Build the task line — depth-1 IDs use trailing dot, others use space
          const separator = depth === 1 ? '.' : '';
          const line = `- [${status}]${marker} ${taskId}${separator} ${title}`;

          // For depth > 1, we need parent lines so the structure is valid
          let content: string;
          if (depth === 1) {
            content = line;
          } else if (depth === 2) {
            const parentId = segments[0].toString();
            content = `- [ ] ${parentId}. Parent\n  ${line}`;
          } else {
            // depth === 3
            const parentId = segments[0].toString();
            const subId = segments.slice(0, 2).join('.');
            content = `- [ ] ${parentId}. Parent\n  - [ ] ${subId} Sub\n    ${line}`;
          }

          const doc = createMockDocument(
            content,
            `/workspace/.kiro/specs/${specName}/tasks.md`,
          );
          provider.buildTaskLenses(doc, specName);

          // The task line should have produced at least one CodeLens
          const targetLine = depth - 1; // 0-indexed line where our task appears
          const lensesOnLine = codeLensCalls.filter(([range]) =>
            (range as { start: { line: number } }).start.line === targetLine,
          );

          expect(lensesOnLine.length).toBeGreaterThanOrEqual(1);
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * Property test 2.1.2: depth computed from ID always equals number of
   * dot-separated segments.
   *
   * For any valid task ID with 1-3 segments, the depth assigned by
   * buildTaskLenses (observable via which CodeLens type is produced) SHALL
   * equal the number of dot-separated segments in the ID.
   *
   * We verify this indirectly: depth-1 tasks get group lenses (counter + start),
   * depth-2 parent tasks get sub-counter lenses, and depth-3 leaf tasks get
   * per-task action lenses. The lens type on each line confirms correct depth.
   *
   * **Validates: Requirements 1, 3**
   */
  it('2.1.2 depth computed from ID always equals number of dot-separated segments', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9 }),
        fc.integer({ min: 1, max: 9 }),
        fc.integer({ min: 1, max: 9 }),
        specNameArb,
        (g, s, l, specName) => {
          codeLensCalls.length = 0;
          rangeCalls.length = 0;
          provider = new SpecDocumentCodeLensProvider();

          const groupId = `${g}`;
          const subId = `${g}.${s}`;
          const leafId = `${g}.${s}.${l}`;

          const content = [
            `- [ ] ${groupId}. Group`,
            `  - [ ] ${subId} Subgroup`,
            `    - [ ] ${leafId} Leaf task`,
          ].join('\n');

          const doc = createMockDocument(
            content,
            `/workspace/.kiro/specs/${specName}/tasks.md`,
          );
          provider.buildTaskLenses(doc, specName);

          // Line 0 = depth-1 group → should have group counter lens (X/Y done)
          const groupLenses = codeLensCalls
            .filter(([range]) => (range as { start: { line: number } }).start.line === 0)
            .map(([, cmd]) => cmd as { title: string; command: string });
          expect(groupLenses.some(c => c.title.includes('done'))).toBe(true);

          // Line 1 = depth-2 subgroup → should have sub-counter lens (X/Y done)
          const subLenses = codeLensCalls
            .filter(([range]) => (range as { start: { line: number } }).start.line === 1)
            .map(([, cmd]) => cmd as { title: string; command: string });
          expect(subLenses.some(c => c.title.includes('done'))).toBe(true);

          // Line 2 = depth-3 leaf → should have per-task action lens (Run task)
          const leafLenses = codeLensCalls
            .filter(([range]) => (range as { start: { line: number } }).start.line === 2)
            .map(([, cmd]) => cmd as { title: string; command: string });
          expect(leafLenses.some(c => c.command === 'sddStudio.runTask')).toBe(true);

          // Verify depth = segment count by checking ID segment counts
          expect(groupId.split('.').length).toBe(1);
          expect(subId.split('.').length).toBe(2);
          expect(leafId.split('.').length).toBe(3);
        },
      ),
      { numRuns: 200 },
    );
  });
});


describe('Property Tests: Resilient CodeLens Task Parsing (Spec 011)', () => {
  let provider: SpecDocumentCodeLensProvider;
  beforeEach(() => {
    vi.clearAllMocks();
    codeLensCalls.length = 0;
    rangeCalls.length = 0;
    provider = new SpecDocumentCodeLensProvider();
  });

  /** Status characters for task checkboxes */
  const statusCharArb = fc.constantFrom(' ', 'x', '-', '!', '~');

  /**
   * Arbitrary that generates a non-empty list of depth-2 tasks (no depth-1 parents)
   * grouped under 1-3 distinct first-segments. This represents a non-conforming
   * task structure that requires synthetic group inference.
   */
  const flatTaskListArb = fc.tuple(
    fc.integer({ min: 1, max: 3 }), // number of groups
    fc.array(
      fc.tuple(statusCharArb, fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz '.split('')), { minLength: 1, maxLength: 15 })),
      { minLength: 1, maxLength: 4 },
    ), // tasks per group
  ).map(([numGroups, taskTemplates]) => {
    const lines: string[] = [];
    for (let g = 1; g <= numGroups; g++) {
      for (let t = 0; t < taskTemplates.length; t++) {
        const [status, title] = taskTemplates[t];
        lines.push(`- [${status}] ${g}.${t + 1} ${title}`);
      }
    }
    return { content: lines.join('\n'), numGroups, tasksPerGroup: taskTemplates.length, taskTemplates };
  });

  /**
   * Arbitrary that generates a conforming task structure with explicit depth-1 groups.
   */
  const conformingTaskListArb = fc.tuple(
    fc.integer({ min: 1, max: 3 }),
    fc.array(
      fc.tuple(statusCharArb, fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz '.split('')), { minLength: 1, maxLength: 15 })),
      { minLength: 1, maxLength: 4 },
    ),
  ).map(([numGroups, taskTemplates]) => {
    const lines: string[] = [];
    for (let g = 1; g <= numGroups; g++) {
      lines.push(`- [ ] ${g}. Group ${g}`);
      for (let t = 0; t < taskTemplates.length; t++) {
        const [status, title] = taskTemplates[t];
        lines.push(`  - [${status}] ${g}.${t + 1} ${title}`);
      }
    }
    return { content: lines.join('\n'), numGroups };
  });

  /**
   * Combined arbitrary: either conforming or non-conforming task list.
   * This tests that ANY valid task list produces at least one group lens.
   */
  const anyTaskListArb = fc.oneof(
    flatTaskListArb.map(t => ({ content: t.content, numGroups: t.numGroups, isConforming: false })),
    conformingTaskListArb.map(t => ({ content: t.content, numGroups: t.numGroups, isConforming: true })),
  );

  /**
   * Property 2.1.1: Any valid task list (with or without depth-1 entries)
   * produces at least one group lens.
   *
   * For any non-empty task list — whether it has explicit depth-1 group headers
   * (conforming) or only depth-2+ tasks (non-conforming) — buildTaskLenses SHALL
   * produce at least one CodeLens whose title contains "done" or "Group" or
   * "Start task group" or "Group complete", indicating a group-level lens was created.
   *
   * **Validates: Requirements 1**
   */
  it('2.1.1 any valid task list (with or without depth-1 entries) produces at least one group lens', () => {
    fc.assert(
      fc.property(anyTaskListArb, ({ content, numGroups }) => {
        codeLensCalls.length = 0;
        rangeCalls.length = 0;
        provider = new SpecDocumentCodeLensProvider();

        const doc = createMockDocument(content);
        const lenses = provider.buildTaskLenses(doc, 'test-spec');

        // Must produce at least one lens
        expect(lenses.length).toBeGreaterThan(0);

        // Must produce at least one group-level lens (identified by group-related titles)
        const groupLenses = codeLensCalls.filter(([, cmd]) => {
          const title = (cmd as { title: string })?.title ?? '';
          return title.includes('done') ||
                 title.includes('Start task group') ||
                 title.includes('Group complete') ||
                 title.includes('Group failed') ||
                 title.includes('Group in progress');
        });
        expect(groupLenses.length).toBeGreaterThanOrEqual(numGroups);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * Property 2.1.2: Synthetic groups have correct status aggregation from children.
   *
   * For any non-conforming task list (no depth-1 entries), the synthetic group's
   * status in the group lens SHALL correctly reflect the aggregate of its children:
   * - All children [x] → "Group complete"
   * - Any child [!] → "Group failed"
   * - Any child [-] (no [!]) → "Group in progress"
   * - Otherwise → "Start task group" (actionable)
   *
   * **Validates: Requirements 1**
   */
  it('2.1.2 synthetic groups have correct status aggregation from children', () => {
    fc.assert(
      fc.property(
        fc.array(statusCharArb, { minLength: 1, maxLength: 6 }),
        (statuses) => {
          codeLensCalls.length = 0;
          rangeCalls.length = 0;
          provider = new SpecDocumentCodeLensProvider();

          // Build a flat (non-conforming) task list under group 1
          const lines = statuses.map((s, i) => `- [${s}] 1.${i + 1} Task ${i + 1}`);
          const content = lines.join('\n');
          const doc = createMockDocument(content);
          provider.buildTaskLenses(doc, 'test-spec');

          // Find the group-level lens (should be on line 0, where synthetic group is placed)
          const groupLenses = codeLensCalls.filter(([range]) =>
            (range as { start: { line: number } }).start.line === 0
          );
          const titles = groupLenses.map(([, cmd]) => (cmd as { title: string }).title);

          const allDone = statuses.every(s => s === 'x');
          const anyFailed = statuses.some(s => s === '!');
          const anyInProgress = statuses.some(s => s === '-');

          if (allDone) {
            expect(titles.some(t => t.includes('Group complete'))).toBe(true);
          } else if (anyFailed) {
            expect(titles.some(t => t.includes('Group failed'))).toBe(true);
          } else if (anyInProgress) {
            expect(titles.some(t => t.includes('Group in progress'))).toBe(true);
          } else {
            expect(titles.some(t => t.includes('Start task group'))).toBe(true);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
