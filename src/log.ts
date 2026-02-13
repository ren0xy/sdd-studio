import * as vscode from 'vscode';

let channel: vscode.OutputChannel | undefined;

function getChannel(): vscode.OutputChannel {
  if (!channel) {
    channel = vscode.window.createOutputChannel('SDD Studio');
  }
  return channel;
}

export function log(message: string): void {
  const ts = new Date().toISOString();
  getChannel().appendLine(`[${ts}] ${message}`);
}

export function showLog(): void {
  getChannel().show(true);
}
