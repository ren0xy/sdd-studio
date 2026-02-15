/**
 * Verify that TypeScript can resolve the framework's types.
 * The framework is ESM; the extension is CJS. We use type-only imports
 * at compile time and dynamic import() at runtime.
 */
import type { PlatformId, TaskStatus, PlatformAdapter, WorkspaceFileSystem } from '../../sdd-framework';
import { describe, it, expect } from 'vitest';

describe('sdd-framework type resolution', () => {
  it('can dynamically import the framework at runtime', async () => {
    const fw = await import('../../sdd-framework');
    expect(fw.KiroAdapter).toBeDefined();
    expect(fw.SkillRegistry).toBeDefined();
    expect(fw.SkillTransformer).toBeDefined();
    expect(fw.WorkspaceAdapter).toBeDefined();
    expect(fw.TaskTracker).toBeDefined();
    expect(fw.allSkills).toBeDefined();
  });

  it('type-only imports compile correctly', () => {
    // These type assertions verify the types resolve at compile time.
    // If this file compiles, the types are resolvable.
    const _platformCheck: PlatformId = 'kiro';
    const _statusCheck: TaskStatus = 'not_started';
    expect(_platformCheck).toBe('kiro');
    expect(_statusCheck).toBe('not_started');
  });
});
