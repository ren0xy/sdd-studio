/**
 * Run Task Skill Definition
 * 
 * Canonical skill for executing tasks from tasks.md with automatic progress tracking.
 * 
 * Requirements: 5.1, 5.2, 5.3
 */

import { CanonicalSkill } from '../types';

export const runTaskSkill: CanonicalSkill = {
  name: 'run-task',
  title: 'Run Task with Tracking',
  description: 'Execute tasks from tasks.md file with automatic progress tracking and status updates.',
  version: '1.0.0',
  supportedPlatforms: ['kiro', 'claude-code', 'codex', 'antigravity', 'amazonq'],
  parameters: [
    {
      name: 'taskId',
      type: 'string',
      required: true,
      description: 'The task identifier to execute (e.g., "1.1", "2.3")'
    },
    {
      name: 'specPath',
      type: 'string',
      required: false,
      description: 'Path to the spec folder containing tasks.md (auto-detected if not provided)'
    },
    {
      name: 'runAll',
      type: 'boolean',
      required: false,
      description: 'Run all incomplete tasks sequentially'
    }
  ],
  instructions: `# Run Task with Tracking

Execute tasks from the tasks.md file with automatic status tracking.

## Task Status Indicators

Tasks use checkbox syntax to indicate status:
- \`[ ]\` - Not started
- \`[~]\` - Queued
- \`[-]\` - In progress
- \`[x]\` - Completed
- \`[!]\` - Failed

## Single Task Execution

1. Locate the tasks.md file in the spec folder
2. Find the task by its identifier
3. Mark the task as in-progress (\`[-]\`)
4. Execute the task according to its description
5. On success: Mark as completed (\`[x]\`)
6. On failure: Mark as failed (\`[!]\`) with error context

## Sequential Task Execution

When running multiple tasks:
1. Identify all incomplete tasks (status \`[ ]\` or \`[~]\`)
2. Execute tasks in order by their identifier
3. Update status for each task as it completes
4. Stop on first failure unless configured otherwise

## Status Update Rules

- Preserve the original task text during status updates
- Use atomic file operations to prevent corruption
- Only modify the checkbox character, not surrounding content
- Handle concurrent updates safely

## Output

Report execution results:
- Task identifier and description
- Previous and new status
- Execution time
- Any errors or warnings
`,
  platformOverrides: {}
};
