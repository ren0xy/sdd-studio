/**
 * TaskVerifier - Verifies task status matches expected state
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import * as path from 'path';
import type { TaskStatus } from '../types';
import type { VerifyFileSystem } from './verify-file-system';
import type { VerificationCheck } from './verification-data';

/** Status character to TaskStatus mapping (consistent with TaskTracker) */
const CHAR_TO_STATUS: Record<string, TaskStatus> = {
  ' ': 'not_started',
  'x': 'completed',
  '-': 'in_progress',
  '!': 'failed',
  '~': 'not_started', // queued treated as not_started for backward compat
};

const STATUS_TO_LABEL: Record<TaskStatus, string> = {
  not_started: 'not_started',
  in_progress: 'in_progress',
  completed: 'completed',
  failed: 'failed',
  queued: 'queued',
};

/**
 * Verifies task status after a run-task command.
 */
export class TaskVerifier {
  constructor(private fs: VerifyFileSystem) {}

  async verifyTaskStatus(
    specName: string,
    taskId: string,
    expectedStatus: TaskStatus,
    workspaceRoot: string
  ): Promise<VerificationCheck[]> {
    const checks: VerificationCheck[] = [];
    const tasksPath = path.join(workspaceRoot, '.kiro', 'specs', specName, 'tasks.md');

    // 1. tasks.md exists and is readable — Req 4.1
    let content: string;
    try {
      content = await this.fs.readFile(tasksPath);
      checks.push({
        name: 'tasks.md readable',
        passed: true,
        expected: 'readable file',
        actual: 'readable file',
        message: 'tasks.md read successfully',
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      checks.push({
        name: 'tasks.md readable',
        passed: false,
        expected: 'readable file',
        actual: `read error: ${errMsg}`,
        message: `Failed to read tasks.md: ${errMsg}`,
      });
      return checks;
    }

    // Store original line count for integrity check
    const originalLineCount = content.split('\n').length;

    // 2. Task entry exists — Req 4.2
    const escapedId = taskId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`- \\[([ x\\-!~])\\]\\*?\\s*${escapedId}\\b`);
    const match = content.match(pattern);

    if (!match) {
      checks.push({
        name: `Task ${taskId} exists`,
        passed: false,
        expected: 'task entry present',
        actual: 'task entry missing',
        message: `Task "${taskId}" not found in tasks.md`,
      });
      return checks;
    }

    checks.push({
      name: `Task ${taskId} exists`,
      passed: true,
      expected: 'task entry present',
      actual: 'task entry present',
      message: `Task "${taskId}" found in tasks.md`,
    });

    // 3. Status matches — Req 4.3, 4.4
    const actualChar = match[1];
    const actualStatus = CHAR_TO_STATUS[actualChar] ?? 'not_started';
    const statusMatches = actualStatus === expectedStatus;

    checks.push({
      name: `Task ${taskId} status`,
      passed: statusMatches,
      expected: STATUS_TO_LABEL[expectedStatus],
      actual: STATUS_TO_LABEL[actualStatus],
      message: statusMatches
        ? `Task status is ${STATUS_TO_LABEL[expectedStatus]} as expected`
        : `Drift: expected ${STATUS_TO_LABEL[expectedStatus]}, actual ${STATUS_TO_LABEL[actualStatus]}`,
    });

    // 4. Content integrity — Req 4.5
    // Re-read to verify line count preserved
    try {
      const reread = await this.fs.readFile(tasksPath);
      const rereadLineCount = reread.split('\n').length;
      const integrityOk = rereadLineCount === originalLineCount;
      checks.push({
        name: 'Content integrity',
        passed: integrityOk,
        expected: `${originalLineCount} lines`,
        actual: `${rereadLineCount} lines`,
        message: integrityOk
          ? 'Line count preserved'
          : `Line count changed: expected ${originalLineCount}, got ${rereadLineCount}`,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      checks.push({
        name: 'Content integrity',
        passed: false,
        expected: 'readable file',
        actual: `read error: ${errMsg}`,
        message: `Failed to re-read tasks.md for integrity check: ${errMsg}`,
      });
    }

    return checks;
  }
}
