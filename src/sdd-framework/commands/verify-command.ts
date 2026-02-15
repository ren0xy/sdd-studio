/**
 * VerifyCommand - Orchestrates verification as a standalone CLI command
 *
 * Requirements: 1.1, 1.5, 1.6, 1.7, 7.1, 7.3, 7.4, 7.5
 */

import type { PlatformId, TaskStatus } from '../types';
import type { VerifyFileSystem } from '../verification/verify-file-system';
import type { VerificationCheck, VerificationData } from '../verification/verification-data';
import { buildVerificationData, mergeChecks } from '../verification/verification-data';
import { SpecVerifier } from '../verification/spec-verifier';
import { TaskVerifier } from '../verification/task-verifier';
import { PlatformVerifier } from '../verification/platform-verifier';
import { SkillVerifier } from '../verification/skill-verifier';
import { successResult, errorResult, type CommandResult } from './command-result';

/**
 * Options for the verify command
 */
export interface VerifyOptions {
  spec?: string;
  platform?: PlatformId;
  skills?: string[];
  taskId?: string;
  expectedTaskStatus?: TaskStatus;
  json?: boolean;
  workspaceRoot?: string;
}

/**
 * VerifyCommand orchestrates verification across all verifiers.
 */
export class VerifyCommand {
  private readonly commandName = 'verify';

  constructor(private fs: VerifyFileSystem) {}

  async execute(options: VerifyOptions): Promise<CommandResult<VerificationData>> {
    const { workspaceRoot = process.cwd() } = options;
    const start = Date.now();
    const allChecks: VerificationCheck[][] = [];
    const allWarnings: string[] = [];

    // Spec verification — Req 1.1
    if (options.spec) {
      const specVerifier = new SpecVerifier(this.fs);
      const result = await specVerifier.verify(options.spec, workspaceRoot);
      allChecks.push(result.checks);
      allWarnings.push(...result.warnings);
    }

    // Task verification (only when taskId + expectedStatus provided)
    if (options.spec && options.taskId && options.expectedTaskStatus) {
      const taskVerifier = new TaskVerifier(this.fs);
      const checks = await taskVerifier.verifyTaskStatus(
        options.spec, options.taskId, options.expectedTaskStatus, workspaceRoot
      );
      allChecks.push(checks);
    }

    // Platform verification — Req 1.5, 1.6
    if (options.platform) {
      const platformVerifier = new PlatformVerifier(this.fs);
      const checks = await platformVerifier.verify(options.platform, workspaceRoot);
      allChecks.push(checks);
    }

    // Skill verification — Req 1.7
    if (options.platform && options.skills && options.skills.length > 0) {
      const skillVerifier = new SkillVerifier(this.fs);
      const checks = await skillVerifier.verify(options.platform, options.skills, workspaceRoot);
      allChecks.push(checks);
    }

    const durationMs = Date.now() - start;
    const checks = mergeChecks(...allChecks);
    const data = buildVerificationData(checks, durationMs);

    if (data.passed) {
      return successResult(this.commandName, data, allWarnings.length > 0 ? allWarnings : undefined);
    }

    // Req 1.7 — list all failed checks
    return errorResult(
      this.commandName,
      'VERIFICATION_FAILED',
      `Verification failed: ${data.summary.failed} of ${data.summary.total} checks failed`,
      { verification: data as unknown as Record<string, unknown> }
    );
  }
}
