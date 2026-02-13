---
inclusion: auto
description: Enforces a two-group task numbering convention (mandatory vs optional) for spec task files.
---

# Task Format Convention — STRICT

When generating or editing `tasks.md` files inside `.kiro/specs/*/`, you MUST follow the structure below exactly. Deviations are not acceptable.

## Rule 1: Exactly Two Top-Level Groups

Every `tasks.md` MUST have exactly two top-level numbered items:

1. **Group 1 (prefix `1.`)** — Mandatory core implementation tasks.
2. **Group 2 (prefix `2.`)** — Optional / stretch-goal tasks (property tests, nice-to-haves).

There must be NO other top-level numbers (no `3.`, `4.`, `5.`, etc.). All mandatory work lives under `1.x.y`. All optional work lives under `2.x.y`.

## Rule 2: Numbering Scheme

Use three-level `x.y.z` numbering:

- `1.` and `2.` are the only top-level items.
- `1.1`, `1.2`, `1.3`, … are subgroups (phases) inside Group 1.
- `1.1.1`, `1.1.2`, … are leaf tasks inside a subgroup.
- Same pattern for Group 2: `2.1`, `2.1.1`, etc.

## Rule 3: Optional Marker

- Every checkbox line in Group 2 MUST use `- [ ]*` (asterisk after the bracket).
- NO line in Group 1 may use `- [ ]*`.

## Rule 4: Subgroup Design

- Group tasks that touch the same files/modules into the same subgroup.
- Order subgroups by dependency (foundational work first).
- Each subgroup should be completable in one conversation.
- Include checkpoint subgroups (e.g., `1.5 Checkpoint — run tests`) as subgroups under Group 1, not as separate top-level items.

## Rule 5: What NOT to Do

- Do NOT create top-level items numbered 3, 4, 5, etc.
- Do NOT mix optional (`*`) tasks inline within Group 1 subgroups.
- Do NOT use flat sequential numbering (1, 2, 3, 4, 5, 6, 7, 8, 9) for unrelated phases — those should be subgroups under `1.`.

## Canonical Example

```markdown
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
    - [ ]* 2.1.3 Property test: output is single-line plain text
  - [ ]* 2.2 Command property tests
    - [ ]* 2.2.1 Property test: JSON round-trip
    - [ ]* 2.2.2 Property test: invalid input rejection
  - [ ]* 2.3 Extension unit tests
    - [ ]* 2.3.1 Unit tests for refactored spec creation
    - [ ]* 2.3.2 Unit tests for updated CodeLens
    - [ ]* 2.3.3 Unit tests for auto-install logic
```
