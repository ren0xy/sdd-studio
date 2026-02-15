/**
 * VerificationData - Types and helpers for verification results
 *
 * Requirements: 7.1, 7.2, 7.5
 */

/**
 * A single verification check result
 * Requirements: 7.2
 */
export interface VerificationCheck {
  name: string;
  passed: boolean;
  expected?: string;
  actual?: string;
  message: string;
}

/**
 * Aggregated verification result with summary and timing
 * Requirements: 7.1, 7.5
 */
export interface VerificationData {
  passed: boolean;
  checks: VerificationCheck[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
  durationMs: number;
}

/**
 * Build a VerificationData from a list of checks and a duration.
 * Requirements: 7.1, 7.2, 7.5
 */
export function buildVerificationData(
  checks: VerificationCheck[],
  durationMs: number
): VerificationData {
  const passed = checks.filter(c => c.passed).length;
  const failed = checks.length - passed;
  return {
    passed: failed === 0,
    checks,
    summary: {
      total: checks.length,
      passed,
      failed,
    },
    durationMs,
  };
}

/**
 * Merge multiple check arrays into one.
 */
export function mergeChecks(...arrays: VerificationCheck[][]): VerificationCheck[] {
  return arrays.flat();
}
