/**
 * OutputFormatter - Formats CommandResult for different output modes
 * 
 * Provides JSON and human-readable text formatting for CLI output.
 */

import type { CommandResult } from './command-result';

/**
 * Interface for output formatters
 */
export interface OutputFormatter {
  /**
   * Format a command result for output
   * @param result - The command result to format
   * @returns Formatted string output
   */
  format(result: CommandResult): string;
}

/**
 * JSON output formatter
 * Formats command results as pretty-printed JSON
 */
export class JSONFormatter implements OutputFormatter {
  /**
   * Format a command result as JSON
   * @param result - The command result to format
   * @returns JSON string with 2-space indentation
   */
  format(result: CommandResult): string {
    return JSON.stringify(result, null, 2);
  }
}

/**
 * Text output formatter
 * Formats command results as human-readable text
 */
export class TextFormatter implements OutputFormatter {
  /**
   * Format a command result as human-readable text
   * @param result - The command result to format
   * @returns Formatted text output
   */
  format(result: CommandResult): string {
    if (result.success) {
      return this.formatSuccess(result);
    }
    return this.formatError(result);
  }

  /**
   * Format a successful result
   * @param result - The successful command result
   * @returns Formatted success message
   */
  formatSuccess(result: CommandResult): string {
    const lines: string[] = [];
    lines.push(`✓ ${result.command} completed successfully`);

    if (result.data) {
      lines.push('');
      lines.push(this.formatData(result.data));
    }

    if (result.warnings && result.warnings.length > 0) {
      lines.push('');
      lines.push('Warnings:');
      for (const warning of result.warnings) {
        lines.push(`  ⚠ ${warning}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format an error result
   * @param result - The failed command result
   * @returns Formatted error message
   */
  formatError(result: CommandResult): string {
    const lines: string[] = [];
    lines.push(`✗ ${result.command} failed`);

    if (result.error) {
      lines.push('');
      lines.push(`Error [${result.error.code}]: ${result.error.message}`);

      if (result.error.details) {
        lines.push('');
        lines.push('Details:');
        for (const [key, value] of Object.entries(result.error.details)) {
          lines.push(`  ${key}: ${this.formatValue(value)}`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Format data object for display
   * @param data - The data to format
   * @returns Formatted data string
   */
  private formatData(data: unknown): string {
    if (data === null || data === undefined) {
      return '';
    }

    if (typeof data !== 'object') {
      return String(data);
    }

    const lines: string[] = [];
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      lines.push(`  ${key}: ${this.formatValue(value)}`);
    }
    return lines.join('\n');
  }

  /**
   * Format a single value for display
   * @param value - The value to format
   * @returns Formatted value string
   */
  private formatValue(value: unknown): string {
    if (value === null || value === undefined) {
      return 'none';
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return '[]';
      }
      return value.join(', ');
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  }
}

/**
 * Get the appropriate formatter based on output mode
 * @param jsonMode - Whether to use JSON output
 * @returns The appropriate OutputFormatter
 */
export function getFormatter(jsonMode: boolean): OutputFormatter {
  return jsonMode ? new JSONFormatter() : new TextFormatter();
}
