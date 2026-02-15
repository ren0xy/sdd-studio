/**
 * RunTaskCommand - Deterministic task status updates
 * 
 * Updates task status in tasks.md files using atomic file operations
 * to ensure consistent behavior regardless of which AI agent executes the command.
 * 
 * Requirements: 3.1, 3.2, 3.6, 3.7
 */

import * as path from 'path';
import type { TaskStatus } from '../types';
import { Validator } from '../validation/validator';
import { TaskTracker } from '../tasks/task-tracker';
import { ErrorCode, successResult, errorResult, type CommandResult } from './command-result';

/**
 * Options for running a task status update
 */
export interface RunTaskOptions {
  spec: string;
  taskId: string;
  status: TaskStatus;
  workspaceRoot?: string;
}

/**
 * Result data from task status update
 */
export interface RunTaskResult {
  taskId: string;
  previousStatus: TaskStatus;
  newStatus: TaskStatus;
  filePath: string;
}

/**
 * File system operations interface for dependency injection
 */
export interface RunTaskFileSystem {
  exists(path: string): Promise<boolean>;
  readFile(path: string): Promise<string>;
}

/**
 * RunTaskCommand handles deterministic task status updates
 */
export class RunTaskCommand {
  private readonly commandName = 'run-task';

  constructor(
    private fs: RunTaskFileSystem,
    private tracker: TaskTracker = new TaskTracker()
  ) {}

  /**
   * Execute the run-task command
   * @param options - Task update options
   * @returns CommandResult with update details or error
   * Requirements: 3.1, 3.2, 3.6, 3.7
   */
  async execute(options: RunTaskOptions): Promise<CommandResult<RunTaskResult>> {
    const { spec, taskId, status, workspaceRoot = process.cwd() } = options;

    // Validate spec name (Requirements: 7.1)
    const specValidation = Validator.validateSpecName(spec);
    if (!specValidation.valid) {
      return errorResult(
        this.commandName,
        ErrorCode.INVALID_SPEC_NAME,
        specValidation.errors[0]?.message || 'Invalid spec name',
        { spec, expectedFormat: 'kebab-case (e.g., my-feature, user-auth-v2)' }
      );
    }

    // Validate task ID (Requirements: 7.4)
    const taskIdValidation = Validator.validateTaskId(taskId);
    if (!taskIdValidation.valid) {
      return errorResult(
        this.commandName,
        ErrorCode.INVALID_TASK_ID,
        taskIdValidation.errors[0]?.message || 'Invalid task ID',
        { taskId, expectedFormat: 'major.minor (e.g., "1.1", "2.3")' }
      );
    }

    // Validate task status (Requirements: 3.2, 7.3)
    const statusValidation = Validator.validateTaskStatus(status);
    if (!statusValidation.valid) {
      return errorResult(
        this.commandName,
        ErrorCode.INVALID_TASK_STATUS,
        statusValidation.errors[0]?.message || 'Invalid task status',
        { status, validStatuses: ['not_started', 'in_progress', 'completed', 'failed', 'queued'] }
      );
    }

    // Build tasks.md path (Requirements: 3.5)
    const tasksFilePath = path.join(workspaceRoot, '.kiro', 'specs', spec, 'tasks.md');

    // Check if spec exists (Requirements: 3.5)
    if (!await this.fs.exists(tasksFilePath)) {
      return errorResult(
        this.commandName,
        ErrorCode.SPEC_NOT_FOUND,
        `Spec "${spec}" not found or tasks.md does not exist`,
        { spec, path: tasksFilePath }
      );
    }

    // Read current file content to check if task exists (Requirements: 3.4)
    let content: string;
    try {
      content = await this.fs.readFile(tasksFilePath);
    } catch (err) {
      return errorResult(
        this.commandName,
        ErrorCode.READ_FAILED,
        `Failed to read tasks.md: ${err instanceof Error ? err.message : String(err)}`,
        { spec, path: tasksFilePath }
      );
    }

    // Check if task exists in the file (Requirements: 3.4)
    const taskExists = this.taskExistsInContent(content, taskId);
    
    if (!taskExists) {
      return errorResult(
        this.commandName,
        ErrorCode.TASK_NOT_FOUND,
        `Task "${taskId}" not found in spec "${spec}"`,
        { spec, taskId, path: tasksFilePath }
      );
    }

    // Update task status using TaskTracker (Requirements: 3.1, 3.3, 3.7)
    try {
      const update = await this.tracker.updateTaskStatus(tasksFilePath, taskId, status);
      
      return successResult(this.commandName, {
        taskId,
        previousStatus: update.oldStatus,
        newStatus: update.newStatus,
        filePath: tasksFilePath,
      });
    } catch (err) {
      return errorResult(
        this.commandName,
        ErrorCode.WRITE_FAILED,
        `Failed to update task status: ${err instanceof Error ? err.message : String(err)}`,
        { spec, taskId, path: tasksFilePath }
      );
    }
  }

  /**
   * Check if a task ID exists in the file content
   * @param content - The tasks.md file content
   * @param taskId - The task ID to find
   * @returns true if task exists, false otherwise
   */
  private taskExistsInContent(content: string, taskId: string): boolean {
      // Escape special regex characters in taskId
      const escapedId = taskId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match task checkbox pattern with the task ID, including ~ (queued) for backward compat
      const pattern = new RegExp(`- \\[[ x\\-!~]\\]\\*?\\s*${escapedId}\\b`);
      return pattern.test(content);
    }

}
