import * as vscode from 'vscode';

const CLIPBOARD_NOTIFICATION = 'Prompt copied to clipboard — paste it into your AI chat panel.';

/**
 * Copy a prompt string to the system clipboard and show a notification.
 */
export async function copyPromptToClipboard(prompt: string): Promise<void> {
  await vscode.env.clipboard.writeText(prompt);
  vscode.window.showInformationMessage(CLIPBOARD_NOTIFICATION);
}
