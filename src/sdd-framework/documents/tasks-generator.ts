/**
 * Tasks Document Generator
 * 
 * Generates tasks.md files with valid checkbox syntax for task tracking.
 * Supports all task statuses: not_started, in_progress, completed, failed.
 */

import { Task, TaskStatus } from '../types';

/**
 * Options for generating a tasks document
 */
export interface TasksGeneratorOptions {
  title?: string;
  overview?: string;
  notes?: string[];
}

/**
 * Input for a task to be generated
 */
export interface TaskInput {
  id: string;
  text: string;
  status?: TaskStatus;
  subtasks?: TaskInput[];
  requirements?: string[];
  details?: string[];
}

/**
 * TasksGenerator - Creates tasks.md documents with checkbox syntax
 */
export class TasksGenerator {
  /**
   * Convert a TaskStatus to its checkbox character
   * @param status - The task status
   * @returns The checkbox character
   */
  statusToCheckboxChar(status: TaskStatus): string {
    switch (status) {
      case 'completed': return 'x';
      case 'in_progress': return '-';
      case 'failed': return '!';
      case 'not_started':
      default: return ' ';
    }
  }

  /**
   * Generate a single task line with checkbox syntax
   * @param task - The task input
   * @param indent - Indentation level (0 for top-level)
   * @returns The formatted task line
   */
  generateTaskLine(task: TaskInput, indent: number = 0): string {
    const status = task.status ?? 'not_started';
    const checkbox = this.statusToCheckboxChar(status);
    const indentation = '  '.repeat(indent);
    return `${indentation}- [${checkbox}] ${task.id} ${task.text}`;
  }

  /**
   * Generate task lines including subtasks and details
   * @param task - The task input
   * @param indent - Indentation level
   * @returns Array of formatted lines
   */
  generateTaskWithDetails(task: TaskInput, indent: number = 0): string[] {
    const lines: string[] = [];
    const indentation = '  '.repeat(indent);
    
    // Main task line
    lines.push(this.generateTaskLine(task, indent));
    
    // Add details if present
    if (task.details && task.details.length > 0) {
      for (const detail of task.details) {
        lines.push(`${indentation}    - ${detail}`);
      }
    }
    
    // Add requirements reference if present
    if (task.requirements && task.requirements.length > 0) {
      lines.push(`${indentation}    - _Requirements: ${task.requirements.join(', ')}_`);
    }
    
    // Add subtasks recursively
    if (task.subtasks && task.subtasks.length > 0) {
      for (const subtask of task.subtasks) {
        lines.push(...this.generateTaskWithDetails(subtask, indent + 1));
      }
    }
    
    return lines;
  }

  /**
   * Generate a complete tasks.md document
   * @param tasks - Array of task inputs
   * @param options - Optional document configuration
   * @returns The complete tasks.md content
   */
  generate(tasks: TaskInput[], options: TasksGeneratorOptions = {}): string {
    const lines: string[] = [];
    
    // Title
    const title = options.title ?? 'Implementation Tasks';
    lines.push(`# ${title}`);
    lines.push('');
    
    // Overview section
    if (options.overview) {
      lines.push('## Overview');
      lines.push('');
      lines.push(options.overview);
      lines.push('');
    }
    
    // Tasks section
    lines.push('## Tasks');
    lines.push('');
    
    for (const task of tasks) {
      lines.push(...this.generateTaskWithDetails(task, 0));
      lines.push('');
    }
    
    // Notes section
    if (options.notes && options.notes.length > 0) {
      lines.push('## Notes');
      lines.push('');
      for (const note of options.notes) {
        lines.push(`- ${note}`);
      }
      lines.push('');
    }
    
    return lines.join('\n');
  }

  /**
   * Parse a Task object to TaskInput for regeneration
   * @param task - The Task object
   * @returns TaskInput suitable for generation
   */
  taskToInput(task: Task): TaskInput {
    return {
      id: task.id,
      text: task.text,
      status: task.status,
      subtasks: task.subtasks.map((st: Task) => this.taskToInput(st)),
      requirements: task.requirements
    };
  }
}
