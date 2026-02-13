import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('vscode', () => ({
  env: { clipboard: { writeText: vi.fn() } },
  window: { showInformationMessage: vi.fn() },
}));

import * as vscode from 'vscode';
import { copyPromptToClipboard } from '../clipboard';

describe('copyPromptToClipboard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes prompt to clipboard and shows notification', async () => {
    await copyPromptToClipboard('test prompt');

    expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('test prompt');
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Prompt copied to clipboard — paste it into your AI chat panel.',
    );
  });
});
