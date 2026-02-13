# SDD Studio — Product Vision

**Write specs once, work with any AI coding agent.**

---

## What is SDD Studio

SDD Studio is a VS Code extension that provides a graphical interface for managing spec-driven development workflows across multiple AI coding agent platforms. It integrates with the [SDD Framework](deps/sdd-framework/) npm package and renders all UI as React webviews, giving developers a unified visual workspace for specs, skills, steering documents, and platform configuration.

Rather than locking you into a single AI agent's workflow, SDD Studio lets you author specifications in a standard format and seamlessly work with whichever agent fits your project — or switch between them without losing progress.

## Core Value Proposition

Modern development increasingly relies on AI coding agents, but each platform has its own file conventions, instruction formats, and skill locations. SDD Studio solves this fragmentation:

- **Unified spec management** — All specs live in `.kiro/specs/` regardless of which AI agent you use. One format, one location, every platform.
- **Platform-aware skill installation** — Skills are installed to the correct directory for the active platform automatically.
- **Seamless prompt injection** — Send prompts directly to whichever AI agent panel is active, with clipboard fallback when direct injection isn't available.
- **Workspace transformation** — Switch between platforms with rollback support, preserving your specs and work.

## Supported Platforms

| Platform | Instruction Format | Skills Location |
|----------|-------------------|-----------------|
| Kiro | `.kiro/steering/*.md` | `.kiro/skills/*.md` |
| Claude Code | `CLAUDE.md` | `.claude/skills/*.md` |
| OpenAI Codex | `AGENTS.md` | `.codex/skills/{name}/SKILL.md` |
| Google Antigravity | `.agent/rules/specs.md` | `.agent/skills/*.md` |

## Architecture Overview

SDD Studio follows a three-layer architecture with clean separation of concerns:

```
┌─────────────────────────────────────────┐
│         React + Vite Webview UI         │
│  (Specs, Steering, Skills, Settings)    │
├─────────────────────────────────────────┤
│     VS Code Extension Backend (TS)      │
│  (Commands, File Watchers, Messages)    │
├─────────────────────────────────────────┤
│     SDD Framework (npm package)         │
│  (Platform Adapters, SkillRegistry,     │
│   TaskTracker, WorkspaceAdapter)        │
└─────────────────────────────────────────┘
```


The **webview UI** handles all visual interaction — spec browsing, task trees, skill management, and settings. The **extension backend** is a thin integration layer responsible for VS Code-specific concerns: activation, command registration, file watching, and message passing. The **SDD Framework** is the engine, handling all platform-specific logic including platform detection, skill installation, task status tracking, and workspace transformation.

## Milestones

### v0.1.0 — Initial Stable Release ✓

The first versioned release of SDD Studio, representing 12 specs of iterative development:

- **Core Extension** — VS Code extension scaffold with React webview UI, activation, and command infrastructure.
- **Framework Integration** — Full SDD Framework integration with platform adapters and a service layer bridging the extension to the framework.
- **Platform Support** — Multi-platform support across Kiro, Claude Code, OpenAI Codex, and Google Antigravity, with platform-specific skill management and UI.
- **Skill System** — Skill-based agent interaction through the SkillRegistry, with browsing, install, and uninstall capabilities.
- **CodeLens Integration** — Inline task actions via VS Code CodeLens, with depth-aware rendering, status indicators, counters, and resilient Markdown parsing.
- **Task Lifecycle** — Full task status management supporting not started, in progress, completed, and failed states.
- **Prompt Injection** — Clipboard-based prompt injection as a reliable fallback for sending prompts to AI agent panels.
- **Automated Releases** — GitHub Actions workflow producing VSIX artifacts on version tag pushes.

## Forward-Looking Goals

Future versions of SDD Studio aim to expand the developer experience:

- **Custom skill creation UI** — Author and manage custom skills directly within the extension.
- **Spec templates and wizards** — Guided spec creation with templates for common patterns.
- **Multi-workspace support** — Manage specs across multiple workspace roots simultaneously.
- **Remote and SSH workspace support** — Full functionality in remote development environments.
- **Collaborative editing** — Shared spec editing for team-based development workflows.

## Related Links

- [SDD Framework](deps/sdd-framework/) — The underlying engine for platform-specific logic
- [Consumer Guide](deps/sdd-framework/CONSUMER-GUIDE.md) — How extensions integrate with the SDD Framework
- [Integration Guide](deps/sdd-framework/INTEGRATION.md) — Detailed integration patterns and API reference
