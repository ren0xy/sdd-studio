# Changelog

All notable changes to SDD Studio are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-02-13

### Added

#### Core Extension
- VS Code extension scaffold with TypeScript backend and React/Vite webview frontend
- Extension activation and lifecycle management: command registration, file watchers, webview provider
- Spec management: create, view, navigate, and delete specs in `.kiro/specs/`
- Task management: parse `tasks.md`, display task tree with checkbox status
- Steering document management per platform
- Skills management: browse, install, and uninstall from SDD Framework SkillRegistry
- Platform switching with rollback on failure
- Typed message protocol between webview and extension backend
- File watching for specs, steering, and skills directories
- Settings management via VS Code configuration API

#### Framework Integration
- Replaced duplicated inline logic with delegated calls to sdd-framework API
- ESM/CJS bridge via dynamic `import()` with typed FrameworkLoader singleton
- FileSystemBridge adapter translating VS Code `workspace.fs` to framework's Node.js fs interfaces
- PlatformService delegates detection and switching to WorkspaceAdapter
- SkillsService delegates to SkillRegistry; task status updates delegate to TaskTracker
- Type alignment: re-exported PlatformId and TaskStatus from framework
- Graceful degradation when framework fails to load

#### Platform Support
- Added Amazon Q Developer as 5th supported platform with `.amazonq/rules/` for skills and steering
- Changed skill auto-installation to cover all five platforms on activation
- Removed deprecated webview panel; kept Specs tree view only
- Renamed activity bar container to "Specs" and removed dead code

#### Skill System
- Instruction Composer module for consistent instruction text
- `sdd refine` CLI command: composes instruction and copies to clipboard
- Skill auto-installation on extension activation for all detected platforms
- Spec creation fully delegated to framework's CreateSpecCommand
- CodeLens "Refine" button uses framework's Instruction Composer
- `refine-spec` skill registered and exported from framework

#### CodeLens Integration
- Group-level CodeLens with completion counters
- Task-level status CodeLens (✓/→/✗)
- Pre-flight validation for unresolved requirements and blocked tasks
- Dynamic leaf detection at any depth
- Individual "▶ Run task" CodeLens for not-started leaf tasks
- "▶ Start subgroup" CodeLens for depth-2 parents
- Status-aware subgroup sub-counters
- Fixed counters stuck at "0/0 done" on Codex/Antigravity
- Resilient parsing for non-conforming task structures
- Synthetic group inference from first ID segment

#### Task Lifecycle
- Sub-task Retry action for failed tasks using `run-task` skill
- Sub-task Fix action for failed tasks using `analyze-task-failure` skill
- Queued status display for `[~]` tasks
- Group CodeLens reads group's own checkbox status
- `sddStudio.retryTask` and `sddStudio.fixTask` commands registered

#### Prompt Injection
- Clipboard-only prompt injection pattern replacing multi-platform agent panel detection
- All action commands copy to clipboard and show notification
- Removed PromptInjector class and all agent panel API references
- Consistent notification: "Prompt copied to clipboard — paste it into your AI chat panel."
