/**
 * Instruction Composer
 * 
 * Composes agent-facing instruction strings from skill names and parameters.
 * Supports registered templates with {placeholder} resolution and a default
 * fallback for unregistered skills.
 */

/**
 * Instruction template definition.
 * Each skill can register a template that the composer resolves with parameters.
 */
export interface InstructionTemplate {
  skillName: string;
  template: string;
}

/** Internal registry of instruction templates keyed by skill name */
const templateRegistry = new Map<string, InstructionTemplate>();

/**
 * Sanitize a string value by stripping newlines and control characters,
 * ensuring the final instruction is single-line plain text.
 */
function sanitize(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\x00-\x1f\x7f]/g, '');
}

/**
 * Resolve {placeholder} tokens in a template string using the provided params.
 * Unmatched placeholders are left as literal text (graceful degradation).
 */
function resolveTemplate(template: string, params: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    return key in params ? sanitize(params[key]) : match;
  });
}

/**
 * Build a default instruction string when no template is registered.
 * Format: Use the {skillName} skill with key1="value1", key2="value2".
 */
function buildDefault(skillName: string, params: Record<string, string>): string {
  const entries = Object.entries(params);
  if (entries.length === 0) {
    return `Use the ${sanitize(skillName)} skill.`;
  }
  const paramStr = entries
    .map(([k, v]) => `${sanitize(k)}="${sanitize(v)}"`)
    .join(', ');
  return `Use the ${sanitize(skillName)} skill with ${paramStr}.`;
}

/**
 * Compose a skill instruction string from a skill name and parameters.
 * 
 * If a template is registered for the skill, it resolves {placeholder} tokens.
 * Otherwise, a default instruction string is produced.
 * 
 * @param skillName - The canonical skill name (e.g., 'refine-spec')
 * @param params - Key-value parameters to resolve in the template
 * @returns A plain-text instruction string suitable for pasting into an agent panel
 */
export function composeSkillInstruction(skillName: string, params: Record<string, string>): string {
  const template = templateRegistry.get(skillName);
  if (template) {
    // Inject skillName into params so templates can reference it
    return resolveTemplate(template.template, { skillName, ...params });
  }
  return buildDefault(skillName, params);
}

/**
 * Register a custom instruction template for a skill.
 * Overwrites any previously registered template for the same skill.
 */
export function registerInstructionTemplate(template: InstructionTemplate): void {
  templateRegistry.set(template.skillName, template);
}

/**
 * Get all registered instruction templates.
 */
export function getInstructionTemplates(): InstructionTemplate[] {
  return Array.from(templateRegistry.values());
}

// ── Built-in templates ──────────────────────────────────────────────────────

registerInstructionTemplate({
  skillName: 'refine-spec',
  template: 'Use the refine-spec skill on the {docType} document of spec "{specName}".'
});

registerInstructionTemplate({
  skillName: 'start-task-group',
  template: 'Use the start-task-group skill on group {groupId} of spec "{specName}".'
});

registerInstructionTemplate({
  skillName: 'run-task',
  template: 'Use the run-task skill to execute task {taskId} from spec "{specName}".'
});

registerInstructionTemplate({
  skillName: 'run-task',
  template: 'Use the run-task skill to execute task {taskId} from spec "{specName}".'
});

