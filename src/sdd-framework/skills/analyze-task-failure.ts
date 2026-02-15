/**
 * Analyze Task Failure Skill Definition
 *
 * Canonical skill for diagnosing a failed task and suggesting
 * resolution steps that can be inserted into tasks.md.
 */

import { CanonicalSkill } from '../types';

export const analyzeTaskFailureSkill: CanonicalSkill = {
  name: 'analyze-task-failure',
  title: 'Analyze Task Failure',
  description: 'Analyze a failed task and suggest resolution steps.',
  version: '1.0.0',
  supportedPlatforms: ['kiro', 'claude-code', 'codex', 'antigravity', 'amazonq'],
  parameters: [
    {
      name: 'specName',
      type: 'string',
      required: true,
      description: 'Spec folder name (e.g., "user-authentication")',
    },
    {
      name: 'groupId',
      type: 'string',
      required: true,
      description: 'Group number containing the failed task (e.g., "1")',
    },
    {
      name: 'failedTaskId',
      type: 'string',
      required: true,
      description: 'The ID of the failed task (e.g., "1.2.3")',
    },
  ],
  instructions: `# Analyze Task Failure

Diagnose the failure of task {failedTaskId} in group {groupId} of spec "{specName}" and suggest resolution steps.

## 1. Read Spec Documents

1. Open \`.kiro/specs/{specName}/tasks.md\` — locate the failed task by ID \`{failedTaskId}\`.
2. Open \`.kiro/specs/{specName}/requirements.md\` — find the requirements referenced by the failed task.
3. Open \`.kiro/specs/{specName}/design.md\` — review the design context for the failed task.

If any file is missing, note it and proceed with available information.

## 2. Analyze the Failed Task

1. Extract the failed task's description and any detail lines beneath it.
2. Identify the requirements it references (from \`_Requirements: X.Y_\` lines).
3. Review the corresponding requirement and design sections to understand what the task was trying to accomplish.
4. Analyze what likely went wrong based on the task description, requirements, and any error context.

## 3. Suggest Resolution Tasks

Based on your analysis, create a new fix subgroup and insert it BEFORE the failed task's parent subgroup so the fix executes first. Do NOT insert resolution tasks after existing subgroups or as children of the failed task.

1. Determine the failed task's parent subgroup number (e.g., if the failed task is \`1.1.3\`, the parent subgroup is \`1.1\`).
2. Create a new fix subgroup using the SAME number as the failed task's parent subgroup (e.g., \`1.1 Fix — [brief description]\`) with children numbered \`1.1.1\`, \`1.1.2\`, etc. All fix tasks use \`[ ]\` (not_started) checkbox status.
3. Shift the original parent subgroup and ALL subsequent subgroups down by 1 — increment their second-level number by 1 (e.g., original \`1.1\` becomes \`1.2\`, original \`1.2\` becomes \`1.3\`).
4. Renumber all leaf task IDs within the shifted subgroups accordingly (e.g., \`1.1.1\` becomes \`1.2.1\`, \`1.1.2\` becomes \`1.2.2\`, \`1.2.1\` becomes \`1.3.1\`).
5. Update all \`_Requirements:_\` references within the group to reflect the new numbering — each reference that pointed to a shifted subgroup number must be incremented by 1.
6. Reset the failed task's checkbox from \`[!]\` to \`[ ]\` under its new number so it will be retried after the fix tasks complete.
7. Reset the top-level group header's checkbox from \`[!]\` to \`[ ]\` so the group is no longer marked as failed.

IMPORTANT:
- Do NOT insert fix tasks after existing subgroups — the fix subgroup MUST be placed before the failed task's parent subgroup.
- Do NOT insert resolution tasks as children of the failed task or its parent subgroup.
- The new subgroup must use the same checkbox format as all other subgroups.
- When the failed task is in the FIRST subgroup (e.g., \`1.1\`), the same algorithm applies — the fix subgroup takes \`1.1\` and the original first subgroup shifts to \`1.2\`. No special handling is needed.
- When multiple tasks in the same subgroup have failed, create a fix subgroup for the FIRST failed task only. Subsequent failures may resolve after the fix is applied and the subgroup is retried.

### Example

Before (failed task \`1.1.1\`):

\`\`\`
- [!] 1. Environment Setup
  - [!] 1.1 Verify prerequisites
    - [!] 1.1.1 Check PHP installation
      - Run \`php --version\` to confirm PHP is available
      - _Requirements: 1.3_
    - [ ] 1.1.2 Check Composer installation
      - _Requirements: 1.1_
  - [ ] 1.2 Create project files
    - [ ] 1.2.1 Create \`hello.php\` in workspace root
      - _Requirements: 1.1_
\`\`\`

After (fix subgroup inserted at \`1.1\`, originals shifted, references renumbered):

\`\`\`
- [ ] 1. Environment Setup
  - [ ] 1.1 Fix — Install PHP interpreter
    - [ ] 1.1.1 Download PHP for the current OS
    - [ ] 1.1.2 Add PHP to system PATH
    - [ ] 1.1.3 Verify installation with \`php --version\`
  - [ ] 1.2 Verify prerequisites
    - [ ] 1.2.1 Check PHP installation
      - Run \`php --version\` to confirm PHP is available
      - _Requirements: 1.4_
    - [ ] 1.2.2 Check Composer installation
      - _Requirements: 1.2_
  - [ ] 1.3 Create project files
    - [ ] 1.3.1 Create \`hello.php\` in workspace root
      - _Requirements: 1.2_
\`\`\`

## 4. Present to User

Present the suggested resolution tasks to the user for approval before modifying tasks.md. Include:
- A summary of what went wrong
- The suggested fix subgroup with its numbered resolution tasks
- The failed task reset to \`[ ]\` for retry
`,
  platformOverrides: {},
};
