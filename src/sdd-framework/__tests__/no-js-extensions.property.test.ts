import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Collect all .ts files under a directory, excluding __tests__/ and node_modules/.
 */
function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Extract all import/export `from` specifiers from TypeScript source content.
 * Matches: import ... from 'specifier' / export ... from "specifier"
 */
function extractImportSpecifiers(content: string): string[] {
  const regex = /(?:import|export)\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
  const specifiers: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    specifiers.push(match[1]);
  }
  return specifiers;
}

const frameworkDir = path.resolve(__dirname, '..');

describe('Feature: inline-sdd-framework, Property 1: No .js import extensions in framework files', () => {
  const tsFiles = collectTsFiles(frameworkDir);

  /**
   * Property 1: No .js import extensions in framework files
   *
   * For any TypeScript source file under src/sdd-framework/ (excluding __tests__/),
   * no import specifier in that file should end with `.js`.
   *
   * Since the file set is finite, we use fast-check to sample from the actual files
   * and assert the property holds for each sampled file. With numRuns >= the file count,
   * this is effectively exhaustive.
   *
   * **Validates: Requirements 4.1**
   */
  it('Property 1: no import specifier ends with .js in any framework file', () => {
    expect(tsFiles.length).toBeGreaterThan(0);

    const fileArb = fc.constantFrom(...tsFiles);

    fc.assert(
      fc.property(fileArb, (filePath: string) => {
        const content = fs.readFileSync(filePath, 'utf-8');
        const specifiers = extractImportSpecifiers(content);

        for (const specifier of specifiers) {
          expect(specifier).not.toMatch(/\.js$/);
        }
      }),
      { numRuns: Math.max(100, tsFiles.length * 3) }
    );
  });
});
