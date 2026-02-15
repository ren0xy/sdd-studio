# Requirements Document

## Introduction

Integrate the `sdd-framework` package (currently a git submodule at `deps/sdd-framework/`) directly into the `src/` folder of the `sdd-studio` VS Code extension as an internal module at `src/sdd-framework/`. The framework must remain runtime-agnostic — it must never import from VS Code extension code. An ESLint boundary rule enforces this constraint at lint time. After inlining, the git submodule, the `file:` dependency, and the dynamic ESM import indirection in `src/framework/loader.ts` are removed, replaced by direct TypeScript imports.

## Glossary

- **Framework**: The `sdd-framework` module — a portable, runtime-agnostic library providing spec management, skill registry, platform adapters, task tracking, and instruction composition.
- **Extension**: The `sdd-studio` VS Code extension code that lives in `src/` (excluding `src/sdd-framework/`).
- **Boundary**: The architectural constraint that the Framework module never imports from the Extension module.
- **Loader**: The current `src/framework/loader.ts` module that dynamically imports the Framework via `import('sdd-framework')` and exposes singleton instances.
- **Inlining**: The process of copying the Framework source files from `deps/sdd-framework/src/` into `src/sdd-framework/` and converting all external package references to direct relative imports.

## Requirements

### Requirement 1: Move Framework Source Into Extension Source Tree

**User Story:** As a developer, I want the framework source code to live inside `src/sdd-framework/` so that I have a single codebase to navigate, build, and debug without managing a separate git submodule.

#### Acceptance Criteria

1. WHEN the migration is complete, THE Extension SHALL contain all Framework source files under `src/sdd-framework/` with the same internal directory structure as `deps/sdd-framework/src/`.
2. WHEN the migration is complete, THE Extension SHALL compile the Framework files as part of the main `tsconfig.json` build without a separate compilation step.
3. WHEN the migration is complete, THE Extension SHALL no longer reference the `sdd-framework` npm package name in any import statement.

### Requirement 2: Remove Git Submodule and Package Dependency

**User Story:** As a developer, I want the git submodule and `file:` dependency removed so that the project has a simpler dependency graph and setup process.

#### Acceptance Criteria

1. WHEN the migration is complete, THE Repository SHALL not contain a `.gitmodules` entry for `deps/sdd-framework`.
2. WHEN the migration is complete, THE `package.json` SHALL not list `sdd-framework` in its `dependencies` or `devDependencies`.
3. WHEN the migration is complete, THE Repository SHALL not contain the `deps/sdd-framework/` directory.
4. WHEN the migration is complete, THE `package.json` SHALL not contain the `deps:init`, `deps:update`, `deps:build`, or `setup` scripts that reference the submodule.

### Requirement 3: Replace Dynamic Import Loader With Direct Imports

**User Story:** As a developer, I want to import framework classes and types directly via TypeScript imports so that I get full type-checking, go-to-definition, and refactoring support without the dynamic `import()` indirection.

#### Acceptance Criteria

1. WHEN the migration is complete, THE Extension SHALL import Framework exports using relative path imports to `src/sdd-framework/` instead of the `'sdd-framework'` package specifier.
2. WHEN the migration is complete, THE Loader module (`src/framework/loader.ts`) SHALL be replaced by a module that directly imports and re-exports Framework classes without dynamic `import()`.
3. WHEN the migration is complete, THE Extension SHALL retain the `getInstances()` function signature so that existing call sites remain unchanged.
4. IF the Framework module fails to initialize, THEN THE Extension SHALL log the error and surface a user-visible notification, preserving the current graceful degradation behavior.

### Requirement 4: Convert Framework From ESM to CommonJS Module Syntax

**User Story:** As a developer, I want the inlined framework to use the same module system as the extension (CommonJS via TypeScript) so that there is no module format mismatch at build time or runtime.

#### Acceptance Criteria

1. WHEN the migration is complete, THE Framework source files SHALL not use `.js` extensions in import specifiers.
2. WHEN the migration is complete, THE Framework source files SHALL compile under the extension's `tsconfig.json` settings (`"module": "commonjs"`, `"moduleResolution": "node"`).
3. IF a Framework source file uses ESM-only syntax (top-level await, `import.meta`), THEN THE Migration SHALL replace that syntax with a CommonJS-compatible equivalent.

### Requirement 5: Enforce Architectural Boundary via ESLint

**User Story:** As a developer, I want an ESLint rule that prevents the framework module from importing VS Code extension code so that the framework remains runtime-agnostic and re-extractable.

#### Acceptance Criteria

1. THE ESLint Configuration SHALL define a rule that prevents any file under `src/sdd-framework/` from importing any file outside `src/sdd-framework/`.
2. THE ESLint Configuration SHALL define a rule that prevents any file under `src/sdd-framework/` from importing the `vscode` module.
3. WHEN a developer adds an import in `src/sdd-framework/` that references a file in `src/` (outside `src/sdd-framework/`) or the `vscode` module, THE ESLint SHALL report an error.
4. THE ESLint Configuration SHALL allow files outside `src/sdd-framework/` to freely import from `src/sdd-framework/`.

### Requirement 6: Migrate Framework Tests

**User Story:** As a developer, I want the framework's tests to run as part of the main test suite so that I have a single `npm test` command covering all code.

#### Acceptance Criteria

1. WHEN the migration is complete, THE Framework unit tests SHALL reside under `src/sdd-framework/__tests__/` and run via the existing Vitest configuration.
2. WHEN the migration is complete, THE Framework property-based tests SHALL reside under `src/sdd-framework/__tests__/` and run via the existing Vitest configuration.
3. WHEN the migration is complete, THE `vitest.config.ts` SHALL no longer include glob patterns referencing `deps/`.
4. WHEN the migration is complete, THE Framework tests SHALL pass without modification to their assertions or test logic (only import paths change).

### Requirement 7: Preserve Framework Public API Surface

**User Story:** As a developer, I want the framework's public API to remain identical after inlining so that no consuming code breaks.

#### Acceptance Criteria

1. WHEN the migration is complete, THE `src/sdd-framework/index.ts` barrel file SHALL export the same set of types, classes, and functions as the current `deps/sdd-framework/src/index.ts`.
2. WHEN the migration is complete, THE Extension modules that previously imported from `'sdd-framework'` SHALL import the same symbols from `src/sdd-framework/index.ts` (or its sub-modules) with no behavioral change.
3. IF a symbol was exported from the Framework before inlining, THEN THE symbol SHALL remain exported after inlining.

### Requirement 8: Exclude CLI Entry Point

**User Story:** As a developer, I want the framework's CLI entry point (`cli.ts`) excluded from the inlined module since the VS Code extension does not use it, keeping the codebase focused.

#### Acceptance Criteria

1. WHEN the migration is complete, THE `src/sdd-framework/` directory SHALL not contain `cli.ts` or any CLI-specific files.
2. WHEN the migration is complete, THE `package.json` SHALL not contain a `bin` entry referencing the framework CLI.
