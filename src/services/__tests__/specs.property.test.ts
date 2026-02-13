import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// In-memory filesystem for testing spec operations
const fileSystem = new Map<string, Uint8Array>();

vi.mock('vscode', () => {
  const jp = (base: string, ...parts: string[]): string => {
    let r = base;
    for (const p of parts) {
      r = r.endsWith('/') ? r + p : r + '/' + p;
    }
    return r;
  };
  return {
    workspace: {
      workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
      fs: {
        readFile: vi.fn(async (uri: { fsPath: string }) => {
          const content = fileSystem.get(uri.fsPath);
          if (!content) throw new Error(`File not found: ${uri.fsPath}`);
          return content;
        }),
        writeFile: vi.fn(async (uri: { fsPath: string }, content: Uint8Array) => {
          fileSystem.set(uri.fsPath, content);
        }),
        readDirectory: vi.fn(async (uri: { fsPath: string }) => {
          const prefix = uri.fsPath.endsWith('/') ? uri.fsPath : uri.fsPath + '/';
          const entries = new Map<string, number>();
          for (const key of fileSystem.keys()) {
            if (key.startsWith(prefix)) {
              const rest = key.slice(prefix.length);
              const name = rest.split('/')[0];
              if (rest.includes('/')) {
                entries.set(name, 2);
              } else {
                entries.set(name, 1);
              }
            }
          }
          return Array.from(entries.entries());
        }),
        delete: vi.fn(async (uri: { fsPath: string }) => {
          for (const key of [...fileSystem.keys()]) {
            if (key === uri.fsPath || key.startsWith(uri.fsPath + '/')) {
              fileSystem.delete(key);
            }
          }
        }),
      },
      getConfiguration: vi.fn(() => ({
        get: vi.fn((_key: string, defaultVal: unknown) => defaultVal),
      })),
    },
    Uri: {
      joinPath: vi.fn((base: { fsPath: string }, ...parts: string[]) => ({
        fsPath: jp(base.fsPath, ...parts),
      })),
    },
    FileType: { File: 1, Directory: 2 },
  };
});

// Mock the framework loader — createSpecCommand.execute writes the files
const mockExecute = vi.fn();

vi.mock('../../framework/loader', () => ({
  getInstances: vi.fn(async () => ({
    createSpecCommand: {
      execute: mockExecute,
    },
    fsBridge: {},
  })),
}));

import { createSpec } from '../specs';
import { isDocumentDone, countTasks } from '../specUtils';

describe('Property Tests: Spec Management', () => {
  const encoder = new TextEncoder();

  beforeEach(() => {
    fileSystem.clear();
    vi.clearAllMocks();
  });

  /**
   * Property 1: Spec creation produces complete folder structure
   */
  it('Property 1: spec creation produces complete folder structure', async () => {
    const validNameArb = fc.stringMatching(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);

    await fc.assert(
      fc.asyncProperty(validNameArb, async (name) => {
        fileSystem.clear();

        // Mock framework CreateSpecCommand to write all spec files
        mockExecute.mockImplementation(async (options: { name: string }) => {
          const specsRoot = `/workspace/.kiro/specs/${options.name}`;
          fileSystem.set(`${specsRoot}/.config.kiro`, encoder.encode('{"generationMode":"requirements-first"}'));
          fileSystem.set(`${specsRoot}/requirements.md`, encoder.encode('# Requirements Document\n'));
          fileSystem.set(`${specsRoot}/design.md`, encoder.encode('# Design Document\n'));
          fileSystem.set(`${specsRoot}/tasks.md`, encoder.encode('# Implementation Plan\n'));
          return { success: true, data: { path: specsRoot, files: ['.config.kiro', 'requirements.md', 'design.md', 'tasks.md'] } };
        });

        await createSpec(name);

        const specsRoot = `/workspace/.kiro/specs/${name}`;
        const requiredFiles = ['.config.kiro', 'requirements.md', 'design.md', 'tasks.md'];

        for (const file of requiredFiles) {
          const path = `${specsRoot}/${file}`;
          expect(fileSystem.has(path)).toBe(true);
        }

        // Verify no extra files were created in the spec folder
        const specFiles = Array.from(fileSystem.keys()).filter(k =>
          k.startsWith(specsRoot + '/'),
        );
        expect(specFiles.length).toBe(requiredFiles.length);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 7: Failed spec creation propagates error message
   * For any error message in a CreateSpecResult with success: false,
   * the error thrown by createSpec() contains that message as a substring.
   *
   * **Validates: Requirements 6.2**
   */
  it('Property 7: Failed spec creation propagates error message', async () => {
    const errorMsgArb = fc.stringOf(fc.char(), { minLength: 1, maxLength: 80 });

    await fc.assert(
      fc.asyncProperty(errorMsgArb, async (errorMsg) => {
        fileSystem.clear();
        mockExecute.mockResolvedValue({ success: false, error: { message: errorMsg } });

        let threw = false;
        try {
          await createSpec('test-spec');
        } catch (e) {
          threw = true;
          expect((e as Error).message).toContain(errorMsg);
        }
        expect(threw).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 2: Spec status computation reflects document state
   */
  it('Property 2: isDocumentDone correctly reflects content state', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const result = isDocumentDone(text);
        const nonEmptyLines = text
          .trim()
          .split('\n')
          .filter(l => l.trim().length > 0);
        expect(result).toBe(nonEmptyLines.length > 1);
      }),
      { numRuns: 200 },
    );
  });

  it('Property 2: countTasks correctly counts total and completed tasks', () => {
    const statusCharArb = fc.constantFrom(' ', '-', 'x', '!');
    const taskLineArb = (id: string) =>
      statusCharArb.map(s => ({ line: `- [${s}] ${id} Task ${id}`, completed: s === 'x' }));

    const taskSetArb = fc
      .integer({ min: 1, max: 10 })
      .chain(n => fc.tuple(...Array.from({ length: n }, (_, i) => taskLineArb(`${i + 1}.`))));

    fc.assert(
      fc.property(taskSetArb, (taskEntries) => {
        const entries = taskEntries as { line: string; completed: boolean }[];
        const markdown = entries.map(e => e.line).join('\n');
        const expectedTotal = entries.length;
        const expectedCompleted = entries.filter(e => e.completed).length;

        const result = countTasks(markdown);
        expect(result.tasksTotal).toBe(expectedTotal);
        expect(result.tasksCompleted).toBe(expectedCompleted);
      }),
      { numRuns: 100 },
    );
  });
});
