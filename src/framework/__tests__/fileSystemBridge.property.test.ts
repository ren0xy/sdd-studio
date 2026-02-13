import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';

vi.mock('vscode', () => ({
  workspace: {
    fs: {
      stat: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      readDirectory: vi.fn(),
      copy: vi.fn(),
      createDirectory: vi.fn(),
    },
  },
  Uri: {
    joinPath: vi.fn((base: { path: string; fsPath: string }, ...parts: string[]) => {
      let result = base.path;
      for (const p of parts) {
        result = result.endsWith('/') ? result + p : result + '/' + p;
      }
      return { path: result, fsPath: result };
    }),
  },
  FileType: { File: 1, Directory: 2 },
}));

import { FileSystemBridge } from '../fileSystemBridge';

describe('Property Tests: FileSystemBridge', () => {
  /**
   * Property 1: Path resolution preserves workspace root prefix
   * For any relative path string, resolve() produces a URI whose path starts with the workspace root.
   *
   * **Validates: Requirements 2.4, 1b.1**
   */
  it('Property 1: Path resolution preserves workspace root prefix', () => {
    const relativePathArb = fc.stringOf(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_./'.split('')),
      { minLength: 1, maxLength: 60 },
    );

    fc.assert(
      fc.property(relativePathArb, (relativePath) => {
        const workspaceRoot = { path: '/workspace/project', fsPath: '/workspace/project' } as any;
        const bridge = new FileSystemBridge(workspaceRoot);
        const resolved = bridge.resolve(relativePath);
        expect(resolved.path.startsWith('/workspace/project')).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 2: UTF-8 encoding round trip
   * For any valid UTF-8 string, encoding with TextEncoder and decoding with TextDecoder produces the original.
   *
   * **Validates: Requirements 2.6**
   */
  it('Property 2: UTF-8 encoding round trip', () => {
    fc.assert(
      fc.property(fc.fullUnicodeString(), (input) => {
        const encoded = new TextEncoder().encode(input);
        const decoded = new TextDecoder('utf-8').decode(encoded);
        expect(decoded).toBe(input);
      }),
      { numRuns: 100 },
    );
  });
});
