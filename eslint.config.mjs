import tsParser from "@typescript-eslint/parser";

/**
 * ESLint flat config for sdd-studio.
 *
 * Boundary rules prevent src/sdd-framework/ from importing vscode or
 * anything outside its own directory tree.
 *
 * The restriction uses two overrides because `no-restricted-imports`
 * matches the raw import specifier string, not the resolved path:
 *
 *  - Root-level framework files (src/sdd-framework/*.ts):
 *      `../*` escapes the framework → blocked.
 *
 *  - Subdirectory framework files (src/sdd-framework/adapters/*.ts, etc.):
 *      `../*` stays inside the framework (e.g. ../types) → allowed.
 *      `../../*` escapes the framework → blocked.
 */

const vscodeRestriction = {
  group: ["vscode", "vscode/*"],
  message:
    "Framework must not import vscode — it must remain runtime-agnostic.",
};

export default [
  // Base TypeScript parsing for all source files
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
    },
  },

  // Boundary rules for root-level framework files (src/sdd-framework/*.ts)
  // Here, ../* escapes the framework boundary.
  {
    files: ["src/sdd-framework/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            vscodeRestriction,
            {
              group: ["../*"],
              message:
                "Framework must not import from the extension layer. Keep the boundary clean.",
            },
          ],
        },
      ],
    },
  },

  // Boundary rules for subdirectory framework files (src/sdd-framework/**/*.ts in nested dirs)
  // Here, ../* is valid (stays within framework), but ../../* escapes.
  {
    files: ["src/sdd-framework/**/*.ts"],
    ignores: ["src/sdd-framework/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            vscodeRestriction,
            {
              group: ["../../*"],
              message:
                "Framework must not import from the extension layer. Keep the boundary clean.",
            },
          ],
        },
      ],
    },
  },
];
