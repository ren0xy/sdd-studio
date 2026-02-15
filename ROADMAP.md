# Roadmap

## ✅ 0.1.0 — MVP

Initial release establishing the core extension functionality. Proof of concept for SDD-driven development workflows inside VS Code-like editors.

---

## 🔲 0.2.0 — Reduce Complexity & Introduce Interactivity

### ✅ Inline sdd-framework

~~Integrate `sdd-framework` directly into the `src/` folder as an internal module. If the need arises later, it can be extracted again as a standalone package/project. Enforce a clean boundary via ESLint rule(s) so that the framework module never imports from VS Code extension code, keeping it runtime-agnostic.~~

Done — framework inlined at `src/sdd-framework/`, ESLint boundary rules enforced, git submodule removed.

### Cross-model prompt fidelity

Refine prompt templates to produce more faithful and structurally consistent results — closer to Kiro-quality output — even when weaker non-Claude models are used. Constrain templates to deliver similar results across platforms and models.

### Specialized document views

Introduce rich, custom tab-based views for working with requirements, design, and tasks documents:

- Progress tracking statistics (task completion, coverage)
- Clear, prominent buttons placed freely — not constrained by CodeLens positioning
- Colored text, bold highlights, collapsible accordions
- Padded and nested lists for better readability and structure

### Rich companion metadata

Introduce companion files (`tasks.json` and similar) that enrich the functionality of the original markdown documents without compromising their portability or readability.

### Artifact viewer & editor

Introduce an Antigravity-style artifact viewer and editor:

- Leave comments and iterate on documents inline
- Core feature of the specialized document views mentioned above
- Review, annotate, and refine specs/designs without leaving the editor

### Agent panel automation (optional)

Work on OS-level automation to move the mouse into the agent chat panel, click, paste (Ctrl+V), and submit — making the prompt handoff less tedious. This remains an optional power-user feature; the primary workflow stays manual (extension prepares prompts, user pastes and executes).
