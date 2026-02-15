/**
 * SkillVerifier - Verifies skill files were installed correctly
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import * as path from 'path';
import type { PlatformId } from '../types';
import type { VerifyFileSystem } from './verify-file-system';
import type { VerificationCheck } from './verification-data';

/**
 * Platform-specific skills directory paths (from adapters).
 */
const PLATFORM_SKILLS_PATH: Record<PlatformId, string> = {
  kiro: '.kiro/skills/',
  'claude-code': '.claude/skills/',
  codex: '.codex/skills/',
  antigravity: '.agent/skills/',
  amazonq: '.amazonq/rules/',
};

/**
 * Verifies skill files were installed correctly for a platform.
 */
export class SkillVerifier {
  constructor(private fs: VerifyFileSystem) {}

  async verify(
    platform: PlatformId,
    skillNames: string[],
    workspaceRoot: string
  ): Promise<VerificationCheck[]> {
    const checks: VerificationCheck[] = [];
    const skillsBase = path.join(workspaceRoot, PLATFORM_SKILLS_PATH[platform]);
    const isCodex = platform === 'codex';

    for (const skillName of skillNames) {
      // Determine skill file path based on platform — Req 6.1, 6.4
      const skillPath = isCodex
        ? path.join(skillsBase, skillName, 'SKILL.md')
        : path.join(skillsBase, `${skillName}.md`);

      // Check existence — Req 6.1
      const exists = await this.fs.exists(skillPath);
      checks.push({
        name: `Skill ${skillName} exists`,
        passed: exists,
        expected: 'file present',
        actual: exists ? 'file present' : 'file missing',
        message: exists
          ? `Skill file found at ${isCodex ? `${skillName}/SKILL.md` : `${skillName}.md`}`
          : `Skill file missing at ${isCodex ? `${skillName}/SKILL.md` : `${skillName}.md`}`,
      });

      if (!exists) continue;

      // Check non-empty — Req 6.2
      try {
        const content = await this.fs.readFile(skillPath);
        const nonEmpty = content.trim().length > 0;
        checks.push({
          name: `Skill ${skillName} non-empty`,
          passed: nonEmpty,
          expected: 'non-empty file',
          actual: nonEmpty ? 'non-empty file' : 'empty file',
          message: nonEmpty
            ? `Skill file is non-empty`
            : `Skill file is empty`,
        });

        // Check CLI invocation section — Req 6.3
        const hasCliSection = /cli\s+invocation/i.test(content);
        checks.push({
          name: `Skill ${skillName} CLI invocation section`,
          passed: hasCliSection,
          expected: 'CLI invocation section present',
          actual: hasCliSection ? 'section found' : 'section missing',
          message: hasCliSection
            ? 'CLI invocation section found'
            : 'CLI invocation section missing',
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        checks.push({
          name: `Skill ${skillName} non-empty`,
          passed: false,
          expected: 'readable file',
          actual: `read error: ${errMsg}`,
          message: `Failed to read skill file: ${errMsg}`,
        });
      }

      // For Codex: also verify directory structure — Req 6.4
      if (isCodex) {
        const skillDir = path.join(skillsBase, skillName);
        const dirExists = await this.fs.isDirectory(skillDir);
        checks.push({
          name: `Skill ${skillName} directory structure`,
          passed: dirExists,
          expected: 'skill directory present',
          actual: dirExists ? 'directory present' : 'directory missing',
          message: dirExists
            ? `Codex skill directory ${skillName}/ found`
            : `Codex skill directory ${skillName}/ missing`,
        });
      }
    }

    return checks;
  }
}
