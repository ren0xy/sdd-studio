import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import * as path from 'path';
import { ESLint } from 'eslint';

/**
 * Feature: inline-sdd-framework, Property 2: ESLint boundary enforcement
 *
 * For any import path in a file under src/sdd-framework/ that resolves to a
 * file outside src/sdd-framework/ or to the vscode module, ESLint shall report
 * an error. Conversely, imports that resolve within src/sdd-framework/ shall
 * not trigger the boundary rule.
 *
 * **Validates: Requirements 5.1, 5.2, 5.3**
 */

const projectRoot = path.resolve(__dirname, '..', '..', '..');
const frameworkDir = path.resolve(projectRoot, 'src', 'sdd-framework');

// Subdirectories that exist inside the framework
const frameworkSubdirs = [
  'adapters', 'commands', 'documents', 'instructions',
  'registry', 'skills', 'tasks', 'transformer',
  'validation', 'verification', 'workspace',
];

// Root-level modules in the framework (without extension)
const frameworkRootModules = ['types', 'index'];

// Reuse a single ESLint instance for performance
let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({
    cwd: projectRoot,
    overrideConfigFile: path.join(projectRoot, 'eslint.config.mjs'),
  });
});

/**
 * Lint a virtual file with a single import statement using ESLint's lintText API.
 * The filePath is used only for config matching (glob patterns) — no file is written to disk.
 * Returns true if ESLint reports a no-restricted-imports error.
 */
async function hasEslintBoundaryError(
  virtualFilePath: string,
  importPath: string,
): Promise<boolean> {
  const content = `import '${importPath}';\n`;
  const results = await eslint.lintText(content, { filePath: virtualFilePath });
  return results.some(r =>
    r.messages.some(m => m.ruleId === 'no-restricted-imports'),
  );
}

describe('Feature: inline-sdd-framework, Property 2: ESLint boundary enforcement', () => {

  // ── Boundary-crossing imports MUST be flagged ──

  it('Property 2a: ESLint flags boundary-crossing imports from root-level framework files', async () => {
    // Root-level files (src/sdd-framework/*.ts): ../* escapes the framework boundary.
    const virtualFile = path.join(frameworkDir, '_virtual_test.ts');

    const crossingImportArb = fc.oneof(
      fc.constant('vscode'),
      fc.constantFrom(...frameworkSubdirs).map(d => `vscode/${d}`),
      fc.constantFrom(
        '../types',
        '../services/index',
        '../framework/loader',
        '../parsers/taskParser',
      ),
    );

    await fc.assert(
      fc.asyncProperty(crossingImportArb, async (importPath) => {
        const flagged = await hasEslintBoundaryError(virtualFile, importPath);
        expect(flagged).toBe(true);
      }),
      { numRuns: 100 },
    );
  }, 30_000);

  it('Property 2b: ESLint flags boundary-crossing imports from subdirectory framework files', async () => {
    // Subdirectory files (src/sdd-framework/adapters/*.ts): ../../* escapes the framework.
    const virtualFile = path.join(frameworkDir, 'adapters', '_virtual_test.ts');

    const crossingImportArb = fc.oneof(
      fc.constant('vscode'),
      fc.constantFrom(...frameworkSubdirs).map(d => `vscode/${d}`),
      fc.constantFrom(
        '../../types',
        '../../services/index',
        '../../framework/loader',
        '../../parsers/taskParser',
      ),
    );

    await fc.assert(
      fc.asyncProperty(crossingImportArb, async (importPath) => {
        const flagged = await hasEslintBoundaryError(virtualFile, importPath);
        expect(flagged).toBe(true);
      }),
      { numRuns: 100 },
    );
  }, 30_000);

  // ── Valid intra-framework imports MUST NOT be flagged ──

  it('Property 2c: ESLint does not flag valid intra-framework imports from root-level files', async () => {
    const virtualFile = path.join(frameworkDir, '_virtual_test.ts');

    const validImportArb = fc.oneof(
      // ./types, ./index — sibling modules at root level
      fc.constantFrom(...frameworkRootModules).map(m => `./${m}`),
      // ./adapters/index, ./commands/index — into subdirectories
      fc.constantFrom(...frameworkSubdirs).map(d => `./${d}/index`),
      fc.constantFrom(...frameworkSubdirs).map(d => `./${d}`),
    );

    await fc.assert(
      fc.asyncProperty(validImportArb, async (importPath) => {
        const flagged = await hasEslintBoundaryError(virtualFile, importPath);
        expect(flagged).toBe(false);
      }),
      { numRuns: 100 },
    );
  }, 30_000);

  it('Property 2d: ESLint does not flag valid intra-framework imports from subdirectory files', async () => {
    const virtualFile = path.join(frameworkDir, 'adapters', '_virtual_test.ts');

    const validImportArb = fc.oneof(
      // ../types, ../index — up one level, still within framework
      fc.constantFrom(...frameworkRootModules).map(m => `../${m}`),
      // ../commands/index — sibling subdirectory
      fc.constantFrom(...frameworkSubdirs).map(d => `../${d}/index`),
      fc.constantFrom(...frameworkSubdirs).map(d => `../${d}`),
      // ./platform-adapter — same directory
      fc.constantFrom('./platform-adapter', './kiro-adapter', './index'),
    );

    await fc.assert(
      fc.asyncProperty(validImportArb, async (importPath) => {
        const flagged = await hasEslintBoundaryError(virtualFile, importPath);
        expect(flagged).toBe(false);
      }),
      { numRuns: 100 },
    );
  }, 30_000);
});
