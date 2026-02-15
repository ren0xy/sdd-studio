/**
 * Start Group Command
 *
 * Composes a start-task-group instruction and copies it to the system clipboard.
 * Users can then paste the instruction into their agent panel.
 */

import { composeSkillInstruction } from '../instructions/index';
import { Validator } from '../validation/validator';
import { copyToClipboard } from './clipboard';
import { CommandResult, ErrorCode, successResult, errorResult } from './command-result';

export interface StartGroupOptions {
  spec: string;
  group: string;
  workspaceRoot?: string;
}

export interface StartGroupResult {
  instruction: string;
  copiedToClipboard: boolean;
}

const NUMERIC_GROUP_RE = /^\d+$/;

export class StartGroupCommand {
  async execute(options: StartGroupOptions): Promise<CommandResult<StartGroupResult>> {
    // Validate --spec
    if (!options.spec) {
      return errorResult('start-group', ErrorCode.MISSING_ARGUMENT, 'The --spec argument is required.');
    }

    const specValidation = Validator.validateSpecName(options.spec);
    if (!specValidation.valid) {
      return errorResult('start-group', ErrorCode.INVALID_SPEC_NAME, specValidation.errors[0]?.message ?? 'Invalid spec name.');
    }

    // Validate --group
    if (!options.group) {
      return errorResult('start-group', ErrorCode.MISSING_ARGUMENT, 'The --group argument is required.');
    }

    if (!NUMERIC_GROUP_RE.test(options.group)) {
      return errorResult(
        'start-group',
        ErrorCode.MISSING_ARGUMENT,
        `Invalid --group value "${options.group}". Expected a numeric group ID (e.g., "1" or "2").`
      );
    }

    const instruction = composeSkillInstruction('start-task-group', {
      specName: options.spec,
      groupId: options.group,
    });

    const copied = copyToClipboard(instruction);

    return successResult<StartGroupResult>('start-group', {
      instruction,
      copiedToClipboard: copied,
    });
  }
}
