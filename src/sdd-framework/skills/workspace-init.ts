/**
 * Workspace Init Skill Definition
 * 
 * Canonical skill for initializing a workspace for a target platform,
 * enabling users to continue working with Kiro specs using other AI coding agents.
 * 
 * Requirements: 1.1, 1.2, 1.3
 */

import { CanonicalSkill } from '../types';

export const workspaceInitSkill: CanonicalSkill = {
  name: 'workspace-init',
  title: 'Initialize Workspace for Platform',
  description: 'Transform workspace structure to work with a target AI coding agent platform while preserving all existing spec content.',
  version: '1.0.0',
  supportedPlatforms: ['kiro', 'claude-code', 'codex', 'antigravity', 'amazonq'],
  parameters: [
    {
      name: 'targetPlatform',
      type: 'string',
      required: true,
      description: 'The target platform to initialize for (kiro, claude-code, codex, antigravity, amazonq)'
    },
    {
      name: 'force',
      type: 'boolean',
      required: false,
      description: 'Force overwrite if target platform directory already exists'
    }
  ],
  instructions: `# Workspace Initialization

Initialize this workspace for the specified target AI coding agent platform.

## Steps

1. Detect the current platform by checking for platform-specific markers:
   - \`.kiro/\` directory indicates Kiro
   - \`.claude/\` or \`CLAUDE.md\` indicates Claude Code
   - \`.codex/\` or \`AGENTS.md\` indicates Codex
   - \`.agent/\` directory indicates Antigravity

2. Locate existing specs in \`.kiro/specs/\` (unified location for all platforms)

3. Transform the workspace for the target platform:
   - Copy specs to the platform-appropriate location
   - Generate the platform's instructions file if required
   - Preserve all existing spec content without modification

4. Platform-specific setup:
   - **Kiro**: Specs at \`.kiro/specs/\`, no instructions file needed
   - **Claude Code**: Specs at \`.kiro/specs/\`, create \`CLAUDE.md\` with spec references
   - **Codex**: Specs at \`.kiro/specs/\`, create \`AGENTS.md\` with spec references
   - **Antigravity**: Specs at \`.kiro/specs/\`, create \`.agent/rules/specs.md\`

## Output

Report the transformation results including:
- Source and target directories
- Number of files transformed
- Any errors encountered
`,
  platformOverrides: {
    'claude-code': {
      additionalContent: `
## Claude Code Specific

When initializing for Claude Code:
- Create \`CLAUDE.md\` at the project root
- Include references to all specs in the instructions
- Skills will be available in \`.claude/skills/\`
`
    },
    'codex': {
      additionalContent: `
## Codex Specific

When initializing for Codex:
- Create \`AGENTS.md\` at the project root
- Each skill requires a directory with \`SKILL.md\`
- Skills will be available in \`.codex/skills/\`
`
    },
    'antigravity': {
      instructions: `# Workspace Initialization

Initialize this workspace for the specified target AI coding agent platform.

## Steps

1. Detect the current platform by checking for platform-specific markers:
   - \`.kiro/\` directory indicates Kiro
   - \`.claude/\` or \`CLAUDE.md\` indicates Claude Code
   - \`.codex/\` or \`AGENTS.md\` indicates Codex
   - \`.agent/\` directory indicates Antigravity

2. Locate existing specs in \`.kiro/specs/\` (unified location for all platforms)

3. Transform the workspace for the target platform:
   - Copy specs to the platform-appropriate location
   - Generate the platform's instructions file if required
   - Preserve all existing spec content without modification

4. Platform-specific setup:
   - Kiro - Specs at \`.kiro/specs/\`, no instructions file needed
   - Claude Code - Specs at \`.kiro/specs/\`, create \`CLAUDE.md\` with spec references
   - Codex - Specs at \`.kiro/specs/\`, create \`AGENTS.md\` with spec references
   - Antigravity - Specs at \`.kiro/specs/\`, create \`.agent/rules/specs.md\`

## Antigravity Specific

When initializing for Antigravity:
- Create \`.agent/rules/specs.md\` for spec instructions
- Skills will be available in \`.agent/skills/\`

## Output

Report the transformation results including:
- Source and target directories
- Number of files transformed
- Any errors encountered
`
    }
  }
};
