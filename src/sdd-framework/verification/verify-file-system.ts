/**
 * VerifyFileSystem - Abstraction for read-only file system access during verification
 *
 * Requirements: 7.1
 */

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Read-only file system interface for verification.
 * Dependency-injected so property tests can use in-memory implementations.
 */
export interface VerifyFileSystem {
  exists(filePath: string): Promise<boolean>;
  readFile(filePath: string): Promise<string>;
  isDirectory(filePath: string): Promise<boolean>;
  listFiles(dirPath: string): Promise<string[]>;
}

/**
 * Real Node.js implementation of VerifyFileSystem.
 */
export class NodeVerifyFileSystem implements VerifyFileSystem {
  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async readFile(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf-8');
  }

  async isDirectory(filePath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(filePath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  async listFiles(dirPath: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dirPath);
      return entries.map(e => path.join(dirPath, e));
    } catch {
      return [];
    }
  }
}
