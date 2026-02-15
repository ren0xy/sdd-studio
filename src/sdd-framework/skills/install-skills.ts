/**
 * Install Skills Skill Definition
 * 
 * Canonical skill for installing framework skills into a workspace.
 * 
 * Requirements: 8.1
 */

import { CanonicalSkill } from '../types';

export const installSkillsSkill: CanonicalSkill = {
  name: 'install-skills',
  title: 'Install Framework Skills',
  description: 'Install context engineering framework skills into the workspace for the current platform.',
  version: '1.0.0',
  supportedPlatforms: ['kiro', 'claude-code', 'codex', 'antigravity', 'amazonq'],
  parameters: [
    {
      name: 'skills',
      type: 'string',
      required: false,
      description: 'Comma-separated list of skill names to install (default: all available skills)'
    },
    {
      name: 'force',
      type: 'boolean',
      required: false,
      description: 'Force overwrite if skills already exist'
    }
  ],
  instructions: `# Install Framework Skills

Install context engineering framework skills into the workspace.

## Platform-Specific Installation Paths

Skills are installed to platform-specific directories:
- **Kiro**: \`.kiro/skills/\`
- **Claude Code**: \`.claude/skills/\`
- **Codex**: \`.codex/skills/\` (with \`SKILL.md\` per skill directory)
- **Antigravity**: \`.agent/skills/\`

## Installation Steps

1. Detect the current platform
2. Determine the target skills directory
3. Create the directory if it doesn't exist
4. For each skill to install:
   - Transform the canonical skill to platform format
   - Write the skill file(s) to the target directory
   - Report success or failure

## Skill Format by Platform

- **Kiro**: Single markdown file with front-matter (\`inclusion: auto\`)
- **Claude Code**: Single markdown file
- **Codex**: Directory with \`SKILL.md\` file
- **Antigravity**: Directory with \`SKILL.md\` file

## Conflict Handling

If a skill already exists:
- Without \`force\`: Prompt for confirmation before overwriting
- With \`force\`: Overwrite existing skills

## Output

Report installation results:
- Skills installed successfully
- Skills skipped (already exist)
- Any errors encountered
- Target directory path
`,
  platformOverrides: {
    'codex': {
      additionalContent: `
## Codex Specific

When installing skills for Codex:
- Each skill is a directory containing \`SKILL.md\`
- Directory name matches the skill name
- Example: \`.codex/skills/workspace-init/SKILL.md\`
`
    },
    'antigravity': {
      instructions: `# Install Framework Skills

Install context engineering framework skills into the workspace.

## Platform-Specific Installation Paths

Skills are installed to platform-specific directories:
- Kiro - \`.kiro/skills/\`
- Claude Code - \`.claude/skills/\`
- Codex - \`.codex/skills/\` (with \`SKILL.md\` per skill directory)
- Antigravity - \`.agent/skills/\`

## Installation Steps

1. Detect the current platform
2. Determine the target skills directory
3. Create the directory if it doesn't exist
4. For each skill to install:
   - Transform the canonical skill to platform format
   - Write the skill file(s) to the target directory
   - Report success or failure

## Skill Format by Platform

- Kiro - Single markdown file with front-matter (\`inclusion: auto\`)
- Claude Code - Single markdown file
- Codex - Directory with \`SKILL.md\` file
- Antigravity - Directory with \`SKILL.md\` file

## Conflict Handling

If a skill already exists:
- Without \`force\` - Prompt for confirmation before overwriting
- With \`force\` - Overwrite existing skills

## Output

Report installation results:
- Skills installed successfully
- Skills skipped (already exist)
- Any errors encountered
- Target directory path
`
    }
  }
};
