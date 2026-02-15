/**
 * Create Spec Skill Definition
 * 
 * Canonical skill for creating new spec folders using any supported platform.
 * 
 * Requirements: 3.1
 */

import { CanonicalSkill } from '../types';

export const createSpecSkill: CanonicalSkill = {
  name: 'create-spec',
  title: 'Create Spec Folder',
  description: 'Create a new spec folder for feature development in the platform-appropriate location.',
  version: '1.0.0',
  supportedPlatforms: ['kiro', 'claude-code', 'codex', 'antigravity', 'amazonq'],
  parameters: [
    {
      name: 'featureName',
      type: 'string',
      required: true,
      description: 'The name of the feature in kebab-case (e.g., user-authentication)'
    },
    {
      name: 'generationMode',
      type: 'string',
      required: false,
      description: 'The spec generation mode: requirements-first or design-first (default: requirements-first)'
    }
  ],
  instructions: `# Create Spec Folder

Create a new spec folder for structured feature development.

## Steps

1. Validate the feature name:
   - Must be in kebab-case format (lowercase letters, numbers, hyphens)
   - Must not be empty
   - Must not contain spaces or special characters

2. Determine the spec location based on current platform:
   - **All platforms**: \`.kiro/specs/{feature-name}/\`

3. Check if a spec folder with the same name already exists:
   - If exists, return an error without modifying existing content
   - Do not overwrite or merge with existing specs

4. Create the spec folder structure:
   - Create the feature directory
   - Create a configuration file for the target platform
   - Initialize empty document placeholders if needed

5. Task format constraint:
   - Any generated \`tasks.md\` content MUST follow the canonical two-group three-level structure.
   - There MUST be exactly two depth-1 groups: \`- [ ] 1. Mandatory — ...\` and \`- [ ]* 2. Optional — ...\`.
   - Under each group, use depth-2 subgroups (\`1.1\`, \`1.2\`, …) and depth-3 leaf tasks (\`1.1.1\`, \`1.1.2\`, …).
   - NEVER start tasks at depth-2 without a depth-1 parent. NEVER add top-level groups beyond \`1.\` and \`2.\`.

## Configuration File

The configuration file should include:
- Generation mode (requirements-first or design-first)
- Platform identifier
- Creation timestamp

## Output

Report the creation results:
- Path to the created spec folder
- Configuration settings applied
- Any warnings or notes
`,
  platformOverrides: {
    'kiro': {
      additionalContent: `
## Kiro Specific

When creating specs on Kiro:
- Location: \`.kiro/specs/{feature-name}/\`
- Config file: \`.config.kiro\`
- Supports both requirements-first and design-first workflows
`
    }
  }
};
