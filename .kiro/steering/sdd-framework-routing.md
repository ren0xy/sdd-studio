---
inclusion: fileMatch
fileMatchPattern: "src/**/*.ts"
---

# SDD Framework Routing Rule

All spec-related operations in the extension MUST route through the `sdd-framework` package via the framework loader (`src/framework/loader.ts`).

## What this means

- Spec creation must use `CreateSpecCommand` via `getInstances()`. The extension no longer writes template files directly — the framework's `CreateSpecCommand` handles folder creation, config, and all template files.
- Task status updates must use `TaskTracker` via `getInstances()`.
- Platform detection and switching must use `WorkspaceAdapter` via `PlatformService`.
- Skill installation and transformation must use `SkillTransformer` and `SkillRegistry`.
- Skills are auto-installed on extension activation. After platform detection, the extension checks all detected platforms for missing core skills and installs them automatically.

## Agent panel interaction pattern

The extension acts as a GUI for the sdd-framework. It does NOT build prompts or embed document content into agent messages. Instead:

1. The sdd-framework provides canonical skills (e.g., `refine-spec`, `create-spec`, `run-task`) that get installed into the workspace as platform-specific skill files.
2. When the user triggers an action (e.g., clicking "Refine" in CodeLens), the extension uses the framework's **Instruction Composer** (`composeSkillInstruction`) to build a short instruction string, then injects it into the agent panel. The Instruction Composer is the single source of truth for instruction text — both the CLI (`sdd refine`) and the extension use it.
3. The agent reads the installed skill file (which contains all the detailed guidance), reads the relevant documents, and performs the work.

This means:
- The extension NEVER hardcodes prompt templates or embeds document content in messages.
- All agent-facing instructions live in the framework's canonical skill definitions.
- Each platform gets its own formatted version of the skill via the adapter's `formatSkill()`.
- The extension's only job is to compose a short trigger message and inject it via `PromptInjector` or platform-specific commands.

## Fallback pattern

When the framework is unavailable (`isFrameworkAvailable() === false`), a local fallback is acceptable. But the framework path must always be attempted first.

## Adding new platform-aware features

When adding any new feature that produces content, file structures, or agent-facing instructions that could vary by platform:

1. Add a canonical skill in `deps/sdd-framework/src/skills/` (if it involves agent interaction)
2. Or add a method to `PlatformAdapter` (if it involves workspace structure/paths)
3. Implement across all 5 adapters (kiro, claude-code, codex, antigravity, amazonq)
4. Export from `deps/sdd-framework/src/index.ts` if needed
5. In the extension, use `getInstances()` to access framework functionality
6. Provide a local fallback for graceful degradation

Do NOT add extension-specific UI concerns (CodeLens labels, webview state, etc.) to the framework. The framework is standalone and must work independently via CLI and agent panels.
