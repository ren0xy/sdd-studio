import { describe, it, expect } from 'vitest';
import { isDocumentDone, countTasks, extractDescriptionFromText } from '../specUtils';

describe('isDocumentDone', () => {
  it('returns false for empty string', () => {
    expect(isDocumentDone('')).toBe(false);
  });

  it('returns false for a single heading line', () => {
    expect(isDocumentDone('# Requirements Document\n')).toBe(false);
  });

  it('returns true when content exists beyond the heading', () => {
    expect(isDocumentDone('# Requirements Document\n\nSome actual content here.')).toBe(true);
  });

  it('returns false for whitespace-only content', () => {
    expect(isDocumentDone('   \n  \n  ')).toBe(false);
  });

  it('returns true for multiple non-empty lines', () => {
    expect(isDocumentDone('# Title\n## Section\nContent')).toBe(true);
  });
});

describe('countTasks', () => {
  it('returns zeros for empty content', () => {
    expect(countTasks('')).toEqual({ tasksTotal: 0, tasksCompleted: 0 });
  });

  it('returns zeros for content with no task lines', () => {
    expect(countTasks('# Tasks\n\nJust some text.')).toEqual({ tasksTotal: 0, tasksCompleted: 0 });
  });

  it('counts flat tasks correctly', () => {
    const md = `
- [x] 1. Done task
- [ ] 2. Not started
- [-] 3. In progress
`;
    expect(countTasks(md)).toEqual({ tasksTotal: 3, tasksCompleted: 1 });
  });

  it('counts nested tasks including children', () => {
    const md = `
- [x] 1. Parent
  - [x] 1.1 Child A
  - [ ] 1.2 Child B
- [ ] 2. Another parent
`;
    expect(countTasks(md)).toEqual({ tasksTotal: 4, tasksCompleted: 2 });
  });

  it('counts all completed when everything is done', () => {
    const md = `
- [x] 1. Task one
  - [x] 1.1 Sub one
- [x] 2. Task two
`;
    expect(countTasks(md)).toEqual({ tasksTotal: 3, tasksCompleted: 3 });
  });
});

describe('extractDescriptionFromText', () => {
  it('returns empty string for empty input', () => {
    expect(extractDescriptionFromText('')).toBe('');
  });

  it('returns empty string for heading-only content', () => {
    expect(extractDescriptionFromText('# Title\n## Subtitle')).toBe('');
  });

  it('extracts first non-heading line', () => {
    const text = '# Requirements\n\nThis is the description.\n\nMore content.';
    expect(extractDescriptionFromText(text)).toBe('This is the description.');
  });

  it('truncates long descriptions to 120 chars', () => {
    const longLine = 'A'.repeat(200);
    const text = `# Title\n\n${longLine}`;
    const result = extractDescriptionFromText(text);
    expect(result.length).toBe(121); // 120 + '…'
    expect(result.endsWith('…')).toBe(true);
  });
});


// ── createSpec delegation tests ──────────────────────────────────────────

import { vi, beforeEach } from 'vitest';

vi.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
    fs: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      readDirectory: vi.fn(),
      delete: vi.fn(),
    },
    getConfiguration: vi.fn(() => ({
      get: vi.fn((_key: string, defaultVal: unknown) => defaultVal),
    })),
  },
  Uri: {
    joinPath: vi.fn((base: { fsPath: string }, ...parts: string[]) => ({
      fsPath: [base.fsPath, ...parts].join('/'),
    })),
  },
  FileType: { File: 1, Directory: 2 },
}));

const mockExecute = vi.fn();

vi.mock('../../framework/loader', () => ({
  getInstances: vi.fn(async () => ({
    createSpecCommand: { execute: mockExecute },
  })),
}));

import { createSpec } from '../specs';

describe('createSpec delegation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates to CreateSpecCommand and succeeds', async () => {
    mockExecute.mockResolvedValue({
      success: true,
      data: { path: '/workspace/.kiro/specs/my-feature', files: [] },
    });

    await expect(createSpec('my-feature')).resolves.toBeUndefined();
    expect(mockExecute).toHaveBeenCalledOnce();
    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'my-feature' })
    );
  });

  it('propagates error when CreateSpecCommand fails', async () => {
    mockExecute.mockResolvedValue({
      success: false,
      error: { message: 'Spec already exists' },
    });

    await expect(createSpec('existing-spec')).rejects.toThrow('Spec already exists');
  });

  it('throws generic message when error has no message', async () => {
    mockExecute.mockResolvedValue({ success: false });

    await expect(createSpec('bad-spec')).rejects.toThrow('Failed to create spec');
  });
});
