import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { PlatformId, PLATFORM_CONFIGS } from '../../types';

// In-memory filesystem
const fileSystem = new Map<string, Uint8Array>();
const dirs = new Set<string>();

vi.mock('vscode', () => {
  const jp = (base: string, ...parts: string[]): string => {
    let r = base;
    for (const p of parts) {
      r = r.endsWith('/') ? r + p : r + '/' + p;
    }
    return r;
  };
  return {
    workspace: {
      workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
      fs: {
        stat: vi.fn(async (uri: { fsPath: string }) => {
          if (fileSystem.has(uri.fsPath) || dirs.has(uri.fsPath)) {
            return { type: fileSystem.has(uri.fsPath) ? 1 : 2 };
          }
          throw new Error(`Not found: ${uri.fsPath}`);
        }),
        readFile: vi.fn(async (uri: { fsPath: string }) => {
          const content = fileSystem.get(uri.fsPath);
          if (!content) throw new Error(`File not found: ${uri.fsPath}`);
          return content;
        }),
        writeFile: vi.fn(async (uri: { fsPath: string }, content: Uint8Array) => {
          fileSystem.set(uri.fsPath, content);
        }),
        readDirectory: vi.fn(async (uri: { fsPath: string }) => {
          const prefix = uri.fsPath.endsWith('/') ? uri.fsPath : uri.fsPath + '/';
          const entries: [string, number][] = [];
          const seen = new Set<string>();
          for (const key of fileSystem.keys()) {
            if (key.startsWith(prefix)) {
              const rest = key.slice(prefix.length);
              const name = rest.split('/')[0];
              if (!seen.has(name) && !rest.includes('/')) {
                seen.add(name);
                entries.push([name, 1]);
              }
            }
          }
          return entries;
        }),
        delete: vi.fn(async (uri: { fsPath: string }) => {
          fileSystem.delete(uri.fsPath);
        }),
        createDirectory: vi.fn(async (uri: { fsPath: string }) => {
          dirs.add(uri.fsPath);
        }),
      },
    },
    Uri: {
      joinPath: vi.fn((base: { fsPath: string }, ...parts: string[]) => ({
        fsPath: jp(base.fsPath, ...parts),
      })),
    },
    FileType: { File: 1, Directory: 2 },
  };
});

// Mock the framework loader
const mockInstall = vi.fn();
const mockListForPlatform = vi.fn();

vi.mock('../../framework/loader', () => ({
  getInstances: vi.fn(async () => ({
    skillRegistry: {
      install: mockInstall,
      listForPlatform: mockListForPlatform,
    },
    adapters: new Map([
      ['kiro', { platformId: 'kiro', skillsPath: '.kiro/skills/' }],
      ['claude-code', { platformId: 'claude-code', skillsPath: '.claude/skills/' }],
      ['codex', { platformId: 'codex', skillsPath: '.codex/skills/' }],
      ['antigravity', { platformId: 'antigravity', skillsPath: '.agent/skills/' }],
      ['amazonq', { platformId: 'amazonq', skillsPath: '.amazonq/rules/' }],
    ]),
    fsBridge: {},
  })),
}));

import { SkillsService } from '../skills';

const platformArb: fc.Arbitrary<PlatformId> = fc.constantFrom(
  'kiro', 'claude-code', 'codex', 'antigravity', 'amazonq',
);
const skillNameArb = fc.stringMatching(/^[a-z][a-z0-9-]{1,15}$/);

