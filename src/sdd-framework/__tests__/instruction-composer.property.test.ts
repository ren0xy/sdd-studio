import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  composeSkillInstruction,
  registerInstructionTemplate,
  getInstructionTemplates
} from '../instructions/instruction-composer';

/**
 * Arbitrary for safe skill names: non-empty alphanumeric+hyphen strings.
 */
const skillNameArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,29}$/);

/**
 * Arbitrary for safe parameter values: printable ASCII, no control chars.
 */
const safeStringArb = fc.stringOf(
  fc.char().filter(c => c.charCodeAt(0) >= 0x20 && c.charCodeAt(0) < 0x7f),
  { minLength: 1, maxLength: 40 }
);

/**
 * Arbitrary for a non-empty parameter map (1–5 entries).
 */
const paramsArb = fc.dictionary(
  fc.stringMatching(/^[a-zA-Z]\w{0,14}$/),
  safeStringArb,
  { minKeys: 1, maxKeys: 5 }
);

describe('Instruction Composer Property Tests', () => {
  /**
   * Property 1: Instruction output includes skill name and all parameter values
   *
   * For any skill name and any non-empty parameter map, the output of
   * composeSkillInstruction contains the skill name and every parameter value.
   *
   * **Validates: Requirements 1.2, 1.4**
   */
  it('Property 1: output includes skill name and all parameter values', () => {
    fc.assert(
      fc.property(skillNameArb, paramsArb, (skillName, params) => {
        const result = composeSkillInstruction(skillName, params);

        // Must contain the skill name
        expect(result).toContain(skillName);

        // Must contain every parameter value
        for (const value of Object.values(params)) {
          expect(result).toContain(value);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Template resolution completeness
   *
   * For any registered template with {placeholder} tokens and a matching
   * parameter map, the output contains no unresolved {placeholder} tokens.
   *
   * **Validates: Requirements 1.3**
   */
  it('Property 2: template resolution completeness', () => {
    // Generate 1–4 placeholder names, build a template, provide matching params
    const placeholderNameArb = fc.stringMatching(/^[a-zA-Z]\w{0,9}$/);
    const placeholderSetArb = fc.uniqueArray(placeholderNameArb, { minLength: 1, maxLength: 4 });

    // Filler values must not themselves look like {placeholder} tokens,
    // otherwise the resolved output will still match the unresolved-token regex.
    const safeFiller = safeStringArb.filter(s => !/\{[a-zA-Z]\w*\}/.test(s));

    fc.assert(
      fc.property(skillNameArb, placeholderSetArb, safeFiller, (skillName, placeholders, filler) => {
        // Build a template with {placeholder} tokens
        const templateStr = placeholders.map(p => `{${p}}`).join(' ');
        registerInstructionTemplate({ skillName, template: templateStr });

        // Build params that cover all placeholders
        const params: Record<string, string> = {};
        for (const p of placeholders) {
          params[p] = filler;
        }

        const result = composeSkillInstruction(skillName, params);

        // No unresolved {placeholder} tokens should remain
        expect(result).not.toMatch(/\{[a-zA-Z]\w*\}/);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Instruction output is single-line plain text
   *
   * For any skill name and parameter map, the output is a non-empty string
   * containing no newline or control characters.
   *
   * **Validates: Requirements 1.6**
   */
  it('Property 3: output is single-line plain text', () => {
    fc.assert(
      fc.property(skillNameArb, paramsArb, (skillName, params) => {
        const result = composeSkillInstruction(skillName, params);

        // Non-empty
        expect(result.length).toBeGreaterThan(0);

        // No newlines
        expect(result).not.toContain('\n');
        expect(result).not.toContain('\r');

        // No control characters (0x00–0x1f, 0x7f)
        // eslint-disable-next-line no-control-regex
        expect(result).not.toMatch(/[\x00-\x1f\x7f]/);
      }),
      { numRuns: 100 }
    );
  });
});
