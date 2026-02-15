/**
 * PlatformVerifier - Verifies platform-specific workspace structure
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import * as path from 'path';
import type { PlatformId } from '../types';
import type { VerifyFileSystem } from './verify-file-system';
import type { VerificationCheck } from './verification-data';

/**
 * Platform-to-instructions-file mapping, derived from PlatformAdapter.instructionsFile.
 * null means the platform has no separate instructions file (e.g. Kiro uses steering).
 */
const PLATFORM_INSTRUCTIONS: Record<PlatformId, string | null> = {
  kiro: null,
  'claude-code': 'CLAUDE.md',
  codex: 'AGENTS.md',
  antigravity: '.agent/rules/specs.md',
  amazonq: null,
};

/**
 * Verifies platform-specific workspace structure after workspace-init.
 */
export class PlatformVerifier {
  constructor(private fs: VerifyFileSystem) {}

  async verify(platform: PlatformId, workspaceRoot: string): Promise<VerificationCheck[]> {
    const checks: VerificationCheck[] = [];

    // 1. .kiro/specs/ directory exists — Req 5.1 (all platforms)
    const specsDir = path.join(workspaceRoot, '.kiro', 'specs');
    const specsDirExists = await this.fs.isDirectory(specsDir);
    checks.push({
      name: '.kiro/specs/ exists',
      passed: specsDirExists,
      expected: 'directory present',
      actual: specsDirExists ? 'directory present' : 'directory missing',
      message: specsDirExists
        ? '.kiro/specs/ directory found'
        : '.kiro/specs/ directory missing',
    });

    // 2. Platform-specific instructions file — Req 5.2, 5.3, 5.4, 5.5
    const instructionsFile = PLATFORM_INSTRUCTIONS[platform];
    if (instructionsFile !== null) {
      const instrPath = path.join(workspaceRoot, instructionsFile);
      const instrExists = await this.fs.exists(instrPath);
      checks.push({
        name: `${instructionsFile} exists`,
        passed: instrExists,
        expected: 'file present',
        actual: instrExists ? 'file present' : 'file missing',
        message: instrExists
          ? `${instructionsFile} found`
          : `${instructionsFile} missing`,
      });

      // Check that instructions file references .kiro/specs/ — Req 5.5
      if (instrExists) {
        try {
          const content = await this.fs.readFile(instrPath);
          const hasRef = content.includes('.kiro/specs/');
          checks.push({
            name: `${instructionsFile} references .kiro/specs/`,
            passed: hasRef,
            expected: 'contains .kiro/specs/ reference',
            actual: hasRef ? 'reference found' : 'reference missing',
            message: hasRef
              ? `${instructionsFile} references .kiro/specs/`
              : `${instructionsFile} does not reference .kiro/specs/`,
          });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          checks.push({
            name: `${instructionsFile} references .kiro/specs/`,
            passed: false,
            expected: 'readable file',
            actual: `read error: ${errMsg}`,
            message: `Failed to read ${instructionsFile}: ${errMsg}`,
          });
        }
      }
    }

    return checks;
  }
}
