/**
 * SpecVerifier - Verifies spec folder structure and content validity
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 8.1, 8.2, 8.3, 8.4
 */

import * as path from 'path';
import type { VerifyFileSystem } from './verify-file-system';
import type { VerificationCheck } from './verification-data';

/** Valid checkbox markers for tasks.md validation (includes ~ for backward compat) */
const VALID_CHECKBOX_MARKERS = [' ', 'x', '-', '!', '~'] as const;

/** Matches lines like "- [ ] 1.1 Task text" or "- [x]* 2.1 Optional task" */
const CHECKBOX_PATTERN = /^(\s*)- \[([^\]]*)\]\*?\s+/;

const VALID_GENERATION_MODES = ['requirements-first', 'design-first'] as const;

const REQUIRED_FILES = ['requirements.md', 'design.md', 'tasks.md'] as const;

export interface SpecVerifierResult {
  checks: VerificationCheck[];
  warnings: string[];
}

/**
 * Verifies spec folder structure and content validity.
 * All checks run regardless of earlier failures (no short-circuit).
 */
export class SpecVerifier {
  constructor(private fs: VerifyFileSystem) {}

  async verify(specName: string, workspaceRoot: string): Promise<SpecVerifierResult> {
    const checks: VerificationCheck[] = [];
    const warnings: string[] = [];
    const specPath = path.join(workspaceRoot, '.kiro', 'specs', specName);

    // 1. Spec folder exists — Req 3.1
    const folderExists = await this.fs.isDirectory(specPath);
    checks.push({
      name: 'Spec folder exists',
      passed: folderExists,
      expected: 'directory present',
      actual: folderExists ? 'directory present' : 'directory missing',
      message: folderExists
        ? `Spec folder exists at .kiro/specs/${specName}/`
        : `Spec folder missing at .kiro/specs/${specName}/`,
    });

    // 2-4. Required files — Req 3.2
    for (const file of REQUIRED_FILES) {
      const filePath = path.join(specPath, file);
      const exists = folderExists ? await this.fs.exists(filePath) : false;
      checks.push({
        name: `${file} exists`,
        passed: exists,
        expected: 'file present',
        actual: exists ? 'file present' : 'file missing',
        message: exists ? `${file} found` : `${file} missing`,
      });
    }

    // 5. .config.kiro — Req 3.3, 8.1, 8.2
    const configPath = path.join(specPath, '.config.kiro');
    const configExists = folderExists ? await this.fs.exists(configPath) : false;

    if (!configExists) {
      // Missing config is a warning, not a failure — Req 8.1, 8.2
      warnings.push('.config.kiro missing (warning)');
    }

    // 6. .config.kiro valid JSON — Req 3.3
    let configJson: Record<string, unknown> | null = null;
    if (configExists) {
      try {
        const raw = await this.fs.readFile(configPath);
        configJson = JSON.parse(raw);
        checks.push({
          name: '.config.kiro valid JSON',
          passed: true,
          expected: 'valid JSON',
          actual: 'valid JSON',
          message: '.config.kiro contains valid JSON',
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        checks.push({
          name: '.config.kiro valid JSON',
          passed: false,
          expected: 'valid JSON',
          actual: `parse error: ${errMsg}`,
          message: `.config.kiro JSON parse failed: ${errMsg}`,
        });
      }
    }

    // 7. generationMode valid — Req 3.4
    if (configJson) {
      const mode = configJson.generationMode;
      const validMode = typeof mode === 'string' &&
        (VALID_GENERATION_MODES as readonly string[]).includes(mode);
      checks.push({
        name: '.config.kiro valid generationMode',
        passed: validMode,
        expected: 'requirements-first or design-first',
        actual: mode !== undefined ? String(mode) : 'missing',
        message: validMode
          ? `generationMode is "${mode}"`
          : `Invalid generationMode: ${mode !== undefined ? `"${mode}"` : 'missing'}`,
      });
    }

    // 8. tasks.md checkbox syntax — Req 3.5, 8.3
    const tasksPath = path.join(specPath, 'tasks.md');
    const tasksExists = folderExists ? await this.fs.exists(tasksPath) : false;
    if (tasksExists) {
      try {
        const content = await this.fs.readFile(tasksPath);
        const { valid, invalidLines } = this.validateCheckboxSyntax(content);
        checks.push({
          name: 'tasks.md checkbox syntax valid',
          passed: valid,
          expected: 'valid checkbox markers: space, x, -, !, ~',
          actual: valid ? 'all valid' : `invalid markers on lines: ${invalidLines.join(', ')}`,
          message: valid
            ? 'All task entries use valid checkbox syntax'
            : `Invalid checkbox syntax on ${invalidLines.length} line(s)`,
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        checks.push({
          name: 'tasks.md checkbox syntax valid',
          passed: false,
          expected: 'readable file',
          actual: `read error: ${errMsg}`,
          message: `Failed to read tasks.md: ${errMsg}`,
        });
      }
    }

    return { checks, warnings };
  }

  /**
   * Validate checkbox syntax in tasks.md content.
   * Returns valid=true if all checkbox lines use valid markers.
   */
  private validateCheckboxSyntax(content: string): { valid: boolean; invalidLines: number[] } {
    const lines = content.split('\n');
    const invalidLines: number[] = [];

    for (let i = 0; i < lines.length; i++) {
      const match = CHECKBOX_PATTERN.exec(lines[i]);
      if (match) {
        const marker = match[2];
        if (!(VALID_CHECKBOX_MARKERS as readonly string[]).includes(marker)) {
          invalidLines.push(i + 1); // 1-based line numbers
        }
      }
    }

    return { valid: invalidLines.length === 0, invalidLines };
  }
}
