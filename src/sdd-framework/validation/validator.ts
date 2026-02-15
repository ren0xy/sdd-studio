/**
 * Validator - Centralized validation logic for CLI commands
 * 
 * Provides static validation methods for spec names, platforms,
 * task statuses, task IDs, and path safety checks.
 */

import * as path from 'path';
import type { PlatformId, TaskStatus, ValidationResult } from '../types';

/**
 * Valid platforms for the SDD framework
 */
const VALID_PLATFORMS: readonly PlatformId[] = ['kiro', 'claude-code', 'codex', 'antigravity', 'amazonq'] as const;

/**
 * Valid task status values
 */
const VALID_TASK_STATUSES: readonly TaskStatus[] = ['not_started', 'in_progress', 'completed', 'failed', 'queued'] as const;

/**
 * Kebab-case pattern: lowercase letters, numbers, and hyphens
 * Must start with a letter, cannot end with hyphen, no consecutive hyphens
 */
const KEBAB_CASE_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/**
 * Task ID pattern: major.minor format (e.g., "1.1", "2.3", "10.15")
 */
const TASK_ID_PATTERN = /^\d+\.\d+$/;

export class Validator {
  /**
   * Check if a string is valid kebab-case
   * @param name - The string to validate
   * @returns true if valid kebab-case, false otherwise
   */
  static isKebabCase(name: string): boolean {
    if (!name || typeof name !== 'string') return false;
    return KEBAB_CASE_PATTERN.test(name);
  }

  /**
   * Check if a string is a valid platform identifier
   * @param platform - The string to validate
   * @returns true if valid platform, false otherwise
   */
  static isValidPlatform(platform: string): platform is PlatformId {
    return VALID_PLATFORMS.includes(platform as PlatformId);
  }

  /**
   * Check if a string is a valid task status
   * @param status - The string to validate
   * @returns true if valid task status, false otherwise
   */
  static isValidTaskStatus(status: string): status is TaskStatus {
    return VALID_TASK_STATUSES.includes(status as TaskStatus);
  }

  /**
   * Check if a string is a valid task ID (major.minor format)
   * @param taskId - The string to validate
   * @returns true if valid task ID, false otherwise
   */
  static isValidTaskId(taskId: string): boolean {
    if (!taskId || typeof taskId !== 'string') return false;
    return TASK_ID_PATTERN.test(taskId);
  }

  /**
   * Check if a path is safe (no path traversal, within workspace)
   * @param filePath - The path to validate
   * @param workspaceRoot - The workspace root directory
   * @returns true if path is safe, false otherwise
   */
  static isPathSafe(filePath: string, workspaceRoot: string): boolean {
    if (!filePath || typeof filePath !== 'string') return false;
    if (!workspaceRoot || typeof workspaceRoot !== 'string') return false;

    // Reject absolute paths that don't start with workspace root
    if (path.isAbsolute(filePath)) {
      const normalizedPath = path.normalize(filePath);
      const normalizedRoot = path.normalize(workspaceRoot);
      return normalizedPath.startsWith(normalizedRoot + path.sep) || normalizedPath === normalizedRoot;
    }

    // Check for path traversal attempts
    const normalizedPath = path.normalize(filePath);
    if (normalizedPath.startsWith('..') || normalizedPath.includes(`${path.sep}..`)) {
      return false;
    }

    // Resolve the full path and check it's within workspace
    const resolvedPath = path.resolve(workspaceRoot, filePath);
    const normalizedRoot = path.normalize(workspaceRoot);
    return resolvedPath.startsWith(normalizedRoot + path.sep) || resolvedPath === normalizedRoot;
  }

  /**
   * Validate a spec name and return detailed result
   * @param name - The spec name to validate
   * @returns ValidationResult with error details if invalid
   */
  static validateSpecName(name: string): ValidationResult {
    if (!name || typeof name !== 'string') {
      return {
        valid: false,
        errors: [{
          code: 'INVALID_SPEC_NAME',
          message: 'Spec name is required and must be a string'
        }],
        warnings: []
      };
    }

    if (!Validator.isKebabCase(name)) {
      return {
        valid: false,
        errors: [{
          code: 'INVALID_SPEC_NAME',
          message: `Spec name "${name}" is not valid kebab-case. Expected format: lowercase letters, numbers, and hyphens (e.g., "my-feature", "user-auth-v2")`
        }],
        warnings: []
      };
    }

    return { valid: true, errors: [], warnings: [] };
  }

  /**
   * Validate a platform identifier and return detailed result
   * @param platform - The platform to validate
   * @returns ValidationResult with error details if invalid
   */
  static validatePlatform(platform: string): ValidationResult {
    if (!platform || typeof platform !== 'string') {
      return {
        valid: false,
        errors: [{
          code: 'INVALID_PLATFORM',
          message: 'Platform is required and must be a string'
        }],
        warnings: []
      };
    }

    if (!Validator.isValidPlatform(platform)) {
      return {
        valid: false,
        errors: [{
          code: 'INVALID_PLATFORM',
          message: `Platform "${platform}" is not valid. Expected one of: ${VALID_PLATFORMS.join(', ')}`
        }],
        warnings: []
      };
    }

    return { valid: true, errors: [], warnings: [] };
  }

  /**
   * Validate a task status and return detailed result
   * @param status - The status to validate
   * @returns ValidationResult with error details if invalid
   */
  static validateTaskStatus(status: string): ValidationResult {
    if (!status || typeof status !== 'string') {
      return {
        valid: false,
        errors: [{
          code: 'INVALID_TASK_STATUS',
          message: 'Task status is required and must be a string'
        }],
        warnings: []
      };
    }

    if (!Validator.isValidTaskStatus(status)) {
      return {
        valid: false,
        errors: [{
          code: 'INVALID_TASK_STATUS',
          message: `Task status "${status}" is not valid. Expected one of: ${VALID_TASK_STATUSES.join(', ')}`
        }],
        warnings: []
      };
    }

    return { valid: true, errors: [], warnings: [] };
  }

  /**
   * Validate a task ID and return detailed result
   * @param taskId - The task ID to validate
   * @returns ValidationResult with error details if invalid
   */
  static validateTaskId(taskId: string): ValidationResult {
    if (!taskId || typeof taskId !== 'string') {
      return {
        valid: false,
        errors: [{
          code: 'INVALID_TASK_ID',
          message: 'Task ID is required and must be a string'
        }],
        warnings: []
      };
    }

    if (!Validator.isValidTaskId(taskId)) {
      return {
        valid: false,
        errors: [{
          code: 'INVALID_TASK_ID',
          message: `Task ID "${taskId}" is not valid. Expected format: major.minor (e.g., "1.1", "2.3")`
        }],
        warnings: []
      };
    }

    return { valid: true, errors: [], warnings: [] };
  }

  /**
   * Validate a file path for safety and return detailed result
   * @param filePath - The path to validate
   * @param workspaceRoot - The workspace root directory
   * @returns ValidationResult with error details if invalid
   */
  static validatePath(filePath: string, workspaceRoot: string): ValidationResult {
    if (!filePath || typeof filePath !== 'string') {
      return {
        valid: false,
        errors: [{
          code: 'PATH_ESCAPE',
          message: 'File path is required and must be a string'
        }],
        warnings: []
      };
    }

    if (!Validator.isPathSafe(filePath, workspaceRoot)) {
      return {
        valid: false,
        errors: [{
          code: 'PATH_ESCAPE',
          message: `Path "${filePath}" is not safe. Path must be within the workspace root and cannot contain path traversal sequences`
        }],
        warnings: []
      };
    }

    return { valid: true, errors: [], warnings: [] };
  }
}
