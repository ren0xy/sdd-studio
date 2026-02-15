/**
 * Start Task Group Skill Definition
 *
 * Canonical skill for sequentially executing all tasks within a
 * numbered group from tasks.md, with automatic status tracking,
 * requirements validation, and dependency enforcement.
 */

import { CanonicalSkill } from '../types';

export const startTaskGroupSkill: CanonicalSkill = {
  name: 'start-task-group',
  title: 'Start Task Group',
  description:
    'Execute all tasks in a numbered group from tasks.md sequentially with automatic status tracking, requirements validation, and dependency enforcement.',
  version: '1.0.0',
  supportedPlatforms: ['kiro', 'claude-code', 'codex', 'antigravity', 'amazonq'],
  parameters: [
    {
      name: 'specName',
      type: 'string',
      required: true,
      description: 'The spec folder name (e.g., "user-authentication")',
    },
    {
      name: 'groupId',
      type: 'string',
      required: true,
      description: 'The group number to execute (e.g., "1" or "2")',
    },
  ],
  instructions: `# Start Task Group

Execute all tasks in group {groupId} of spec "{specName}" sequentially.

## 1. Locate Documents

1. Open \`.kiro/specs/{specName}/tasks.md\` — this contains the task list.
2. Open \`.kiro/specs/{specName}/requirements.md\` — this contains the requirements.

If either file is missing, stop and report the error.

## 2. Parse the Target Group

1. Find the top-level group numbered \`{groupId}.\` in tasks.md (e.g., \`- [ ] {groupId}. Title\`).
2. Collect all subgroups (e.g., {groupId}.1, {groupId}.2) and leaf tasks (e.g., {groupId}.1.1, {groupId}.1.2) under it.
3. If the group is not found, stop and report the error.

**Note:** This skill expects depth-1 group lines in the canonical format \`- [ ] {groupId}. Title\`. If the tasks.md file does not have depth-1 group headers (e.g., tasks start directly at depth-2 like \`1.1\`, \`1.2\`), the file is non-conforming. In that case, run the \`refine-spec\` skill on the tasks document first to correct the structure before attempting group execution.

## 2.5. Queue Group Tasks

1. Mark all incomplete leaf tasks (\`[ ]\`) within the group as \`[~]\` (queued) using \`TaskTracker.queueGroupTasks()\`.
2. Mark the group's top-level checkbox as \`[-]\` (in progress).
This reserves all tasks for sequential execution and prevents other agents from picking them up.

## 3. Requirements Pre-Check

For each task that has a \`_Requirements: X.Y_\` reference in its detail lines:
1. Verify that each referenced requirement ID exists in requirements.md.
2. If a reference is unresolved, warn but do not block execution.

## 4. Dependency Check

Within each subgroup, tasks are ordered by their numeric ID.
- If a prior task in the same subgroup has status \`[!]\` (failed), all subsequent tasks in that subgroup are blocked.
- Report blocked tasks and skip them during execution.

## 5. Sequential Execution

For each incomplete leaf task (status \`[ ]\` or \`[~]\`) that is not blocked, in order:
1. Mark the task as \`[-]\` (in progress) in tasks.md.
2. Read the task description and any detail lines, then execute the task.
3. On success: mark the task as \`[x]\` (completed) in tasks.md.
4. On failure:
   a. Mark the task as \`[!]\` (failed) in tasks.md.
   b. Mark the group's top-level checkbox as \`[!]\` (failed).
   c. Revert all remaining \`[~]\` (queued) leaf tasks back to \`[ ]\` (not started) using \`TaskTracker.handleTaskFailure()\`.
   d. Stop executing further tasks (fail-fast).

## 6. Skip Completed

Tasks already marked \`[x]\` (completed) are skipped — do not re-execute them.

## 7. Group Completion

After processing all tasks:
- If all leaf tasks in the group are \`[x]\`, update the group's top-level checkbox to \`[x]\`.
- If all subgroup tasks are complete, update each subgroup checkbox to \`[x]\` as well.

## 8. Report

Summarise what was executed:
- Tasks completed successfully
- Tasks that failed (with error details)
- Tasks that were skipped (already complete or blocked)
- Overall group status
`,
  platformOverrides: {},
};
