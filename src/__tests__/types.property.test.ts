import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { PlatformId, PLATFORM_CONFIGS } from '../types';

const allPlatforms: PlatformId[] = ['kiro', 'claude-code', 'codex', 'antigravity', 'amazonq'];
const platformArb: fc.Arbitrary<PlatformId> = fc.constantFrom(...allPlatforms);

describe('Property Tests: PLATFORM_CONFIGS', () => {
  /**
   * Property 1: Platform config structural completeness
   * For any PlatformId key in PLATFORM_CONFIGS, the corresponding PlatformDisplayConfig
   * object shall have a non-empty id matching the key, a non-empty displayName,
   * a non-empty steeringPath, a boolean steeringIsDirectory, and a non-empty skillsPath.
   *
   * **Feature: amazonq-platform-support, Property 1: Platform config structural completeness**
   * **Validates: Requirements 1.3**
   */
  it('Property 1: Platform config structural completeness', () => {
    fc.assert(
      fc.property(platformArb, (platform) => {
        const config = PLATFORM_CONFIGS[platform];
        expect(config).toBeDefined();
        expect(config.id).toBe(platform);
        expect(config.displayName).toBeTruthy();
        expect(config.steeringPath).toBeTruthy();
        expect(typeof config.steeringIsDirectory).toBe('boolean');
        expect(config.skillsPath).toBeTruthy();
      }),
      { numRuns: 100 },
    );
  });
});

describe('Unit Tests: Amazon Q config values', () => {
  /**
   * Verify exact field values for PLATFORM_CONFIGS['amazonq'].
   * _Requirements: 1.1, 1.2_
   */
  it('PLATFORM_CONFIGS["amazonq"] has correct field values', () => {
    const config = PLATFORM_CONFIGS['amazonq'];
    expect(config.id).toBe('amazonq');
    expect(config.displayName).toBe('Amazon Q');
    expect(config.steeringPath).toBe('.amazonq/rules/');
    expect(config.steeringIsDirectory).toBe(true);
    expect(config.skillsPath).toBe('.amazonq/rules/');
  });

  /**
   * Verify PLATFORM_CONFIGS contains exactly 5 platforms including amazonq.
   * _Requirements: 2.1, 2.3_
   */
  it('PLATFORM_CONFIGS contains all five platforms', () => {
    const keys = Object.keys(PLATFORM_CONFIGS);
    expect(keys).toHaveLength(5);
    expect(keys).toContain('amazonq');
    expect(keys).toContain('kiro');
    expect(keys).toContain('claude-code');
    expect(keys).toContain('codex');
    expect(keys).toContain('antigravity');
  });
});
