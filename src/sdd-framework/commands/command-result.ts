/**
 * CommandResult - Standardized result structure for CLI commands
 * 
 * All CLI commands return this structure to ensure consistent
 * output formatting and error handling.
 */

/**
 * Error codes for CLI command failures
 */
export enum ErrorCode {
  // Validation errors
  INVALID_SPEC_NAME = 'INVALID_SPEC_NAME',
  INVALID_PLATFORM = 'INVALID_PLATFORM',
  INVALID_TASK_STATUS = 'INVALID_TASK_STATUS',
  INVALID_TASK_ID = 'INVALID_TASK_ID',

  // Resource errors
  SPEC_EXISTS = 'SPEC_EXISTS',
  SPEC_NOT_FOUND = 'SPEC_NOT_FOUND',
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  SKILL_NOT_FOUND = 'SKILL_NOT_FOUND',

  // File system errors
  PATH_ESCAPE = 'PATH_ESCAPE',
  WRITE_FAILED = 'WRITE_FAILED',
  READ_FAILED = 'READ_FAILED',

  // Verification errors
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',
  VERIFICATION_READ_ERROR = 'VERIFICATION_READ_ERROR',

  // General errors
  UNKNOWN_COMMAND = 'UNKNOWN_COMMAND',
  MISSING_ARGUMENT = 'MISSING_ARGUMENT',
}

/**
 * Error details structure
 */
export interface CommandError {
  code: ErrorCode | string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Standardized result structure for all CLI commands
 */
export interface CommandResult<T = unknown> {
  success: boolean;
  command: string;
  data?: T;
  error?: CommandError;
  warnings?: string[];
}

/**
 * Create a successful command result
 * @param command - The command name
 * @param data - The result data
 * @param warnings - Optional warnings
 * @returns A successful CommandResult
 */
export function successResult<T>(
  command: string,
  data: T,
  warnings?: string[]
): CommandResult<T> {
  return {
    success: true,
    command,
    data,
    ...(warnings && warnings.length > 0 ? { warnings } : {})
  };
}

/**
 * Create a failed command result
 * @param command - The command name
 * @param code - The error code
 * @param message - The error message
 * @param details - Optional error details
 * @returns A failed CommandResult
 */
export function errorResult(
  command: string,
  code: ErrorCode | string,
  message: string,
  details?: Record<string, unknown>
): CommandResult<never> {
  return {
    success: false,
    command,
    error: {
      code,
      message,
      ...(details ? { details } : {})
    }
  };
}