describe('Property Tests: Skills', () => {
  let service: SkillsService;
  const encoder = new TextEncoder();

  beforeEach(() => {
    fileSystem.clear();
    dirs.clear();
    vi.clearAllMocks();
    service = new SkillsService();
    mockListForPlatform.mockReturnValue([]);
  });

  /**
   * Property 7: Skill install/uninstall round-trip
   */
  it('Property 7: install then uninstall leaves skills directory unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(platformArb, skillNameArb, async (platform, skillName) => {
        fileSystem.clear();
        dirs.clear();
        service = new SkillsService();
        mockListForPlatform.mockReturnValue([]);

        const config = PLATFORM_CONFIGS[platform];
        const skillsDir = `/workspace/${config.skillsPath}`;
        dirs.add(skillsDir);

        // Mock install to write the file (simulating framework behavior)
        mockInstall.mockImplementation(async () => {
          const filePath = `${skillsDir}${skillName}.md`;
          fileSystem.set(filePath, encoder.encode(`# ${skillName}\n`));
          return { success: true, skillName, targetPath: filePath, directoryCreated: false };
        });

        // Snapshot before
        const filesBefore = new Map(fileSystem);

        await service.installSkill(platform, skillName);

        const installed = await service.listInstalled(platform);
        expect(installed.some(s => s.name === skillName)).toBe(true);

        await service.uninstallSkill(platform, skillName);

        // Verify back to original state
        const filesAfter = new Map<string, string>();
        for (const [path] of fileSystem.entries()) {
          if (path.startsWith(skillsDir)) {
            filesAfter.set(path, '');
          }
        }
        const origFiles = new Map<string, string>();
        for (const [path] of filesBefore.entries()) {
          if (path.startsWith(skillsDir)) {
            origFiles.set(path, '');
          }
        }
        expect(filesAfter.size).toBe(origFiles.size);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 6: Available skills match registry for platform
   * The set of skill names from listAvailable() is a superset of the registry's
   * listForPlatform(), and each skill's supportedPlatforms includes the queried platform.
   *
   * **Validates: Requirements 5.1, 5.4**
   */
  it('Property 6: Available skills match registry for platform', async () => {
    const registrySkillArb = fc.array(
      fc.record({
        name: skillNameArb,
        description: fc.string({ minLength: 1, maxLength: 30 }),
        supportedPlatforms: fc.constant(['kiro', 'claude-code', 'codex', 'antigravity', 'amazonq'] as PlatformId[]),
      }),
      { minLength: 1, maxLength: 5 },
    ).map(skills => {
      // Deduplicate by name
      const seen = new Set<string>();
      return skills.filter(s => { if (seen.has(s.name)) return false; seen.add(s.name); return true; });
    });

    await fc.assert(
      fc.asyncProperty(platformArb, registrySkillArb, async (platform, registrySkills) => {
        fileSystem.clear();
        dirs.clear();
        service = new SkillsService();

        mockListForPlatform.mockReturnValue(registrySkills);

        const available = await service.listAvailable(platform);
        const availableNames = new Set(available.map(s => s.name));
        const registryNames = registrySkills.map(s => s.name);

        // Available is a superset of registry
        for (const name of registryNames) {
          expect(availableNames.has(name)).toBe(true);
        }

        // Each available skill's supportedPlatforms includes the queried platform
        for (const skill of available) {
          expect(skill.supportedPlatforms).toContain(platform);
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 8: Skill listing completeness
   */
  it('Property 8: listing returns all installed skills with correct metadata', async () => {
    const skillNamesArb = fc
      .array(skillNameArb, { minLength: 1, maxLength: 5 })
      .map(names => [...new Set(names)]);

    await fc.assert(
      fc.asyncProperty(platformArb, skillNamesArb, async (platform, skillNames) => {
        fileSystem.clear();
        dirs.clear();
        service = new SkillsService();
        mockListForPlatform.mockReturnValue([]);

        const config = PLATFORM_CONFIGS[platform];
        const skillsDir = `/workspace/${config.skillsPath}`;
        dirs.add(skillsDir);

        // Directly seed the filesystem with skill files
        for (const name of skillNames) {
          fileSystem.set(`${skillsDir}${name}.md`, encoder.encode(`# ${name}\n`));
        }

        const installed = await service.listInstalled(platform);
        const installedNames = installed.map(s => s.name);

        for (const name of skillNames) {
          expect(installedNames).toContain(name);
        }

        for (const skill of installed) {
          expect(skill.installed).toBe(true);
          expect(typeof skill.name).toBe('string');
          expect(typeof skill.description).toBe('string');
          expect(Array.isArray(skill.supportedPlatforms)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});
