import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Snapshot of all exported symbol names from the old `deps/sdd-framework/src/index.ts`.
 * This captures the public API surface before inlining.
 *
 * Value exports (classes, functions, constants) can be verified at runtime via dynamic import.
 * Type-only exports are verified separately by parsing the source file.
 */
const VALUE_EXPORTS_SNAPSHOT = [
  // Type guards
  'isDirectorySkill',
  'isSingleFileSkill',
  // Platform Adapters
  'KiroAdapter',
  'ClaudeCodeAdapter',
  'CodexAdapter',
  'AntigravityAdapter',
  'AmazonQAdapter',
  // Skill Registry
  'SkillRegistry',
  // Skill Transformer
  'SkillTransformer',
  // Workspace Adapter
  'WorkspaceAdapter',
  'validateSpecConfig',
  'validateSpecFolder',
  'validateAllSpecs',
  // Task Tracker
  'TaskTracker',
  'TaskGroupResolver',
  // Document Generators
  'TasksGenerator',
  // Canonical Skills
  'workspaceInitSkill',
  'createSpecSkill',
  'runTaskSkill',
  'installSkillsSkill',
  'refineSpecSkill',
  'startTaskGroupSkill',
  'allSkills',
  'getSkillByName',
  // Instruction Composer
  'composeSkillInstruction',
  'registerInstructionTemplate',
  'getInstructionTemplates',
  // Commands
  'CreateSpecCommand',
  'StartGroupCommand',
] as const;

/**
 * Full snapshot of ALL exported symbol names (both value and type-only exports)
 * from the old `deps/sdd-framework/src/index.ts`.
 */
const ALL_EXPORTS_SNAPSHOT = [
  ...VALUE_EXPORTS_SNAPSHOT,
  // Type-only exports (cannot be checked at runtime, verified via source parsing)
  'PlatformId',
  'TaskStatus',
  'SkillParameter',
  'SkillMetadata',
  'CanonicalSkill',
  'SingleFileSkill',
  'DirectorySkill',
  'PlatformSkill',
  'SpecConfig',
  'SpecDocument',
  'Task',
  'TasksDocument',
  'Spec',
  'SpecMetadata',
  'SpecLocation',
  'ValidationError',
  'ValidationWarning',
  'ValidationResult',
  'TaskUpdate',
  'TransformResult',
  'SkillInstallResult',
  'PlatformAdapter',
  'FileSystem',
  'CreateSpecResult',
  'FileSystemOperations',
  'WorkspaceFileSystem',
  'SpecConfigSchema',
  'SpecFolderSchema',
  'ValidationFileSystem',
  'TaskGroup',
  'TaskSubgroup',
  'ParsedTask',
  'TaskGroupStatus',
  'RequirementsValidation',
  'TaskInput',
  'TasksGeneratorOptions',
  'InstructionTemplate',
  'CreateSpecFileSystem',
  'CreateSpecOptions',
  'CreateSpecCommandResult',
  'StartGroupOptions',
  'StartGroupResult',
] as const;

/**
 * Extract exported symbol names from TypeScript source content.
 * Matches both `export { Name }` and `export type { Name }` patterns.
 */
function extractExportedNames(content: string): Set<string> {
  const names = new Set<string>();

  // Match: export { A, B, C } from '...' and export type { A, B } from '...'
  const braceExportRegex = /export\s+(?:type\s+)?\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = braceExportRegex.exec(content)) !== null) {
    const inner = match[1];
    for (const part of inner.split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      // Handle `Foo as Bar` — the exported name is Bar
      const asMatch = trimmed.match(/\w+\s+as\s+(\w+)/);
      if (asMatch) {
        names.add(asMatch[1]);
      } else {
        // Plain name
        const nameMatch = trimmed.match(/^(\w+)/);
        if (nameMatch) {
          names.add(nameMatch[1]);
        }
      }
    }
  }

  return names;
}

describe('Feature: inline-sdd-framework, Property 3: Export surface preservation', () => {
  /**
   * Property 3: Export surface preservation
   *
   * For any symbol that was exported from `deps/sdd-framework/src/index.ts` before
   * inlining, that same symbol shall be exported from `src/sdd-framework/index.ts`
   * after inlining. The new export set must be a superset of the old set.
   *
   * We use fast-check to sample from the snapshot of old exported symbols and verify
   * each one is present in the new module's exports.
   *
   * **Validates: Requirements 7.1, 7.3**
   */
  it('Property 3: all value exports from old index.ts are present in new module', async () => {
    const newModule = await import('../index');
    const newModuleKeys = new Set(Object.keys(newModule));

    const symbolArb = fc.constantFrom(...VALUE_EXPORTS_SNAPSHOT);

    fc.assert(
      fc.property(symbolArb, (symbolName: string) => {
        expect(newModuleKeys.has(symbolName)).toBe(true);
      }),
      { numRuns: Math.max(100, VALUE_EXPORTS_SNAPSHOT.length * 3) }
    );
  });

  it('Property 3: all exports (including type-only) are present in new index.ts source', () => {
    const fs = require('fs');
    const path = require('path');

    const newIndexPath = path.resolve(__dirname, '..', 'index.ts');
    const newIndexContent = fs.readFileSync(newIndexPath, 'utf-8');
    const newExportedNames = extractExportedNames(newIndexContent);

    const symbolArb = fc.constantFrom(...ALL_EXPORTS_SNAPSHOT);

    fc.assert(
      fc.property(symbolArb, (symbolName: string) => {
        expect(newExportedNames.has(symbolName)).toBe(true);
      }),
      { numRuns: Math.max(100, ALL_EXPORTS_SNAPSHOT.length * 3) }
    );
  });
});
