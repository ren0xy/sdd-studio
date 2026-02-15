/**
 * Spec Folder Schema Validation
 * 
 * Validates that spec folders conform to the expected structure,
 * catching drift between platforms early.
 */

import type { PlatformId, ValidationResult, ValidationError, ValidationWarning } from '../types';

/**
 * Expected structure of a spec config file
 */
export interface SpecConfigSchema {
  generationMode: 'requirements-first' | 'design-first';
  platform?: PlatformId;
  createdAt?: string;
  [key: string]: unknown;
}

/**
 * Expected files in a spec folder
 */
export interface SpecFolderSchema {
  configFile: string;  // .config.json or .config.kiro
  optionalFiles: string[];  // requirements.md, design.md, tasks.md
}

/**
 * File system interface for validation
 */
export interface ValidationFileSystem {
  exists(path: string): Promise<boolean>;
  readFile(path: string): Promise<string>;
  readdir(path: string): Promise<string[]>;
  isDirectory(path: string): Promise<boolean>;
}

/**
 * Validates a spec config object against the expected schema.
 */
export function validateSpecConfig(config: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (typeof config !== 'object' || config === null) {
    errors.push({
      code: 'INVALID_CONFIG_TYPE',
      message: 'Config must be a non-null object',
    });
    return { valid: false, errors, warnings };
  }

  const configObj = config as Record<string, unknown>;

  // Required: generationMode
  if (!('generationMode' in configObj)) {
    errors.push({
      code: 'MISSING_GENERATION_MODE',
      message: 'Config must have a generationMode field',
    });
  } else if (!['requirements-first', 'design-first'].includes(configObj.generationMode as string)) {
    errors.push({
      code: 'INVALID_GENERATION_MODE',
      message: `generationMode must be 'requirements-first' or 'design-first', got '${configObj.generationMode}'`,
    });
  }

  // Optional but recommended: platform
  if ('platform' in configObj) {
    const validPlatforms: PlatformId[] = ['kiro', 'claude-code', 'codex', 'antigravity', 'amazonq'];
    if (!validPlatforms.includes(configObj.platform as PlatformId)) {
      errors.push({
        code: 'INVALID_PLATFORM',
        message: `platform must be one of ${validPlatforms.join(', ')}, got '${configObj.platform}'`,
      });
    }
  } else {
    warnings.push({
      code: 'MISSING_PLATFORM',
      message: 'Config is missing platform field',
      suggestion: 'Add a platform field to track which platform created this spec',
    });
  }

  // Optional: createdAt (should be ISO date string if present)
  if ('createdAt' in configObj && typeof configObj.createdAt === 'string') {
    const date = new Date(configObj.createdAt);
    if (isNaN(date.getTime())) {
      warnings.push({
        code: 'INVALID_CREATED_AT',
        message: 'createdAt is not a valid ISO date string',
        suggestion: 'Use ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates a spec folder structure.
 */
export async function validateSpecFolder(
  specPath: string,
  fs: ValidationFileSystem
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Check folder exists
  if (!await fs.exists(specPath)) {
    errors.push({
      code: 'SPEC_NOT_FOUND',
      message: `Spec folder not found: ${specPath}`,
      path: specPath,
    });
    return { valid: false, errors, warnings };
  }

  // Check it's a directory
  if (!await fs.isDirectory(specPath)) {
    errors.push({
      code: 'NOT_A_DIRECTORY',
      message: `Path is not a directory: ${specPath}`,
      path: specPath,
    });
    return { valid: false, errors, warnings };
  }

  // List contents
  const contents = await fs.readdir(specPath);

  // Find config file (either .config.json or .config.kiro)
  const configFile = contents.find(f => f === '.config.json' || f === '.config.kiro');
  
  if (!configFile) {
    errors.push({
      code: 'MISSING_CONFIG',
      message: 'Spec folder must contain .config.json or .config.kiro',
      path: specPath,
    });
  } else {
    // Validate config content
    try {
      const configPath = specPath.endsWith('/') ? `${specPath}${configFile}` : `${specPath}/${configFile}`;
      const configContent = await fs.readFile(configPath);
      const config = JSON.parse(configContent);
      const configResult = validateSpecConfig(config);
      
      errors.push(...configResult.errors.map(e => ({ ...e, path: configPath })));
      warnings.push(...configResult.warnings.map(w => ({ ...w })));
    } catch (err) {
      errors.push({
        code: 'INVALID_CONFIG_JSON',
        message: `Failed to parse config file: ${err instanceof Error ? err.message : String(err)}`,
        path: specPath,
      });
    }
  }

  // Check for expected optional files
  const expectedFiles = ['requirements.md', 'design.md', 'tasks.md'];
  const foundFiles = contents.filter(f => expectedFiles.includes(f));
  
  if (foundFiles.length === 0) {
    warnings.push({
      code: 'EMPTY_SPEC',
      message: 'Spec folder has no content files (requirements.md, design.md, tasks.md)',
      suggestion: 'Add at least requirements.md to define the spec',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates all specs in a workspace.
 */
export async function validateAllSpecs(
  specsPath: string,
  fs: ValidationFileSystem
): Promise<Map<string, ValidationResult>> {
  const results = new Map<string, ValidationResult>();

  if (!await fs.exists(specsPath)) {
    return results;
  }

  const entries = await fs.readdir(specsPath);
  
  for (const entry of entries) {
    const fullPath = specsPath.endsWith('/') ? `${specsPath}${entry}` : `${specsPath}/${entry}`;
    
    if (await fs.isDirectory(fullPath)) {
      const result = await validateSpecFolder(`${fullPath}/`, fs);
      results.set(entry, result);
    }
  }

  return results;
}
