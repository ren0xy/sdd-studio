/**
 * Refine Command
 * 
 * Composes a refine instruction and copies it to the system clipboard.
 * Users can then paste the instruction into their agent panel.
 */

import { composeSkillInstruction } from '../instructions/index';
import { copyToClipboard } from './clipboard';
import { CommandResult, ErrorCode, successResult, errorResult } from './command-result';

const VALID_DOC_TYPES = ['requirements', 'design', 'tasks'] as const;
type DocType = typeof VALID_DOC_TYPES[number];

export interface RefineOptions {
  spec: string;
  doc: string;
  workspaceRoot?: string;
}

export interface RefineResult {
  instruction: string;
  copiedToClipboard: boolean;
}

export class RefineCommand {
  /**
   * Execute the refine command.
   * Validates arguments, composes instruction via InstructionComposer,
   * copies to clipboard, and returns the result.
   */
  async execute(options: RefineOptions): Promise<CommandResult<RefineResult>> {
    // Validate --spec
    if (!options.spec) {
      return errorResult('refine', ErrorCode.MISSING_ARGUMENT, 'The --spec argument is required.');
    }

    // Validate --doc
    if (!options.doc || !isValidDocType(options.doc)) {
      return errorResult(
        'refine',
        ErrorCode.MISSING_ARGUMENT,
        `Invalid --doc value "${options.doc ?? ''}". Valid document types are: ${VALID_DOC_TYPES.join(', ')}.`
      );
    }

    const instruction = composeSkillInstruction('refine-spec', {
      specName: options.spec,
      docType: options.doc
    });

    const copied = copyToClipboard(instruction);

    return successResult<RefineResult>('refine', {
      instruction,
      copiedToClipboard: copied
    });
  }
}

function isValidDocType(value: string): value is DocType {
  return (VALID_DOC_TYPES as readonly string[]).includes(value);
}
