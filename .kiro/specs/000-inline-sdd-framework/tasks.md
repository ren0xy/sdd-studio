# Implementation Plan: Inline sdd-framework

## Overview

Migrate the `sdd-framework` from a git submodule at `deps/sdd-framework/` into `src/sdd-framework/` as an internal module. Convert ESM imports to CommonJS-compatible style, replace the dynamic loader with direct imports, add ESLint boundary rules, migrate tests, and clean up submodule artifacts.

## Tasks

- [x] 1. Copy framework source into src/sdd-framework/
  - [x] 1.1 Copy all source files from `deps/sdd-framework/src/` to `src/sdd-framework/`, preserving directory structure
    - Copy all subdirectories: adapters, commands, documents, instructions, registry, skills, tasks, transformer, validation, verification, workspace
    - Copy `index.ts` and `types.ts`
    - Exclude `cli.ts` — it is not used by the extension
    - _Requirements: 1.1, 8.1_
  - [x] 1.2 Copy framework tests from `deps/sdd-framework/src/__tests__/` to `src/sdd-framework/__tests__/`
    - Include all `.test.ts` and `.property.test.ts` files
    - _Requirements: 6.1, 6.2_

- [x] 2. Convert framework imports from ESM to CommonJS-compatible style
  - [x] 2.1 Strip `.js` extensions from all import specifiers in `src/sdd-framework/**/*.ts`
    - Find all `from '...'` and `from "..."` statements containing `.js` and remove the extension
    - This is a mechanical find-and-replace across all framework source files
    - _Requirements: 4.1, 4.2_
  - [x] 2.2 Check for and replace any ESM-only syntax (`import.meta`, top-level `await`) with CommonJS equivalents
    - _Requirements: 4.3_
  - [x] 2.3 Write property test: no .js import extensions in framework files
    - **Property 1: No .js import extensions in framework files**
    - Scan all `src/sdd-framework/**/*.ts` files and assert no import specifier ends with `.js`
    - **Validates: Requirements 4.1**

- [x] 3. Checkpoint — Verify framework compiles
  - Run `tsc --noEmit` and ensure zero errors from `src/sdd-framework/` files
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Replace dynamic loader with direct imports
  - [x] 4.1 Rewrite `src/framework/loader.ts` to use direct static imports from `../sdd-framework`
    - Remove the dynamic `import()` / `new Function` indirection
    - Keep `getInstances()` function signature and return type unchanged
    - Keep `isFrameworkAvailable()` and `resetInstances()` exports
    - `loadFramework()` becomes a thin wrapper that sets `frameworkAvailable = true` and returns the module
    - _Requirements: 3.2, 3.3_
  - [x] 4.2 Update `src/framework/fileSystemBridge.ts` imports from `'sdd-framework'` to `'../sdd-framework'`
    - _Requirements: 3.1_
  - [x] 4.3 Update `src/types.ts` imports from `'sdd-framework'` to `'./sdd-framework'`
    - _Requirements: 3.1_
  - [x] 4.4 Update test file imports that reference `'sdd-framework'`
    - `src/framework/__tests__/frameworkTypes.test.ts` → `'../../sdd-framework'`
    - `src/parsers/__tests__/taskStatus.property.test.ts` → `'../../sdd-framework'`
    - _Requirements: 3.1_
  - [x] 4.5 Write property test: export surface preservation
    - **Property 3: Export surface preservation**
    - Capture the set of exported symbol names from the old `deps/sdd-framework/src/index.ts` as a snapshot
    - Import `src/sdd-framework/index.ts` and verify all snapshot symbols are present
    - **Validates: Requirements 7.1, 7.3**

- [x] 5. Checkpoint — Verify extension compiles and tests pass
  - Run `tsc --noEmit` and ensure zero errors
  - Run `vitest --run` and ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Add ESLint boundary rules
  - [x] 6.1 Install ESLint and `@typescript-eslint/parser` as devDependencies (if not already present)
    - Add `eslint` and `@typescript-eslint/parser` to `devDependencies` in `package.json`
    - _Requirements: 5.1, 5.2_
  - [x] 6.2 Create ESLint configuration file with boundary rules
    - Add `overrides` for `src/sdd-framework/**/*.ts` with `no-restricted-imports` rule
    - Block `vscode` and `../*` patterns with descriptive error messages
    - Ensure files outside `src/sdd-framework/` are not affected by the restriction
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [x] 6.3 Update `package.json` lint script to use the new ESLint config
    - Ensure `npm run lint` runs ESLint on `src/` with the TypeScript parser
    - _Requirements: 5.3_
  - [x] 6.4 Write property test: ESLint boundary enforcement
    - **Property 2: ESLint boundary enforcement**
    - Generate import paths that cross the boundary (e.g., `../../extension`, `vscode`) and verify ESLint flags them
    - Generate valid intra-framework import paths and verify ESLint does not flag them
    - **Validates: Requirements 5.1, 5.2, 5.3**

- [x] 7. Migrate framework tests and update vitest config
  - [x] 7.1 Update import paths in `src/sdd-framework/__tests__/` test files
    - Change imports from `'../skills/index.js'` style to `'../skills/index'` (strip .js)
    - Change any `'sdd-framework'` imports to relative paths
    - _Requirements: 6.1, 6.2, 6.4_
  - [x] 7.2 Update `vitest.config.ts` to remove `deps/` glob patterns
    - Remove `deps/**/tests/**/*.test.ts` and `deps/**/tests/**/*.property.test.ts` from the include array
    - Framework tests are now picked up by the existing `src/**/*.test.ts` pattern
    - _Requirements: 6.3_

- [x] 8. Clean up submodule artifacts
  - [x] 8.1 Remove `deps/sdd-framework/` directory
    - _Requirements: 2.3_
  - [x] 8.2 Remove or empty `.gitmodules` file
    - If `deps/sdd-framework` is the only submodule, delete `.gitmodules`
    - _Requirements: 2.1_
  - [x] 8.3 Remove `sdd-framework` from `package.json` dependencies and clean up scripts
    - Remove `"sdd-framework": "file:deps/sdd-framework"` from `dependencies`
    - Remove `deps:init`, `deps:update`, `deps:build`, and `setup` scripts
    - _Requirements: 2.2, 2.4, 8.2_

- [x] 9. Final checkpoint — Full verification
  - Run `tsc --noEmit` — zero errors
  - Run `vitest --run` — all tests pass
  - Run `npm run lint` — no ESLint errors (boundary rules enforced)
  - Verify no remaining references to `'sdd-framework'` package specifier in source files
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after major changes
- Property tests validate universal correctness properties using fast-check
- The migration is mostly mechanical (copy + find-and-replace) but the loader rewrite and ESLint setup require careful attention
