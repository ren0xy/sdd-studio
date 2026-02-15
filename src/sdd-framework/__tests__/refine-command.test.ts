import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RefineCommand } from '../commands/refine-command';
import { copyToClipboard } from '../commands/clipboard';

vi.mock('../commands/clipboard', () => ({
  copyToClipboard: vi.fn(() => true)
}));

const mockCopy = vi.mocked(copyToClipboard);

describe('RefineCommand', () => {
  const cmd = new RefineCommand();

  beforeEach(() => {
    vi.clearAllMocks();
    mockCopy.mockReturnValue(true);
  });

  it('succeeds with valid spec and doc', async () => {
    const result = await cmd.execute({ spec: 'my-feature', doc: 'requirements' });
    expect(result.success).toBe(true);
    expect(result.data?.instruction).toContain('refine-spec');
    expect(result.data?.instruction).toContain('my-feature');
    expect(result.data?.instruction).toContain('requirements');
    expect(result.data?.copiedToClipboard).toBe(true);
  });

  it('works with all valid doc types', async () => {
    for (const doc of ['requirements', 'design', 'tasks']) {
      const result = await cmd.execute({ spec: 'test', doc });
      expect(result.success).toBe(true);
      expect(result.data?.instruction).toContain(doc);
    }
  });

  it('returns error when --spec is missing', async () => {
    const result = await cmd.execute({ spec: '', doc: 'requirements' });
    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('spec');
  });

  it('returns error when --doc is missing', async () => {
    const result = await cmd.execute({ spec: 'my-feature', doc: '' });
    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('Valid document types');
  });

  it('returns error for invalid --doc value', async () => {
    const result = await cmd.execute({ spec: 'my-feature', doc: 'summary' });
    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('requirements');
    expect(result.error?.message).toContain('design');
    expect(result.error?.message).toContain('tasks');
  });

  it('reports copiedToClipboard: false when clipboard fails', async () => {
    mockCopy.mockReturnValue(false);
    const result = await cmd.execute({ spec: 'my-feature', doc: 'design' });
    expect(result.success).toBe(true);
    expect(result.data?.copiedToClipboard).toBe(false);
  });

  it('JSON output contains instruction and copiedToClipboard fields', async () => {
    const result = await cmd.execute({ spec: 'my-feature', doc: 'tasks' });
    const json = JSON.stringify(result);
    const parsed = JSON.parse(json);
    expect(parsed.data.instruction).toBeDefined();
    expect(typeof parsed.data.copiedToClipboard).toBe('boolean');
  });
});
