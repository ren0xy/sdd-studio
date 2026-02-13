---
inclusion: auto
description: Enforces zero-padded three-digit numeric prefix naming for spec folders under .kiro/specs/.
---

# Spec Naming Convention

When creating new spec folders under `.kiro/specs/`, always use a zero-padded three-digit numeric prefix followed by a kebab-case descriptive name:

```
.kiro/specs/<NNN>-<short-kebab-description>/
```

- The prefix must be three digits, zero-padded (e.g., `000`, `001`, `012`).
- The next number should increment by 1 from the highest existing prefix in `.kiro/specs/`.
- The description should be lowercase kebab-case, concise, and reflect the feature or goal of the spec.

Examples:
- `000-sdd-framework-init`
- `001-markdown-quirks-research`
- `014-auth-token-refresh`
