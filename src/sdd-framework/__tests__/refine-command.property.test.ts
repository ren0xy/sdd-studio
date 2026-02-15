import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { RefineCommand, RefineResult } from '../commands/refine-command';

// Mock clipboard to avoid actual system clipboard access during tests
vi.mock('../commands/clipboard', () => ({
  copyToClipboard: vi.fn(() => true)
}));

describe('Refine Command Property Tests', () => {
  /**
   * Property 4: Refine command JSON output round-trip
   *
   * For any valid RefineResult (instruction string + boolean copiedToClipboard),
   * serializing to JSON and parsing back produces an equivalent object.
   *
   * **Validates: Requirements 2.5**
   */
  it('Property 4: JSON output round-trip', () => {
    const refineResultArb = fc.record({
      instruction: fc.string({ minLength: 1, maxLength: 200 }),
      copiedToClipboard: fc.boolean()
    });

    fc.assert(
      fc.property(refineResultArb, (result: RefineResult) => {
        const json = JSON.stringify(result);
        const parsed = JSON.parse(json) as RefineResult;

        expect(parsed.instruction).toBe(result.instruction);
        expect(parsed.copiedToClipboard).toBe(result.copiedToClipboard);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: Invalid document type rejection
   *
   * For any string that is not "requirements", "design", or "tasks",
   * the refine command returns an error result with success: false.
   *
   * **Validates: Requirements 2.7**
   */
  it('Property 5: invalid document type rejection', async () => {
    const validDocs = new Set(['requirements', 'design', 'tasks']);
    const invalidDocArb = fc.string({ minLength: 1, maxLength: 30 })
      .filter(s => !validDocs.has(s));

    const cmd = new RefineCommand();

    await fc.assert(
      fc.asyncProperty(invalidDocArb, async (doc) => {
        const result = await cmd.execute({ spec: 'test-spec', doc });
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });
});
