/**
 * Refine Spec Skill Definition
 *
 * Canonical skill for reviewing and refining spec documents
 * (requirements, design, tasks) with structured guidance.
 *
 * When installed as a workspace skill, the agent can be asked to
 * "use the refine-spec skill on <docType> of spec <specName>" and
 * it will follow the instructions below.
 */

import { CanonicalSkill } from '../types';

export const refineSpecSkill: CanonicalSkill = {
  name: 'refine-spec',
  title: 'Refine Spec Document',
  description: 'Review and refine a spec document (requirements, design, or tasks) with structured guidance for clarity, completeness, and consistency.',
  version: '1.0.0',
  supportedPlatforms: ['kiro', 'claude-code', 'codex', 'antigravity', 'amazonq'],
  parameters: [
    {
      name: 'specName',
      type: 'string',
      required: true,
      description: 'The name of the spec folder to refine (e.g., "user-authentication")'
    },
    {
      name: 'docType',
      type: 'string',
      required: true,
      description: 'The document type to refine: "requirements", "design", or "tasks"'
    }
  ],
  instructions: `# Refine Spec Document

Review and improve a spec document for clarity, completeness, and consistency.

## Locate the Document

1. Find the spec folder at \`.kiro/specs/{specName}/\`
2. Open the target document: \`{docType}.md\`
3. Read the full content before making any changes

## Refinement by Document Type

### Requirements (\`requirements.md\`)

Structure the document with these headings:

\`\`\`
# Requirements Document
## Introduction
## Glossary
## Requirements
### Requirement N: {title}
#### Acceptance Criteria
\`\`\`

- Ensure each requirement is clear, testable, and uniquely numbered
- Group related requirements under logical section headings
- Add acceptance criteria where missing
- Identify gaps, ambiguities, or conflicting requirements

### Design (\`design.md\`)

Structure the document with these headings:

\`\`\`
# Design Document: {title}
## Overview
## Architecture
## Components and Interfaces
\`\`\`

- Ensure the design addresses all requirements from requirements.md
- Document key architectural decisions and trade-offs
- Include component interfaces and data flow descriptions
- Add diagrams or pseudocode where helpful
- Identify technical risks and mitigation strategies

### Tasks (\`tasks.md\`)

Structure the document with these headings:

\`\`\`
# Implementation Plan: {title}
## Overview
## Tasks
## Notes
\`\`\`

Tasks use checkbox syntax: \`[ ]\` not started, \`[-]\` in progress, \`[x]\` completed, \`[~]\` queued, \`[!]\` failed.
Reference related requirements using \`_Requirements: X.Y_\` notation on detail lines.

#### REQUIRED Structure — Three-Level Hierarchy

The tasks section MUST use a strict three-level hierarchy with exactly two depth-1 groups. This is NOT optional.

- **Depth-1** (REQUIRED group headers): \`- [ ] 1. Title\` and \`- [ ]* 2. Title\`. There MUST be exactly two. NEVER add a \`3.\`, \`4.\`, or \`5.\`.
- **Depth-2** (subgroups/phases): \`- [ ] 1.1 Title\`, \`- [ ] 1.2 Title\`, etc. Group tasks that touch the same files/modules together.
- **Depth-3** (leaf tasks): \`- [ ] 1.1.1 Title\`, \`- [ ] 1.1.2 Title\`, etc. These are the actionable work items.

Group 1 (\`1.\`) contains mandatory core implementation tasks. NO line in Group 1 may use \`*\`.
Group 2 (\`2.\`) contains optional / stretch-goal tasks. EVERY checkbox line in Group 2 MUST use \`- [ ]*\` (asterisk after the bracket).

You MUST NOT omit the depth-1 group lines. Starting directly at depth-2 (e.g., \`1.1, 1.2, 1.3\`) without a depth-1 parent is INVALID.

#### Canonical Example — CORRECT

\`\`\`markdown
## Tasks

- [ ] 1. Mandatory — Core Implementation
  - [ ] 1.1 Foundation module
    - [ ] 1.1.1 Create the module file with core functions
    - [ ] 1.1.2 Create barrel export
    - [ ] 1.1.3 Add exports to public API
  - [ ] 1.2 CLI command
    - [ ] 1.2.1 Create utility helper
    - [ ] 1.2.2 Create command class
    - [ ] 1.2.3 Wire command into CLI entry point
    - [ ] 1.2.4 Export command from barrel
  - [ ] 1.3 Checkpoint — framework tests pass
  - [ ] 1.4 Extension integration
    - [ ] 1.4.1 Refactor service to use framework command
    - [ ] 1.4.2 Update CodeLens to use framework composer
    - [ ] 1.4.3 Add auto-install on activation
  - [ ] 1.5 Update steering / docs
    - [ ] 1.5.1 Update steering rule to reflect new architecture
  - [ ] 1.6 Final checkpoint — all tests pass

- [ ]* 2. Optional — Property Tests / Stretch Goals
  - [ ]* 2.1 Framework property tests
    - [ ]* 2.1.1 Property test: output includes skill name and all params
    - [ ]* 2.1.2 Property test: template resolution completeness
  - [ ]* 2.2 Extension unit tests
    - [ ]* 2.2.1 Unit tests for refactored spec creation
    - [ ]* 2.2.2 Unit tests for updated CodeLens
\`\`\`

#### WRONG — Common Deviations

**WRONG — Flat numbering without depth-1 groups:**

\`\`\`markdown
## Tasks

- [ ] 1.1 Foundation module
  - [ ] 1.1.1 Create the module file
  - [ ] 1.1.2 Create barrel export
- [ ] 1.2 CLI command
  - [ ] 1.2.1 Create utility helper
\`\`\`

This is INVALID because there is no \`- [ ] 1. Title\` depth-1 group line. Tasks start directly at depth-2.

**WRONG — More than two top-level groups:**

\`\`\`markdown
## Tasks

- [ ] 1. Core Implementation
  - [ ] 1.1 Foundation module
    - [ ] 1.1.1 Create the module file
- [ ] 2. Testing
  - [ ] 2.1 Unit tests
    - [ ] 2.1.1 Write unit tests
- [ ] 3. Documentation
  - [ ] 3.1 Update docs
    - [ ] 3.1.1 Write README
\`\`\`

This is INVALID because there are three top-level groups. All mandatory work MUST be subgroups under \`1.\`. Only \`1.\` and \`2.\` are allowed at depth-1.

#### Validation Checklist

Before writing the tasks.md file, verify:

1. There are exactly TWO depth-1 lines: \`- [ ] 1. ...\` and \`- [ ]* 2. ...\`
2. Every depth-2 line (e.g., \`1.1\`, \`1.2\`) is indented under a depth-1 parent
3. Every depth-3 line (e.g., \`1.1.1\`) is indented under a depth-2 parent
4. No \`*\` markers appear in Group 1; ALL lines in Group 2 have \`*\`
5. No top-level numbers beyond \`1.\` and \`2.\` exist

## General Guidelines

- Preserve existing content that is already well-written
- Suggest additions rather than wholesale rewrites
- Maintain consistency with the project's existing style
- Cross-reference between documents when relevant
- Flag any contradictions between requirements, design, and tasks

## Output

Present the refined document in full, with changes clearly visible.
Summarise what was changed and why at the end.
`,
  platformOverrides: {}
};
