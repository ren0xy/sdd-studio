/**
 * TaskTracker - Manages task status updates in tasks.md files
 * 
 * Handles parsing, updating, and tracking task completion status
 * using atomic file operations to prevent corruption.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { TaskStatus, TaskUpdate } from '../types';
import { TaskGroupResolver } from './task-group-resolver';

export class TaskTracker {
  /**
   * Parse the status of a task from file content
   * @param content - The tasks.md file content
   * @param taskId - The task identifier to find
   * @returns The current status of the task
   */
  parseTaskStatus(content: string, taskId: string): TaskStatus {
    const escapedId = this.escapeRegex(taskId);
    // Match checkbox with optional marker (*) after closing bracket for backward compatibility
    const pattern = new RegExp(`- \\[([ x\\-!~])\\]\\*?\\s*${escapedId}`);
    const match = content.match(pattern);

    if (!match) return 'not_started';

    switch (match[1]) {
      case 'x': return 'completed';
      case '-': return 'in_progress';
      case '!': return 'failed';
      case '~': return 'queued';
      default: return 'not_started';
    }
  }

  /**
   * Replace the status of a task in file content
   * @param content - The tasks.md file content
   * @param taskId - The task identifier to update
   * @param status - The new status to set
   * @returns The updated file content
   */
  replaceTaskStatus(content: string, taskId: string, status: TaskStatus): string {
    const statusChar = this.statusToChar(status);
    const escapedId = this.escapeRegex(taskId);
    // Match checkbox with optional marker (*) after closing bracket for backward compatibility
    const pattern = new RegExp(
      `(- \\[)[ x\\-!~](\\]\\*?\\s*${escapedId})`
    );
    return content.replace(pattern, `$1${statusChar}$2`);
  }

  /**
   * Convert a TaskStatus to its checkbox character representation
   * @param status - The status to convert
   * @returns The single character for the checkbox
   */
  statusToChar(status: TaskStatus): string {
    switch (status) {
      case 'completed': return 'x';
      case 'in_progress': return '-';
      case 'failed': return '!';
      case 'queued': return '~';
      default: return ' ';
    }
  }

  /**
   * Escape special regex characters in a string
   * @param str - The string to escape
   * @returns The escaped string safe for use in regex
   */
  escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Update the status of a task in a tasks.md file
   * Reads the file, parses current status, replaces with new status, and writes atomically
   * @param tasksFilePath - Path to the tasks.md file
   * @param taskId - The task identifier to update
   * @param status - The new status to set
   * @param error - Optional error message for failed tasks
   * @returns TaskUpdate with old and new status
   */
  async updateTaskStatus(
    tasksFilePath: string,
    taskId: string,
    status: TaskStatus,
    error?: string
  ): Promise<TaskUpdate> {
    const content = await fs.readFile(tasksFilePath, 'utf-8');
    const oldStatus = this.parseTaskStatus(content, taskId);
    
    const newContent = this.replaceTaskStatus(content, taskId, status);
    await this.writeFileAtomic(tasksFilePath, newContent);
    
    return {
      taskId,
      oldStatus,
      newStatus: status,
      timestamp: new Date(),
      error
    };
  }

  /**
   * Handle failure cascade: set group to failed, revert queued tasks
   * after failedTaskId back to not_started. Single atomic write.
   */
  async handleTaskFailure(
    tasksFilePath: string,
    groupId: string,
    failedTaskId: string
  ): Promise<void> {
    const content = await fs.readFile(tasksFilePath, 'utf-8');
    const resolver = new TaskGroupResolver();
    const groups = resolver.parseGroups(content);
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    const leafTasks = group.tasks.filter(t => t.depth >= 3);
    const failedIndex = leafTasks.findIndex(t => t.id === failedTaskId);
    if (failedIndex === -1) {
      throw new Error(`Task "${failedTaskId}" not found in group "${groupId}"`);
    }

    let updated = content;

    // Set group checkbox to failed
    updated = this.replaceTaskStatus(updated, groupId, 'failed');

    // Revert all queued tasks after the failed task to not_started
    for (let i = failedIndex + 1; i < leafTasks.length; i++) {
      if (leafTasks[i].status === 'queued') {
        updated = this.replaceTaskStatus(updated, leafTasks[i].id, 'not_started');
      }
    }

    await this.writeFileAtomic(tasksFilePath, updated);
  }

  /**
   * Compute and write the aggregate status for a group's checkbox.
   * Reads leaf task statuses, applies precedence rules, writes atomically.
   */
  async updateGroupStatus(tasksFilePath: string, groupId: string): Promise<void> {
    const content = await fs.readFile(tasksFilePath, 'utf-8');
    const resolver = new TaskGroupResolver();
    const groups = resolver.parseGroups(content);
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    const leafStatuses = group.tasks
      .filter(t => t.depth >= 3)
      .map(t => t.status === 'queued' ? 'not_started' as TaskStatus : t.status);

    if (leafStatuses.length === 0) return;

    // Precedence: failed > in_progress > completed > mixed completed/not_started → in_progress > all not_started
    let aggregateStatus: TaskStatus;
    const hasFailed = leafStatuses.some(s => s === 'failed');
    const hasInProgress = leafStatuses.some(s => s === 'in_progress');
    const hasCompleted = leafStatuses.some(s => s === 'completed');
    const hasNotStarted = leafStatuses.some(s => s === 'not_started');

    if (hasFailed) {
      aggregateStatus = 'failed';
    } else if (hasInProgress) {
      aggregateStatus = 'in_progress';
    } else if (hasCompleted && !hasNotStarted) {
      aggregateStatus = 'completed';
    } else if (hasCompleted && hasNotStarted) {
      aggregateStatus = 'in_progress';
    } else {
      aggregateStatus = 'not_started';
    }

    const updated = this.replaceTaskStatus(content, groupId, aggregateStatus);
    await this.writeFileAtomic(tasksFilePath, updated);
  }

  /**
   * Mark all not_started leaf tasks in a group as queued.
   * Reads the file once, applies all changes, writes atomically.
   */
  async queueGroupTasks(tasksFilePath: string, groupId: string): Promise<void> {
    const content = await fs.readFile(tasksFilePath, 'utf-8');
    const resolver = new TaskGroupResolver();
    const groups = resolver.parseGroups(content);
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    const leafTasks = group.tasks.filter(t => t.depth >= 3 && t.status === 'not_started');
    if (leafTasks.length === 0) return;

    let updated = content;
    for (const task of leafTasks) {
      updated = this.replaceTaskStatus(updated, task.id, 'queued');
    }

    await this.writeFileAtomic(tasksFilePath, updated);
  }

  /**
   * Write file atomically using temp file + rename pattern
   * @param filePath - Target file path
   * @param content - Content to write
   */
  private async writeFileAtomic(filePath: string, content: string): Promise<void> {
    // Use unique temp file name to avoid race conditions
    const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tempPath = `${filePath}.${uniqueId}.tmp`;
    try {
      await fs.writeFile(tempPath, content, 'utf-8');
      await fs.rename(tempPath, filePath);
    } catch (err) {
      // Clean up temp file if rename fails
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw err;
    }
  }

  /**
   * Run a single task with automatic status tracking
   * Marks task as in-progress before execution, then completed or failed after
   * @param tasksFilePath - Path to the tasks.md file
   * @param taskId - The task identifier to run
   * @param executor - Async function that executes the task
   * @returns TaskUpdate with final status
   */
  async runTask(
    tasksFilePath: string,
    taskId: string,
    executor: () => Promise<void>
  ): Promise<TaskUpdate> {
    // Mark as in-progress
    await this.updateTaskStatus(tasksFilePath, taskId, 'in_progress');
    
    try {
      await executor();
      return await this.updateTaskStatus(tasksFilePath, taskId, 'completed');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return await this.updateTaskStatus(
        tasksFilePath, 
        taskId, 
        'failed', 
        errorMessage
      );
    }
  }

  /**
   * Run multiple tasks sequentially with automatic status tracking
   * @param tasksFilePath - Path to the tasks.md file
   * @param taskIds - Array of task identifiers to run
   * @param executors - Map of task IDs to their executor functions
   * @returns Array of TaskUpdate results for each task
   */
  async runTasks(
    tasksFilePath: string,
    taskIds: string[],
    executors: Map<string, () => Promise<void>>
  ): Promise<TaskUpdate[]> {
    const results: TaskUpdate[] = [];
    
    for (const taskId of taskIds) {
      const executor = executors.get(taskId);
      if (!executor) {
        results.push(await this.updateTaskStatus(
          tasksFilePath, 
          taskId, 
          'failed', 
          'No executor found'
        ));
        continue;
      }
      results.push(await this.runTask(tasksFilePath, taskId, executor));
    }
    
    return results;
  }
}
