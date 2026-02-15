/**
 * Clipboard Utility
 * 
 * Platform-native clipboard access for the CLI.
 * Uses child_process.execSync with platform-specific commands.
 */

import { execSync } from 'child_process';
import { platform } from 'os';

/**
 * Copy text to the system clipboard using platform-native commands.
 * - Windows: `clip`
 * - macOS: `pbcopy`
 * - Linux: `xclip -selection clipboard` (falls back to `xsel --clipboard --input`)
 * 
 * @returns true if copy succeeded, false otherwise
 */
export function copyToClipboard(text: string): boolean {
  try {
    const os = platform();
    let command: string;

    switch (os) {
      case 'win32':
        command = 'clip';
        break;
      case 'darwin':
        command = 'pbcopy';
        break;
      default:
        // Linux — try xclip first, fall back to xsel
        try {
          execSync('which xclip', { stdio: 'ignore' });
          command = 'xclip -selection clipboard';
        } catch {
          command = 'xsel --clipboard --input';
        }
        break;
    }

    execSync(command, { input: text, stdio: ['pipe', 'ignore', 'ignore'] });
    return true;
  } catch {
    return false;
  }
}
